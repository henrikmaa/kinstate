import { useRef } from 'react';
import { Service } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

class CounterService extends Service {
  count = 0;
  name = 'Ada';
  increment() {
    this.count++;
  }
  rename() {
    this.name = this.name === 'Ada' ? 'Grace' : 'Ada';
  }
  get doubled() {
    return this.count * 2;
  }
}

function CountPanel() {
  const service = useService(CounterService);
  const renders = useRef(0);
  renders.current++;
  return (
    <div className="demo-panel" data-testid="count-panel">
      <div className="demo-panel-heading">
        <span>Count</span>
        <span className="render-count" data-testid="count-renders">
          {renders.current} renders
        </span>
      </div>
      <output data-testid="demo-count">{service.count}</output>
      <span className="demo-detail">doubled: {service.doubled}</span>
    </div>
  );
}
function NamePanel() {
  const service = useService(CounterService);
  const renders = useRef(0);
  renders.current++;
  return (
    <div className="demo-panel" data-testid="name-panel">
      <div className="demo-panel-heading">
        <span>Name</span>
        <span className="render-count" data-testid="name-renders">
          {renders.current} renders
        </span>
      </div>
      <output data-testid="demo-name">{service.name}</output>
      <span className="demo-detail">an independent reader</span>
    </div>
  );
}
function Commands() {
  const service = useService(CounterService);
  return (
    <div className="demo-commands">
      <button type="button" onClick={() => service.increment()}>
        Increment count <span aria-hidden="true">+</span>
      </button>
      <button type="button" onClick={() => service.rename()}>
        Change name
      </button>
    </div>
  );
}

export function SelectiveDemo() {
  return (
    <ServiceProvider services={[CounterService]}>
      <section className="selective-demo" aria-label="Live fine-grained reactivity example">
        <div className="demo-caption">
          <span className="live-indicator" aria-hidden="true" />
          Live example <span>One service, two consumers</span>
        </div>
        <div className="demo-panels">
          <CountPanel />
          <NamePanel />
        </div>
        <Commands />
        <p className="demo-footnote">Change one field. Watch only its reader render.</p>
      </section>
    </ServiceProvider>
  );
}
