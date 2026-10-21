import { Service } from '@kinstate/core';
export class CounterService extends Service {
  count = 0;
  name = 'Server-initialized counter';
  increment() { this.count++; }
  rename() { this.name = 'Renamed'; }
  get doubled() { return this.count * 2; }
}
