
import { Constructor, Func, instanceOfAny } from './indexeddb.utils';

export interface OpenDBCallbacks<DBTypes extends DBSchema | unknown> {
  /**
   * Called if this version of the database has never been opened before. Use it to specify the
   * schema for the database.
   *
   * @param database A database instance that you can use to add/remove stores and indexes.
   * @param oldVersion Last version of the database opened by the user.
   * @param newVersion Whatever new version you provided.
   * @param transaction The transaction for this upgrade.
   * This is useful if you need to get data from other stores as part of a migration.
   * @param event The event object for the associated 'upgradeneeded' event.
   */
  upgrade?(
    database: IDBPDatabase<DBTypes>,
    oldVersion: number,
    newVersion: number | null,
    transaction: IDBPTransaction<
      DBTypes,
      StoreNames<DBTypes>[],
      'versionchange'
    >,
    event: IDBVersionChangeEvent,
  ): void;
  /**
   * Called if there are older versions of the database open on the origin, so this version cannot
   * open.
   *
   * @param currentVersion Version of the database that's blocking this one.
   * @param blockedVersion The version of the database being blocked (whatever version you provided to `openDB`).
   * @param event The event object for the associated `blocked` event.
   */
  blocked?(
    currentVersion: number,
    blockedVersion: number | null,
    event: IDBVersionChangeEvent,
  ): void;
  /**
   * Called if this connection is blocking a future version of the database from opening.
   *
   * @param currentVersion Version of the open database (whatever version you provided to `openDB`).
   * @param blockedVersion The version of the database that's being blocked.
   * @param event The event object for the associated `versionchange` event.
   */
  blocking?(
    currentVersion: number,
    blockedVersion: number | null,
    event: IDBVersionChangeEvent,
  ): void;
  /**
   * Called if the browser abnormally terminates the connection.
   * This is not called when `db.close()` is called.
   */
  terminated?(): void;
}

/**
 * Open a database.
 *
 * @param name Name of the database.
 * @param version Schema version.
 * @param callbacks Additional callbacks.
 */
export function openDB<DBTypes extends DBSchema | unknown = unknown>(
  name: string,
  version?: number,
  { blocked, upgrade, blocking, terminated }: OpenDBCallbacks<DBTypes> = {},
): Promise<IDBPDatabase<DBTypes>> {
  const request = indexedDB.open(name, version);
  const openPromise = wrap(request) as Promise<IDBPDatabase<DBTypes>>;

  if (upgrade) {
    request.addEventListener('upgradeneeded', (event) => {
      upgrade(
        wrap(request.result) as IDBPDatabase<DBTypes>,
        event.oldVersion,
        event.newVersion,
        wrap(request.transaction!) as unknown as IDBPTransaction<
          DBTypes,
          StoreNames<DBTypes>[],
          'versionchange'
        >,
        event,
      );
    });
  }

  if (blocked) {
    request.addEventListener('blocked', (event) =>
      blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        (event as IDBVersionChangeEvent).oldVersion,
        (event as IDBVersionChangeEvent).newVersion,
        event as IDBVersionChangeEvent,
      ),
    );
  }

  openPromise
    .then((db) => {
      if (terminated) db.addEventListener('close', () => terminated());
      if (blocking) {
        db.addEventListener('versionchange', (event) =>
          blocking(event.oldVersion, event.newVersion, event),
        );
      }
    })
    .catch(() => {});

  return openPromise;
}

export interface DeleteDBCallbacks {
  /**
   * Called if there are connections to this database open, so it cannot be deleted.
   *
   * @param currentVersion Version of the database that's blocking the delete operation.
   * @param event The event object for the associated `blocked` event.
   */
  blocked?(currentVersion: number, event: IDBVersionChangeEvent): void;
}

/**
 * Delete a database.
 *
 * @param name Name of the database.
 */
