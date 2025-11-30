
export class Database<TStorage, TCollection> {
    protected collections: { [index: string]: TCollection } = {};

    constructor(
        private storage: TStorage
    ) { }

    protected get(name: string): TCollection {
        return this.collections[name];
    }

    protected create<T extends { new(storage: TStorage, name: string): any }>(name: string, BaseCollection: T) {
        const collection = new BaseCollection(this.storage, name);
        this.collections[name] = collection;
        return collection;
    }

    /**
     * 
     * @param name check if the database has a collection by it's name
     * @returns boolean
     */
    public has(name: string) {
        return !!this.get(name);
    }
}

export type EntityId<Type = number> = Type;

export type Entity<T, IdType = number> = T & {
    readonly id: EntityId<IdType>;
};

export interface Existance<T> {
    entity: Entity<T>;
    index: number;
}

export type Constructor = new (...args: any[]) => any;
export type Func = (...args: any[]) => any;

export const instanceOfAny = (
  object: any,
  constructors: Constructor[],
): boolean => constructors.some((c) => object instanceof c);

export const find = <T>(value: any, by: keyof T) => (obj: T) => obj[by] === value;

/**
 * @internal
 * @param items an array of object
 * @param id 
 */
export function isItemExist(items: Entity<any>[], id: EntityId) {
    const index = items.findIndex(find(id, 'id'));
    if (index > -1) {
        return {
            entity: items[index],
            index
        }
    }
    return null;
}

/**
 * Convert the givin value to boolean type
 */
export function not(value: any): value is null | undefined {
    return !!!value;
}

/**
 * Check if the `valus` is `null` or `undefiend`
 */
export function isNullOrUndefiend(value: any): value is null | undefined {
    return value === null || value === undefined;
}
/**
 * returns true if the context is browser
 */
export function isBrowser() {
    return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

export function hasId<T>(value: any): value is Entity<any> {
    return 'id' in value;
}

export function addId<T>(value: T, id?: EntityId | null): asserts value is Entity<T> {
    Object.assign(value as object, { id: id ?? uniqueId() });
}

export function uniqueId() {
    return Date.now() + Math.ceil(Math.sqrt(Math.random()) * 1000);
}

