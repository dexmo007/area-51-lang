import { readFileSync } from 'fs';
import { resolve } from 'path';
import ohm from 'ohm-js';

const grammar = ohm.grammar(
  readFileSync(resolve(__dirname, 'grammar.ohm'), { encoding: 'utf8' })
);

export interface SqlExprContext {
  tables: { [tableName: string]: TableContext };
}

export interface TableContext {
  tableName: string;
  columnNames: string[];
  rows: Row[];
}

export type Row = any[];

export type Selector = (ctx: TableContext) => (row: Row) => any[];

const semantics = grammar.createSemantics().addOperation('eval', {
  ident(first, rest) {
    return first.sourceString + rest.sourceString;
  },
  SqlSelection_wildcard(wildcard): Selector {
    return (ctx) => (row) => row;
  },
  SqlSelection_column(e): Selector {
    const column = e.eval();
    return (ctx) => {
      const colIndex = ctx.columnNames.indexOf(column);
      if (colIndex === -1) {
        throw new Error(
          `unknown column "${column}" on table "${ctx.tableName}"`
        );
      }
      return (row) => [row[colIndex]];
    };
  },
  SqlExpr(select, sel0, from, table) {
    const selector: Selector = sel0.eval();
    return (ctx: SqlExprContext) => {
      const tableName = table.eval();
      const tableContext = ctx.tables[tableName];
      if (!tableContext) {
        throw new Error(`unknown table "${tableName}"`);
      }
      return tableContext.rows.map(selector(tableContext));
    };
  },
  TableExpr(e) {
    return e.eval();
  },
});

export interface Interpreter {
  eval(source: string): Row[];
}

export function createInterpreter(ctx: SqlExprContext): Interpreter {
  return {
    eval(source: string) {
      const m = grammar.match(source);
      if (m.succeeded()) {
        return semantics(m).eval()(ctx);
      } else {
        throw new Error(m.message);
      }
    },
  };
}