export function deleteDB(
  name: string,
  { blocked }: DeleteDBCallbacks = {},
): Promise<void> {
  const request = indexedDB.deleteDatabase(name);

  if (blocked) {
    request.addEventListener('blocked', (event) =>
      blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        (event as IDBVersionChangeEvent).oldVersion,
        event as IDBVersionChangeEvent,
      ),
    );
  }

  return wrap(request).then(() => undefined);
}


// === The rest of this file is type defs ===
type KeyToKeyNoIndex<T> = {
  [K in keyof T]: string extends K ? never : number extends K ? never : K;
};
type ValuesOf<T> = T extends { [K in keyof T]: infer U } ? U : never;
type KnownKeys<T> = ValuesOf<KeyToKeyNoIndex<T>>;

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export interface DBSchema {
  [s: string]: DBSchemaValue;
}

interface IndexKeys {
  [s: string]: IDBValidKey;
}

interface DBSchemaValue {
  key: IDBValidKey;
  value: any;
  indexes?: IndexKeys;
}

/**
 * Extract known object store names from the DB schema type.
 *
 * @template DBTypes DB schema type, or unknown if the DB isn't typed.
 */
export type StoreNames<DBTypes extends DBSchema | unknown> =
  DBTypes extends DBSchema ? KnownKeys<DBTypes> : string;

/**
 * Extract database value types from the DB schema type.
 *
 * @template DBTypes DB schema type, or unknown if the DB isn't typed.
 * @template StoreName Names of the object stores to get the types of.
 */
export type StoreValue<
  DBTypes extends DBSchema | unknown,
  StoreName extends StoreNames<DBTypes>,
> = DBTypes extends DBSchema ? DBTypes[StoreName]['value'] : any;

/**
 * Extract database key types from the DB schema type.
 *
 * @template DBTypes DB schema type, or unknown if the DB isn't typed.
 * @template StoreName Names of the object stores to get the types of.
 */
export type StoreKey<
  DBTypes extends DBSchema | unknown,
  StoreName extends StoreNames<DBTypes>,
> = DBTypes extends DBSchema ? DBTypes[StoreName]['key'] : IDBValidKey;

/**
 * Extract the names of indexes in certain object stores from the DB schema type.
 *
 * @template DBTypes DB schema type, or unknown if the DB isn't typed.
 * @template StoreName Names of the object stores to get the types of.
 */
export type IndexNames<
  DBTypes extends DBSchema | unknown,
  StoreName extends StoreNames<DBTypes>,
> = DBTypes extends DBSchema ? keyof DBTypes[StoreName]['indexes'] : any;

/**
 * Extract the types of indexes in certain object stores from the DB schema type.
 *
 * @template DBTypes DB schema type, or unknown if the DB isn't typed.
 * @template StoreName Names of the object stores to get the types of.
 * @template IndexName Names of the indexes to get the types of.
 */
export type IndexKey<
  DBTypes extends DBSchema | unknown,
  StoreName extends StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName>,
> = DBTypes extends DBSchema
  ? IndexName extends keyof DBTypes[StoreName]['indexes']
    ? DBTypes[StoreName]['indexes'][IndexName]
    : IDBValidKey
  : IDBValidKey;

type CursorSource<
  DBTypes extends DBSchema | unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>>,
  StoreName extends StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown,
  Mode extends IDBTransactionMode = 'readonly',
> = IndexName extends IndexNames<DBTypes, StoreName>
  ? IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode>
  : IDBPObjectStore<DBTypes, TxStores, StoreName, Mode>;

type CursorKey<
  DBTypes extends DBSchema | unknown,
  StoreName extends StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown,
> = IndexName extends IndexNames<DBTypes, StoreName>
  ? IndexKey<DBTypes, StoreName, IndexName>
  : StoreKey<DBTypes, StoreName>;

type IDBPDatabaseExtends = Omit<
  IDBDatabase,
  'createObjectStore' | 'deleteObjectStore' | 'transaction' | 'objectStoreNames'
>;

/**
 * A variation of DOMStringList with precise string types
 */
