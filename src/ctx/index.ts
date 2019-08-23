interface DatabaseContext {
  getTableContext(tableName: string): TableContext;
}

export type Row = any[];

export type Selector = '*' | { column: string };

export type TableIdentifier = string;

interface TableContext {
  readonly identifier: TableIdentifier;

  executeSelect(selectors: Selector[]): Row[];
}

interface Driver {
  executeQuery(q: string): Row[];
}

class RenderingTableContext implements TableContext {
  constructor(readonly identifier: TableIdentifier, private driver: Driver) {}

  executeSelect(selectors: Selector[]): Row[] {
    return this.driver.executeQuery(
      `SELECT ${selectors
        .map((selector) => (selector === '*' ? '*' : selector.column))
        .join(', ')} FROM ${this.identifier}`
    );
  }
}
