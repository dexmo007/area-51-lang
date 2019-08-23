import { readFileSync } from 'fs';
import { resolve } from 'path';
import ohm from 'ohm-js';
import { toAST } from 'ohm-js/extras';
import alasql from 'alasql';

const g = ohm.grammar(
  readFileSync(resolve(__dirname, 'grammar-ts.ohm'), { encoding: 'utf8' })
);
interface Closure {
  hasVar(name: string): boolean;
  putVar(name: string, value: any): void;
  getVar(name: string): any;
  toMap(): { [name: string]: any };
}
class ObjectClosure implements Closure {
  constructor(private obj: Record<string, any>) {}

  hasVar(name: string): boolean {
    return !!this.obj[name];
  }
  putVar(name: string, value: any): void {
    if (this.hasVar(name)) {
      throw new Error(`variable ${name} already exists in closure`);
    }
    this.obj[name] = value;
  }
  getVar(name: string) {
    if (!this.hasVar(name)) {
      throw new Error(`ReferenceError: ${name}`);
    }
    return this.obj[name];
  }

  toMap() {
    return this.obj;
  }
}

function getProperty(obj, prop) {
  const value = obj[prop];
  if (typeof value === 'function') {
    return value.bind(obj);
  }
  return value;
}

const s = g.createSemantics().addOperation('eval', {
  Program(statements) {
    return (closure: Closure) => {
      for (const statement of statements.children) {
        statement.eval()(closure);
      }
    };
  },
  Assignment(cnst, ident, eq, expr, sc) {
    return (closure: Closure) => {
      closure.putVar(ident.eval(), expr.eval()(closure));
    };
  },
  LiteralExpr(e) {
    return () => e.eval();
  },
  SqlExpr(select, selector, from, table) {
    return (closure: Closure) =>
      alasql(`SELECT ${selector.eval()(closure)} FROM ${table.eval()}`);
  },
  SqlSelection_wildcard(asterisk) {
    return () => '*';
  },
  SqlSelection_column(ident) {
    return () => ident.eval();
  },
  SqlSelection_ref(ref) {
    return (closure: Closure) => closure.getVar(ref.eval());
  },
  MemberExpr_propAccessor(member, dot, propIdentifier) {
    return (closure: Closure) =>
      getProperty(member.eval()(closure), propIdentifier.eval());
  },
  MemberExpr_closureAccessor(ident) {
    return (closure: Closure) => closure.getVar(ident.eval());
  },
  MemberExpr_literal(literal) {
    return () => literal.eval();
  },
  CallExpr_call(func, args) {
    return (closure: Closure) => func.eval()(closure)(...args.eval()(closure));
  },
  CallExpr_member(func, args) {
    return (closure: Closure) => func.eval()(closure)(...args.eval()(closure));
  },
  CallExpr_propAccessor(call, dot, ident) {
    return (closure: Closure) =>
      getProperty(call.eval()(closure), ident.eval());
  },
  Arguments(op, args, cp) {
    return (closure: Closure) => args.eval().map((child) => child(closure));
  },
  ExprStatement(expr, sc) {
    return (closure: Closure) => expr.eval()(closure);
  },
  /**
   * build-ins
   */
  EmptyListOf() {
    return [];
  },
  NonemptyListOf(head, sep, tail) {
    return [head.eval(), ...tail.eval()];
  },
  // _terminal() {
  //   return this.sourceString;
  // },
  /*

  */
  ident(first, rest) {
    return first.sourceString + rest.sourceString;
  },
  number(e) {
    return parseInt(e.sourceString, 10);
  },
  stringLiteral(oq, chars, cq) {
    return chars.sourceString;
  },
});

alasql('CREATE TABLE names(id number, name string)');
alasql("INSERT INTO names VALUES (1,'foo'),(2,'bar'),(3,'hinz')");

// const m = g.match('const foo = "my_col"; const bar = SELECT $foo FROM names;');
const m = g.match(`
//const foo = "my_col";
// const n = 5;
// comment
const results = SELECT * FROM names;
const joined = results.map(nameOnly).join(", ");
console.log(joined);
`);
if (m.failed()) {
  console.error(m.message);
  process.exit(1);
}
const ast = toAST(m);
console.log(ast[1]);
const closure = new ObjectClosure({
  console: {
    log: console.log,
  },
  nameOnly: ({ name }) => name,
});
console.log('============================================');
s(m).eval()(closure);
console.log('============================================');
console.log('Closure:');
console.log(closure.toMap());
console.log('DB:');
console.table(alasql('SELECT * FROM names'));
