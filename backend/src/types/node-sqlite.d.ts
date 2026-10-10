/**
 * Minimal typing for Node's built-in `node:sqlite` (Node ≥ 22.13). The backend
 * resolves @types/node@18, which predates the module, so we declare the slice
 * we use. Runtime is the real built-in — see the container's `node --version`.
 * Rows come back as `{ [column]: value }` maps; repositories narrow them.
 */
declare module 'node:sqlite' {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export interface SQLStatementResultingChanges {
    changes: number;
    lastInsertRowid: number | bigint;
  }
  export interface StatementSync {
    all(...params: SQLInputValue[]): Record<string, SQLInputValue>[];
    get(...params: SQLInputValue[]): Record<string, SQLInputValue> | undefined;
    run(...params: SQLInputValue[]): SQLStatementResultingChanges;
    iterate(...params: SQLInputValue[]): IterableIterator<Record<string, SQLInputValue>>;
    setAllowBareNamedParameters(enabled: boolean): void;
  }
  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean; readOnly?: boolean });
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    function(name: string, fn: (...args: SQLInputValue[]) => SQLInputValue): void;
  }
}
