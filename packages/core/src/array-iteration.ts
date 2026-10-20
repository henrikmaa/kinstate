/** Native algorithms keep their species, holes, callback and mutation semantics.
 * A transient view coalesces index reads into one sequence dependency while
 * delegating other reads and accessors to the canonical reactive receiver.
 */
const filter = Array.prototype.filter;
const map = Array.prototype.map;
export function isArrayIndex(key: PropertyKey): key is string {
  if (typeof key !== 'string') return false;
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < 4294967295 && String(index) === key;
}

export function createArrayIteration(
  target: unknown[],
  receiver: object,
  method: unknown,
  readIndex: (key: string) => unknown,
  readSequence: () => void,
): Function | undefined {
  if (typeof method !== 'function' || (method !== filter && method !== map)) return;
  return new Proxy(method, {
    apply(native, thisArgument, argumentsList) {
      if (thisArgument !== receiver) return Reflect.apply(native, thisArgument, argumentsList);
      const [callback, callbackThis] = argumentsList;
      if (typeof callback !== 'function') return Reflect.apply(native, receiver, argumentsList);
      readSequence();
      const view = new Proxy(target, {
        get(_target, key) {
          return isArrayIndex(key) ? readIndex(key) : Reflect.get(receiver, key);
        },
        has(_target, key) {
          return Reflect.has(target, key);
        },
      });
      return Reflect.apply(native, view, [
        (value: unknown, index: number) =>
          Reflect.apply(callback, callbackThis, [value, index, receiver]),
      ]);
    },
  });
}
