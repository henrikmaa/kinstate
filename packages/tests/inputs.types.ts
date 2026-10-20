import { Service, serviceInputs } from '@kinstate/core';

class TypedInputs extends Service {
  user: Readonly<{ name: string }> | undefined = undefined;
  loading = false;
  onSave: ((name: string) => Promise<string>) | undefined = undefined;
  get label() {
    return this.user?.name ?? '';
  }
  edit(value: string) {
    return value;
  }
}

serviceInputs(TypedInputs, { user: { name: 'Ada' }, loading: true });
serviceInputs(TypedInputs, { user: undefined });
serviceInputs(TypedInputs, {});
// @ts-expect-error Input values must match the service field type.
serviceInputs(TypedInputs, { loading: 'yes' });
// @ts-expect-error Unknown fields are rejected.
serviceInputs(TypedInputs, { missing: true });
serviceInputs(TypedInputs, { onSave: async (name) => name.toUpperCase() });
serviceInputs(TypedInputs, { onSave: undefined });
// TypeScript models methods and callable data fields alike; own-field runtime validation rejects prototype methods.
// @ts-expect-error Callback parameters must match the declared signature.
serviceInputs(TypedInputs, { onSave: async (value: number) => String(value) });
// @ts-expect-error Callback return types must match the declared signature.
serviceInputs(TypedInputs, { onSave: (name: string) => name });
// @ts-expect-error Readonly computed getters cannot be assigned as inputs.
serviceInputs(TypedInputs, { label: 'Ada' });
