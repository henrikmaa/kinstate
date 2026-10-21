import { Service } from '@kinstate/core';
export class CounterService extends Service {
  count = 0;
  name = 'Counter';
  items = [{ label: 'First item' }];
  get doubled() {
    return this.count * 2;
  }
  increment() {
    this.count++;
  }
  rename() {
    this.name = this.name === 'Counter' ? 'Renamed' : 'Counter';
  }
  editFirstItem() {
    if (this.items[0]) this.items[0].label += '!';
  }
  addItem() {
    this.items.push({ label: `Item ${this.items.length + 1}` });
  }
  async incrementLater() {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.increment();
  }
}
