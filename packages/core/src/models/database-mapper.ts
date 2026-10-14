type Camel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<Camel<Tail>>}`
  : S;
export type DatabaseModel<T> = T extends (infer Item)[]
  ? DatabaseModel<Item>[]
  : T extends object
    ? { [Key in keyof T as Key extends string ? Camel<Key> : Key]: DatabaseModel<T[Key]> }
    : T;

/** Explicit boundary mapper for .NET's unchanged database JSON, never for requests/payment sessions. */
export function mapDatabaseJson<T>(value: T): DatabaseModel<T> {
  if (Array.isArray(value)) return value.map(mapDatabaseJson) as DatabaseModel<T>;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase()),
        mapDatabaseJson(item),
      ]),
    ) as DatabaseModel<T>;
  }
  return value as DatabaseModel<T>;
}
