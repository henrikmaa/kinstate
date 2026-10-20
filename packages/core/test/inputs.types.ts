import { Service, dependencies, serviceInputs } from '../src/index.js';
class Data extends Service {
  value = 0;
  maybe?: string;
  empty = null;
  items: string[] = [];
  optionalNumber: number | undefined = undefined;
  readonly fixed = 1;
  private secret = '';
  get doubled() {
    return this.value * 2;
  }
  increment() {}
  onSave: ((name: string) => Promise<number>) | undefined = undefined;
  requiredCallback = (name: string): number => name.length;
}
serviceInputs(Data, { value: 2, maybe: undefined });
serviceInputs(Data, { empty: null });
serviceInputs(Data, { items: ['one', 'two'], optionalNumber: undefined });
const incomingItems = { items: ['one'] };
serviceInputs(Data, incomingItems);
// @ts-expect-error Explicit undefined cannot replace a non-nullable number field.
serviceInputs(Data, { value: undefined });
// @ts-expect-error Wrong value type.
serviceInputs(Data, { value: 'wrong' });
// @ts-expect-error Unknown state field.
serviceInputs(Data, { unknown: 1 });
// @ts-expect-error Readonly fields cannot be inputs.
serviceInputs(Data, { fixed: 2 });
// @ts-expect-error Getters cannot be inputs.
serviceInputs(Data, { doubled: 2 });
// Callable properties and methods are structurally identical; prototype methods are rejected at runtime.
serviceInputs(Data, { increment() {} });
serviceInputs(Data, { onSave: async (name: string) => name.length });
serviceInputs(Data, {
  onSave: (name) => {
    // @ts-expect-error Callback parameter is string, not any.
    name.notAStringMethod();
    return Promise.resolve(name.toUpperCase().length);
  },
});
serviceInputs(Data, { onSave: undefined, requiredCallback: (name) => name.length });
// @ts-expect-error Callback arguments must match.
serviceInputs(Data, { onSave: async (name: number) => name });
// @ts-expect-error Callback results must match.
serviceInputs(Data, { onSave: async () => 'wrong' });
// @ts-expect-error Nonoptional callback cannot be cleared.
serviceInputs(Data, { requiredCallback: undefined });
// @ts-expect-error Lifecycle hooks cannot be supplied.
serviceInputs(Data, { onInit() {} });
// @ts-expect-error Private fields cannot be inputs.
serviceInputs(Data, { secret: '' });
class NeedsData extends Service {
  static inject = dependencies(Data);
  constructor(readonly data: Data) {
    super();
  }
  value = 0;
}
serviceInputs(NeedsData, { value: 1 });
class Missing extends Service {
  constructor(readonly data: Data) {
    super();
  }
}
// @ts-expect-error Required constructor arguments require typed injection.
serviceInputs(Missing, {});
