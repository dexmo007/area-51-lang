import { createInterpreter } from './lang';

const interpreter = createInterpreter({
  tables: {
    SOMETABLE: {
      rows: [[1, 'foo'], [2, 'bar']],
      columnNames: ['id', 'name'],
      tableName: 'SOMETABLE',
    },
  },
});

const result = interpreter.eval('SELECT name FROM SOMETABLE');
console.log(result);
