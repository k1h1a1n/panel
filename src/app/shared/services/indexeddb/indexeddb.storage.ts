import { IAsyncStorage } from './indexeddb.async';
import { IDBPDatabase, openDB, IDBPTransaction } from './indexeddb.core';

export class IndexedDB<T> implements IAsyncStorage<T> {
    private database: IDBPDatabase | null = null;

    constructor(
        private objectStoreName: string,
        private databaseName: string = 'DeafultAppDatabase',
        private keyPath: string = 'cacheKey',
        private version = 1
    ) { }

    private async openDatabase(version = this.version, force = false) {
        if (!force && this.database) {
            return this.database;
        }
        this.database = await openDB(this.databaseName, version, { upgrade: this.onUpgrade.bind(this) });

        return this.database;
    }

    private onUpgrade(database: IDBPDatabase, oldVersion: number, newVersion: number, transaction: IDBPTransaction<any, string[], 'versionchange'>) {
        if (!database.objectStoreNames.contains(this.objectStoreName)) {
            database.createObjectStore(this.objectStoreName, { keyPath: this.keyPath });
        }
    }

    private async transaction() {
        let database : IDBPDatabase | null = null;
        try {
            database = await this.openDatabase();
        } 
        catch (error) {
            // TODO: if object store not exist an DOMException will thrown, this should be handled gracefully
            database = await this.openDatabase(this.database ? this.database.version + 1 : 1, true);
        }
        return database.transaction(this.objectStoreName, 'readwrite');
    }

    private async objectStore() {
        let transaction = await this.transaction();
        return transaction.objectStore(this.objectStoreName);
    }

    public async set(cacheKey: string, cacheValue: any) {
        const store = await this.objectStore();
        const list = await store.getAll();
        try{
            const document = list.find(doc => doc.cacheKey === cacheKey);
            if (!!document) {
                document.cacheValue = clone(cacheValue);
                return store.put(document) as unknown as Promise<void>;
            } else {
                return store.add({ cacheKey, cacheValue: clone(cacheValue) }) as unknown as Promise<void>;
            }
        }
        catch(err){
            return store.add({ cacheKey, cacheValue: clone(cacheValue) }) as unknown as Promise<void>;
        }
    }

    public async get(cacheKey: string) {
        const store = await this.objectStore();
        const list = await store.getAll();
        try{
            const document = list.find(doc => doc.cacheKey === cacheKey);
            return document && clone(document.cacheValue);
        }
        catch(err){
            return null;
        }
    }

    public async clear() {
        return (await this.objectStore()).clear();
    }

}

function clone<T>(target: T) {
    return JSON.parse(JSON.stringify(target));
}