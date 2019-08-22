import { SqlExprContext, createInterpreter, Interpreter } from './lang';

describe('lang', () => {
  const rows = [[1, 'foo'], [2, 'bar']];
  const ctx: SqlExprContext = {
    tables: {
      TABLE: {
        tableName: 'TABLE',
        columnNames: ['id', 'name'],
        rows,
      },
    },
  };
  let interpreter: Interpreter;
  beforeEach(() => {
    interpreter = createInterpreter(ctx);
  });

  it.each([
    ['SELECT * FROM TABLE', rows],
    ['SELECT name FROM TABLE', [['foo'], ['bar']]],
  ])('should correctly eval "%s"', (sql, expected) => {
    const result = interpreter.eval(sql as string);
    expect(result).toEqual(expected);
  });
});
