import { Service } from '@kinstate/core';

export interface ExternalData {
  readonly name: string;
}

export class ExternalService extends Service {
  data: ExternalData | undefined = undefined;
  loading = false;
  draft = '';
  onPublish: ((draft: string) => void) | undefined = undefined;

  setDraft(value: string) {
    this.draft = value;
  }

  publish() {
    this.onPublish?.(this.draft);
  }

  get caption() {
    return this.loading ? 'Loading…' : (this.data?.name ?? 'No data');
  }
}