export interface TypedDOMStringList<T extends string> extends DOMStringList {
  contains(string: T): boolean;
  item(index: number): T | null;
  [index: number]: T;
  [Symbol.iterator](): IterableIterator<T>;
}

interface IDBTransactionOptions {
  /**
   * The durability of the transaction.
   *
   * The default is "default". Using "relaxed" provides better performance, but with fewer
   * guarantees. Web applications are encouraged to use "relaxed" for ephemeral data such as caches
   * or quickly changing records, and "strict" in cases where reducing the risk of data loss
   * outweighs the impact to performance and power.
   */
  durability?: 'default' | 'strict' | 'relaxed';
}

export interface IDBPDatabase<DBTypes extends DBSchema | unknown = unknown>
  extends IDBPDatabaseExtends {
  /**
   * The names of stores in the database.
   */
  readonly objectStoreNames: TypedDOMStringList<StoreNames<DBTypes>>;
  /**
   * Creates a new object store.
   *
   * Throws a "InvalidStateError" DOMException if not called within an upgrade transaction.
   */
  createObjectStore<Name extends StoreNames<DBTypes>>(
    name: Name,
    optionalParameters?: IDBObjectStoreParameters,
  ): IDBPObjectStore<
    DBTypes,
    ArrayLike<StoreNames<DBTypes>>,
    Name,
    'versionchange'
  >;
  /**
   * Deletes the object store with the given name.
   *
   * Throws a "InvalidStateError" DOMException if not called within an upgrade transaction.
   */
  deleteObjectStore(name: StoreNames<DBTypes>): void;
  /**
   * Start a new transaction.
   *
   * @param storeNames The object store(s) this transaction needs.
   * @param mode
   * @param options
   */
  transaction<
    Name extends StoreNames<DBTypes>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Name,
    mode?: Mode,
    options?: IDBTransactionOptions,
  ): IDBPTransaction<DBTypes, [Name], Mode>;
  
  transaction<
    Names extends ArrayLike<StoreNames<DBTypes>>,
    Mode extends IDBTransactionMode = 'readonly',
  >(
    storeNames: Names,
    mode?: Mode,
    options?: IDBTransactionOptions,
  ): IDBPTransaction<DBTypes, Names, Mode>;

  // Shortcut methods

  /**
   * Add a value to a store.
   *
   * Rejects if an item of a given key already exists in the store.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param value
   * @param key
   */
  add<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, Name>>;
  /**
   * Deletes all records in a store.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   */
  clear(name: StoreNames<DBTypes>): Promise<void>;
  /**
   * Retrieves the number of records matching the given query in a store.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param key
   */
  count<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key?: StoreKey<DBTypes, Name> | IDBKeyRange | null,
  ): Promise<number>;
  /**
   * Retrieves the number of records matching the given query in an index.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param indexName Name of the index within the store.
   * @param key
   */
  countFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    key?: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange | null,
  ): Promise<number>;
  /**
   * Deletes records in a store matching the given query.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param key
   */
  delete<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    key: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<void>;
  /**
   * Retrieves the value of the first record in a store matching the query.
   *
   * Resolves with undefined if no match is found.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param query
   */
  get<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, Name> | undefined>;
  /**
   * Retrieves the value of the first record in an index matching the query.
   *
   * Resolves with undefined if no match is found.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param indexName Name of the index within the store.
   * @param query
   */
  getFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, Name> | undefined>;
  /**
   * Retrieves all values in a store that match the query.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param query
   * @param count Maximum number of values to return.
   */
  getAll<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: StoreKey<DBTypes, Name> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, Name>[]>;
  /**
   * Retrieves all values in an index that match the query.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param indexName Name of the index within the store.
   * @param query
   * @param count Maximum number of values to return.
   */
  getAllFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query?: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, Name>[]>;
  /**
   * Retrieves the keys of records in a store matching the query.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param query
   * @param count Maximum number of keys to return.
   */
  getAllKeys<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query?: StoreKey<DBTypes, Name> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]>;
  /**
   * Retrieves the keys of records in an index matching the query.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param indexName Name of the index within the store.
   * @param query
   * @param count Maximum number of keys to return.
   */
  getAllKeysFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query?: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreKey<DBTypes, Name>[]>;
  /**
   * Retrieves the key of the first record in a store that matches the query.
   *
   * Resolves with undefined if no match is found.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param query
   */
  getKey<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    query: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, Name> | undefined>;
  /**
   * Retrieves the key of the first record in an index that matches the query.
   *
   * Resolves with undefined if no match is found.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param indexName Name of the index within the store.
   * @param query
   */
  getKeyFromIndex<
    Name extends StoreNames<DBTypes>,
    IndexName extends IndexNames<DBTypes, Name>,
  >(
    storeName: Name,
    indexName: IndexName,
    query: IndexKey<DBTypes, Name, IndexName> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, Name> | undefined>;
  /**
   * Put an item in the database.
   *
   * Replaces any item with the same key.
   *
   * This is a shortcut that creates a transaction for this single action. If you need to do more
   * than one action, create a transaction instead.
   *
   * @param storeName Name of the store.
   * @param value
   * @param key
   */
  put<Name extends StoreNames<DBTypes>>(
    storeName: Name,
    value: StoreValue<DBTypes, Name>,
    key?: StoreKey<DBTypes, Name> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, Name>>;
}

type IDBPTransactionExtends = Omit<
  IDBTransaction,
  'db' | 'objectStore' | 'objectStoreNames'
>;

export interface IDBPTransaction<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  Mode extends IDBTransactionMode = 'readonly',
> extends IDBPTransactionExtends {
  /**
   * The transaction's mode.
   */
  readonly mode: Mode;
  /**
   * The names of stores in scope for this transaction.
   */
  readonly objectStoreNames: TypedDOMStringList<TxStores[number]>;
  /**
   * The transaction's connection.
   */
  readonly db: IDBPDatabase<DBTypes>;
  /**
   * Promise for the completion of this transaction.
   */
  readonly done: Promise<void>;
  /**
   * The associated object store, if the transaction covers a single store, otherwise undefined.
   */
  readonly store: TxStores[1] extends undefined
    ? IDBPObjectStore<DBTypes, TxStores, TxStores[0], Mode>
    : undefined;
  /**
   * Returns an IDBObjectStore in the transaction's scope.
   */
  objectStore<StoreName extends TxStores[number]>(
    name: StoreName,
  ): IDBPObjectStore<DBTypes, TxStores, StoreName, Mode>;
}

type IDBPObjectStoreExtends = Omit<
  IDBObjectStore,
  | 'transaction'
  | 'add'
  | 'clear'
  | 'count'
  | 'createIndex'
  | 'delete'
  | 'get'
  | 'getAll'
  | 'getAllKeys'
  | 'getKey'
  | 'index'
  | 'openCursor'
  | 'openKeyCursor'
  | 'put'
  | 'indexNames'
>;

export interface IDBPObjectStore<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  Mode extends IDBTransactionMode = 'readonly',
> extends IDBPObjectStoreExtends {
  /**
   * The names of indexes in the store.
   */
  readonly indexNames: TypedDOMStringList<IndexNames<DBTypes, StoreName>>;
  /**
   * The associated transaction.
   */
  readonly transaction: IDBPTransaction<DBTypes, TxStores, Mode>;
  /**
   * Add a value to the store.
   *
   * Rejects if an item of a given key already exists in the store.
   */
  add: Mode extends 'readonly'
    ? undefined
    : (
        value: StoreValue<DBTypes, StoreName>,
        key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
      ) => Promise<StoreKey<DBTypes, StoreName>>;
  /**
   * Deletes all records in store.
   */
  clear: Mode extends 'readonly' ? undefined : () => Promise<void>;
  /**
   * Retrieves the number of records matching the given query.
   */
  count(
    key?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null,
  ): Promise<number>;
  /**
   * Creates a new index in store.
   *
   * Throws an "InvalidStateError" DOMException if not called within an upgrade transaction.
   */
  createIndex: Mode extends 'versionchange'
    ? <IndexName extends IndexNames<DBTypes, StoreName>>(
        name: IndexName,
        keyPath: string | string[],
        options?: IDBIndexParameters,
      ) => IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode>
    : undefined;
  /**
   * Deletes records in store matching the given query.
   */
  delete: Mode extends 'readonly'
    ? undefined
    : (key: StoreKey<DBTypes, StoreName> | IDBKeyRange) => Promise<void>;
  /**
   * Retrieves the value of the first record matching the query.
   *
   * Resolves with undefined if no match is found.
   */
  get(
    query: StoreKey<DBTypes, StoreName> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, StoreName> | undefined>;
  /**
   * Retrieves all values that match the query.
   *
   * @param query
   * @param count Maximum number of values to return.
   */
  getAll(
    query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, StoreName>[]>;
  /**
   * Retrieves the keys of records matching the query.
   *
   * @param query
   * @param count Maximum number of keys to return.
   */
  getAllKeys(
    query?: StoreKey<DBTypes, StoreName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreKey<DBTypes, StoreName>[]>;
  /**
   * Retrieves the key of the first record that matches the query.
   *
   * Resolves with undefined if no match is found.
   */
  getKey(
    query: StoreKey<DBTypes, StoreName> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, StoreName> | undefined>;
  /**
   * Get a query of a given name.
   */
  index<IndexName extends IndexNames<DBTypes, StoreName>>(
    name: IndexName,
  ): IDBPIndex<DBTypes, TxStores, StoreName, IndexName, Mode>;

  /**
   * Put an item in the store.
   *
   * Replaces any item with the same key.
   */
  put: Mode extends 'readonly'
    ? undefined
    : (
        value: StoreValue<DBTypes, StoreName>,
        key?: StoreKey<DBTypes, StoreName> | IDBKeyRange,
      ) => Promise<StoreKey<DBTypes, StoreName>>;
  
}

type IDBPIndexExtends = Omit<
  IDBIndex,
  | 'objectStore'
  | 'count'
  | 'get'
  | 'getAll'
  | 'getAllKeys'
  | 'getKey'
  | 'openCursor'
  | 'openKeyCursor'
>;

export interface IDBPIndex<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> = IndexNames<
    DBTypes,
    StoreName
  >,
  Mode extends IDBTransactionMode = 'readonly',
> extends IDBPIndexExtends {
  /**
   * The IDBObjectStore the index belongs to.
   */
  readonly objectStore: IDBPObjectStore<DBTypes, TxStores, StoreName, Mode>;

  /**
   * Retrieves the number of records matching the given query.
   */
  count(
    key?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
  ): Promise<number>;
  /**
   * Retrieves the value of the first record matching the query.
   *
   * Resolves with undefined if no match is found.
   */
  get(
    query: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange,
  ): Promise<StoreValue<DBTypes, StoreName> | undefined>;
  /**
   * Retrieves all values that match the query.
   *
   * @param query
   * @param count Maximum number of values to return.
   */
  getAll(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreValue<DBTypes, StoreName>[]>;
  /**
   * Retrieves the keys of records matching the query.
   *
   * @param query
   * @param count Maximum number of keys to return.
   */
  getAllKeys(
    query?: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange | null,
    count?: number,
  ): Promise<StoreKey<DBTypes, StoreName>[]>;
  /**
   * Retrieves the key of the first record that matches the query.
   *
   * Resolves with undefined if no match is found.
   */
  getKey(
    query: IndexKey<DBTypes, StoreName, IndexName> | IDBKeyRange,
  ): Promise<StoreKey<DBTypes, StoreName> | undefined>;
  
}


type IDBPCursorExtends = Omit<
  IDBCursor,
  | 'key'
  | 'primaryKey'
  | 'source'
  | 'advance'
  | 'continue'
  | 'continuePrimaryKey'
  | 'delete'
  | 'update'
>;

export interface IDBPCursor<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown = unknown,
  Mode extends IDBTransactionMode = 'readonly',
> extends IDBPCursorExtends {
  /**
   * The key of the current index or object store item.
   */
  readonly key: CursorKey<DBTypes, StoreName, IndexName>;
  /**
   * The key of the current object store item.
   */
  readonly primaryKey: StoreKey<DBTypes, StoreName>;
  /**
   * Returns the IDBObjectStore or IDBIndex the cursor was opened from.
   */
  readonly source: CursorSource<DBTypes, TxStores, StoreName, IndexName, Mode>;
  /**
   * Advances the cursor a given number of records.
   *
   * Resolves to null if no matching records remain.
   */
  advance<T>(this: T, count: number): Promise<T | null>;
  /**
   * Advance the cursor by one record (unless 'key' is provided).
   *
   * Resolves to null if no matching records remain.
   *
   * @param key Advance to the index or object store with a key equal to or greater than this value.
   */
  continue<T>(
    this: T,
    key?: CursorKey<DBTypes, StoreName, IndexName>,
  ): Promise<T | null>;
  /**
   * Advance the cursor by given keys.
   *
   * The operation is 'and' – both keys must be satisfied.
   *
   * Resolves to null if no matching records remain.
   *
   * @param key Advance to the index or object store with a key equal to or greater than this value.
   * @param primaryKey and where the object store has a key equal to or greater than this value.
   */
  continuePrimaryKey<T>(
    this: T,
    key: CursorKey<DBTypes, StoreName, IndexName>,
    primaryKey: StoreKey<DBTypes, StoreName>,
  ): Promise<T | null>;
  /**
   * Delete the current record.
   */
  delete: Mode extends 'readonly' ? undefined : () => Promise<void>;
  /**
   * Updated the current record.
   */
  update: Mode extends 'readonly'
    ? undefined
    : (
        value: StoreValue<DBTypes, StoreName>,
      ) => Promise<StoreKey<DBTypes, StoreName>>;
  /**
   * Iterate over the cursor.
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<
    IDBPCursorIteratorValue<DBTypes, TxStores, StoreName, IndexName, Mode>
  >;
}

type IDBPCursorIteratorValueExtends<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown = unknown,
  Mode extends IDBTransactionMode = 'readonly',
> = Omit<
  IDBPCursor<DBTypes, TxStores, StoreName, IndexName, Mode>,
  'advance' | 'continue' | 'continuePrimaryKey'
>;

export interface IDBPCursorIteratorValue<
  DBTypes extends DBSchema | unknown = unknown,
  TxStores extends ArrayLike<StoreNames<DBTypes>> = ArrayLike<
    StoreNames<DBTypes>
  >,
  StoreName extends StoreNames<DBTypes> = StoreNames<DBTypes>,
  IndexName extends IndexNames<DBTypes, StoreName> | unknown = unknown,
  Mode extends IDBTransactionMode = 'readonly',
> extends IDBPCursorIteratorValueExtends<
    DBTypes,
    TxStores,
    StoreName,
    IndexName,
    Mode
  > {
  /**
   * Advances the cursor a given number of records.
   */
  advance<T>(this: T, count: number): void;
  /**
   * Advance the cursor by one record (unless 'key' is provided).
   *
   * @param key Advance to the index or object store with a key equal to or greater than this value.
   */
  continue<T>(this: T, key?: CursorKey<DBTypes, StoreName, IndexName>): void;
  /**
   * Advance the cursor by given keys.
   *
   * The operation is 'and' – both keys must be satisfied.
   *
   * @param key Advance to the index or object store with a key equal to or greater than this value.
   * @param primaryKey and where the object store has a key equal to or greater than this value.
   */
  continuePrimaryKey<T>(
    this: T,
    key: CursorKey<DBTypes, StoreName, IndexName>,
    primaryKey: StoreKey<DBTypes, StoreName>,
  ): void;
}


/*-----------------------------------------------------------------------------------------*/
/*-- Wrap Functions -----------------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------*/

let idbProxyableTypes: Constructor[];
let cursorAdvanceMethods: Func[];

// This is a function to prevent it throwing up in node environments.
function getIdbProxyableTypes(): Constructor[] {
  return (
    idbProxyableTypes ||
    (idbProxyableTypes = [
      IDBDatabase,
      IDBObjectStore,
      IDBIndex,
      IDBCursor,
      IDBTransaction,
    ])
  );
}

// This is a function to prevent it throwing up in node environments.
function getCursorAdvanceMethods(): Func[] {
  return (
    cursorAdvanceMethods ||
    (cursorAdvanceMethods = [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey,
    ])
  );
}

export const reverseTransformCache = new WeakMap();
const transformCache = new WeakMap();
const cursorRequestMap: WeakMap<IDBPCursor, IDBRequest<IDBCursor>> = new WeakMap();
const transactionDoneMap: WeakMap<IDBTransaction, Promise<void>> = new WeakMap();
const transactionStoreNamesMap: WeakMap<IDBTransaction, string[]> = new WeakMap();


/**
 * Revert an enhanced IDB object to a plain old miserable IDB one.
 *
 * Will also revert a promise back to an IDBRequest.
 *
 * @param value The enhanced object to revert.
 */
interface Unwrap {
  // (value: IDBPCursorWithValue<any, any, any, any, any>): IDBCursorWithValue;
  (value: IDBPCursor<any, any, any, any, any>): IDBCursor;
  (value: IDBPDatabase): IDBDatabase;
  (value: IDBPIndex<any, any, any, any, any>): IDBIndex;
  (value: IDBPObjectStore<any, any, any, any>): IDBObjectStore;
  (value: IDBPTransaction<any, any, any>): IDBTransaction;
  <T extends any>(value: Promise<IDBPDatabase<T>>): IDBOpenDBRequest;
  (value: Promise<IDBPDatabase>): IDBOpenDBRequest;
  <T>(value: Promise<T>): IDBRequest<T>;
}
export const unwrap: Unwrap = (value: any): any =>
  reverseTransformCache.get(value);

/**
 * Enhance an IDB object with helpers.
 *
 * @param value The thing to enhance.
 */
export function wrap(value: IDBDatabase): IDBPDatabase;
export function wrap(value: IDBIndex): IDBPIndex;
export function wrap(value: IDBObjectStore): IDBPObjectStore;
export function wrap(value: IDBTransaction): IDBPTransaction;
export function wrap(value: IDBOpenDBRequest): Promise<IDBPDatabase | undefined>;
export function wrap<T>(value: IDBRequest<T>): Promise<T>;
export function wrap(value: any): any {
  // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
  // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
  if (value instanceof IDBRequest) return promisifyRequest(value);

  // If we've already transformed this value before, reuse the transformed value.
  // This is faster, but it also provides object equality.
  if (transformCache.has(value)) return transformCache.get(value);
  const newValue = transformCachableValue(value);

  // Not all types are transformed.
  // These may be primitive types, so they can't be WeakMap keys.
  if (newValue !== value) {
    transformCache.set(value, newValue);
    reverseTransformCache.set(newValue, value);
  }
  return newValue;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  const promise = new Promise<T>((resolve, reject) => {
    const unlisten = () => {
      request.removeEventListener('success', success);
      request.removeEventListener('error', error);
    };
    const success = () => {
      resolve(wrap(request.result as any) as any);
      unlisten();
    };
    const error = () => {
      reject(request.error);
      unlisten();
    };
    request.addEventListener('success', success);
    request.addEventListener('error', error);
  });

  promise
    .then((value) => {
      // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
      // (see wrapFunction).
      if (value instanceof IDBCursor) {
        cursorRequestMap.set(
          value as unknown as IDBPCursor,
          request as unknown as IDBRequest<IDBCursor>,
        );
      }
      // Catching to avoid "Uncaught Promise exceptions"
    })
    .catch(() => {});

  // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
  // is because we create many promises from a single IDBRequest.
  reverseTransformCache.set(promise, request);
  return promise;
}

function transformCachableValue(value: any): any {
  if (typeof value === 'function') return wrapFunction(value); 

  // This doesn't return, it just creates a 'done' promise for the transaction,
  // which is later returned for transaction.done (see idbObjectHandler).
  if (value instanceof IDBTransaction) cacheDonePromiseForTransaction(value);

  if (instanceOfAny(value, getIdbProxyableTypes()))  
    return new Proxy(value, idbProxyTraps);          

  // Return the same value back if we're not going to transform it.
  return value;
}

function cacheDonePromiseForTransaction(tx: IDBTransaction): void {
  // Early bail if we've already created a done promise for this transaction.
  if (transactionDoneMap.has(tx)) return;

  const done = new Promise<void>((resolve, reject) => {
    const unlisten = () => {
      tx.removeEventListener('complete', complete);
      tx.removeEventListener('error', error);
      tx.removeEventListener('abort', error);
    };
    const complete = () => {
      resolve();
      unlisten();
    };
    const error = () => {
      reject(tx.error || new DOMException('AbortError', 'AbortError'));
      unlisten();
    };
    tx.addEventListener('complete', complete);
    tx.addEventListener('error', error);
    tx.addEventListener('abort', error);
  });

  // Cache it for later retrieval.
  transactionDoneMap.set(tx, done);
}

let idbProxyTraps: ProxyHandler<any> = {
  get(target, prop, receiver) {
    if (target instanceof IDBTransaction) {
      // Special handling for transaction.done.
      if (prop === 'done') return transactionDoneMap.get(target);
      // Polyfill for objectStoreNames because of Edge.
      if (prop === 'objectStoreNames') {
        return target.objectStoreNames || transactionStoreNamesMap.get(target);
      }
      // Make tx.store return the only store in the transaction, or undefined if there are many.
      if (prop === 'store') {
        return receiver.objectStoreNames[1]
          ? undefined
          : receiver.objectStore(receiver.objectStoreNames[0]);
      }
    }
    // Else transform whatever we get back.
    return wrap(target[prop]);
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
  has(target, prop) {
    if (
      target instanceof IDBTransaction &&
      (prop === 'done' || prop === 'store')
    ) {
      return true;
    }
    return prop in target;
  },
};

export function replaceTraps(
  callback: (currentTraps: ProxyHandler<any>) => ProxyHandler<any>,
): void {
  idbProxyTraps = callback(idbProxyTraps);
}

function wrapFunction<T extends Func>(func: T): Function {
  // Due to expected object equality (which is enforced by the caching in `wrap`), we
  // only create one new func per func.

  // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
  if (
    func === IDBDatabase.prototype.transaction &&
    !('objectStoreNames' in IDBTransaction.prototype)
  ) {
    return function (
      this: IDBPDatabase,
      storeNames: string | string[],
      ...args: any[]
    ) {
      const tx = func.call(unwrap(this), storeNames, ...args);
      transactionStoreNamesMap.set(
        tx,
        (storeNames as any).sort ? (storeNames as any[]).sort() : [storeNames],
      );
      return wrap(tx);
    };
  }

  // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
  // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
  // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
  // with real promises, so each advance methods returns a new promise for the cursor object, or
  // undefined if the end of the cursor has been reached.
  if (getCursorAdvanceMethods().includes(func)) {
    return function (this: IDBPCursor, ...args: Parameters<T>) {
      // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
      // the original object.
      func.apply(unwrap(this), args);
      return wrap(cursorRequestMap.get(this)!);
    };
  }

  return function (this: any, ...args: Parameters<T>) {
    // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
    // the original object.
    return wrap(func.apply(unwrap(this), args));
  };
}
