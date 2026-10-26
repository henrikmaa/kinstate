/** Dense intrinsic reversal can avoid observable proxy reads/writes entirely. */
const reverse = Array.prototype.reverse;

function ordinaryData(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    !!descriptor &&
    'value' in descriptor &&
    descriptor.writable === true &&
    descriptor.configurable === true &&
    descriptor.enumerable === true
  );
}

/** Undefined requests native proxy fallback; false proves a dense palindrome. */
function inspectDenseReverse(
  target: unknown[],
  unchangedRepresentation: (value: unknown) => boolean,
): boolean | undefined {
  if (Object.getPrototypeOf(target) !== Array.prototype || !Object.isExtensible(target)) return;
  const length = Object.getOwnPropertyDescriptor(target, 'length');
  if (
    !length ||
    !('value' in length) ||
    !length.writable ||
    length.configurable ||
    length.enumerable
  )
    return;
  const size = length.value as number;
  let changed = false;
  for (let low = 0, high = size - 1; low <= high; low++, high--) {
    const first = Object.getOwnPropertyDescriptor(target, String(low));
    if (!ordinaryData(first) || !unchangedRepresentation(first.value)) return;
    if (low === high) continue;
    const last = Object.getOwnPropertyDescriptor(target, String(high));
    if (!ordinaryData(last) || !unchangedRepresentation(last.value)) return;
    if (!Object.is(first.value, last.value)) changed = true;
  }
  return changed;
}

/** Preserve intrinsic function metadata, nonconstructibility and foreign receivers. */
export function createArrayReverse(
  target: unknown[],
  receiver: object,
  method: unknown,
  collecting: () => boolean,
  unchangedRepresentation: (value: unknown) => boolean,
  mutate: (reverse: () => void) => void,
  ownedShapeVersion?: () => number,
): Function | undefined {
  if (method !== reverse) return;
  let provedVersion: number | undefined;
  return new Proxy(reverse, {
    apply(native, thisArgument, argumentsList) {
      if (thisArgument !== receiver || collecting())
        return Reflect.apply(native, thisArgument, argumentsList);
      const version = ownedShapeVersion?.();
      let changed: boolean | undefined;
      if (
        version !== undefined &&
        version === provedVersion &&
        Object.getPrototypeOf(target) === Array.prototype &&
        Object.isExtensible(target)
      ) {
        // Only owned arrays may reuse the descriptor proof: all changes to their
        // storage pass through canonical traps that advance this shape version.
        changed = false;
        for (let low = 0, high = target.length - 1; low < high; low++, high--) {
          if (!Object.is(target[low], target[high])) {
            changed = true;
            break;
          }
        }
      } else {
        changed = inspectDenseReverse(target, unchangedRepresentation);
        provedVersion = changed === undefined ? undefined : version;
      }
      if (changed === undefined) return Reflect.apply(native, receiver, argumentsList);
      if (changed)
        mutate(() => {
          Reflect.apply(native, target, argumentsList);
        });
      return receiver;
    },
  });
}
