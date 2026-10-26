import { Service } from '@kinstate/core';
import { filteredRows, type Row } from './model.js';

export class BenchmarkService extends Service {
  count = 0;
  other = 0;
  unrelated = 0;
  active = true;
  nested = { value: 0 };
  rows: Row[] = [];
  records: Record<number, Row> = {};
  get filtered() {
    return filteredRows(this.rows);
  }
}
