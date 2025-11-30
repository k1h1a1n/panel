import { Inject, Injectable } from '@angular/core';
import { catchError, defer, from, map, of, switchMap } from 'rxjs';
import { Entity } from '../indexeddb/indexeddb.utils';
import { AsyncCollection, AsyncDatabase } from '../indexeddb/indexeddb.async';
import { DateUtils } from '../../utils/date';
import { INDEXED_DATABASE } from '../../providers';

@Injectable({
  providedIn: 'root',
})
export class IndexedDBService {
  constructor(
    @Inject(INDEXED_DATABASE) public indexedDatabase: AsyncDatabase
  ) {}

  public getData(collectionName: string, key: string) {
    const collection = this.indexedDatabase.collection(collectionName);
    return from(collection.get((entry) => entry['key'] === key)).pipe(
      switchMap((entry) => {
        if (entry && this.dateElapsed(entry['ttl'] ?? 0)) {
          return this.invalidateCache(collection, entry);
        }
        return of(entry);
      }),
      map((response) => response && response['value']),
      catchError((err) => {
        console.log(err);
        return err;
      })
    );
  }

  public async deleteDataById(collectionName: string, key: string) {
    const collection = this.indexedDatabase.collection(collectionName);

    const data = await collection.get((data) => {
      data = data;
      return data['key'] === key;
    });
    if (data?.id) {
      await collection.delete(data.id);
    }
  }

  public async deleteEntireCollection(collectionName: string): Promise<void> {
    const collection = this.indexedDatabase.collection(collectionName);

    try {
      const allData = await collection.getAll();
      const deletePromises = allData.map((entry: any) =>
        collection.delete(entry.id)
      );
      await Promise.all(deletePromises);
      console.log(`All entries in ${collectionName} deleted.`);
    } catch (error) {
      console.error(`Failed to delete collection ${collectionName}:`, error);
    }
  }

  public getCollection(collectionName: string) {
    const collection = this.indexedDatabase.collection(collectionName);
    return from(collection.getAll()).pipe(
      catchError((err) => {
        console.error('Error fetching collection:', err);
        return of([]); // Return an empty array if there's an error
      })
    );
  }

  public setNewCollectionData(
    collectionName: string,
    key: string,
    value: any,
    ttlFormat?: string
  ) {
    let ttl: number = this.formatTTL(ttlFormat) || 60;
    const newCollection = this.createCollection(collectionName);
    return defer(() => newCollection.set(new IndexedDBEntry(key, value, ttl)));
  }

  private createCollection(
    collectionName: string
  ): AsyncCollection<Entity<IndexedDBEntry>> {
    return this.indexedDatabase.collection(collectionName);
  }

  public async backupAllData(): Promise<Record<string, any[]>> {
    const backupData: Record<string, any[]> = {};
    console.log('Starting IndexedDB backup...');

    try {
      const dbName = 'BrandXpress'; // ensure this has the DB name
      const version = 1;

      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const storeNames = Array.from(db.objectStoreNames);

      for (const storeName of storeNames) {
        const allData: any[] = await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => resolve(getAllRequest.result);
          getAllRequest.onerror = () => reject(getAllRequest.error);
        });
        backupData[storeName] = allData;
      }

      db.close();
      console.log('IndexedDB backup completed:', backupData);
      return backupData;
    } catch (error) {
      console.error('Error creating IndexedDB backup:', error);
      throw error;
    }
  }

  // Entity<Record<string, any>>
  private invalidateCache(
    collection: AsyncCollection<Entity<Record<string, any>>>,
    entry: any
  ) {
    return collection.delete(entry.id).then((_) => null);
  }

  private dateElapsed(date: number) {
    return date < Date.now();
  }
  private formatTTL(localCacheTTL : any) {
    let ttl = 0;
    const ttlDate = new Date();
    let [format, value] = localCacheTTL.split(':');

    try {
      value = parseInt(value);
    } catch (e) {
      value = 1;
    }

    switch (format) {
      case 'DD':
        let _ttlDate = new DateUtils().addCalendarDays(value);
        ttl = new Date(_ttlDate).getTime();
        break;
      case 'HH':
        ttlDate.setHours(ttlDate.getHours() + value);
        ttl = ttlDate.getTime();
        break;
      case 'MM':
        ttlDate.setMinutes(ttlDate.getMinutes() + value);
        ttl = ttlDate.getTime();
        break;
      case 'SS':
        ttlDate.setSeconds(ttlDate.getSeconds() + value);
        ttl = ttlDate.getTime();
        break;
      default:
        ttl = -1;
    }
    return ttl;
  }
}

export class IndexedDBEntry {
  readonly id!: number;

  constructor(public key: string, public value: any, public ttl: any) {}
}
