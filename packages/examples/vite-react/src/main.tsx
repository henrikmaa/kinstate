import { StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ServiceProvider, useService } from '@kinstate/react';
import { CounterService } from './CounterService.js';
import { ReactiveItem, RenderContent } from './ReactiveItem.js';
import './style.css';
import { ExternalStateDemo } from './ExternalStateDemo.js';

// Diagnostic only: count render attempts without scheduling a state update.
function useRenderCount() {
  const counter = useRef(0);
  return ++counter.current;
}
function Count() {
  const service = useService(CounterService);
  const renders = useRenderCount();
  return (
    <section className="readout">
      <h2>
        Count <small data-testid="count-renders">{renders} renders</small>
      </h2>
      <output data-testid="count">{service.count}</output>
      <p>Doubled: {service.doubled}</p>
    </section>
  );
}
function Name() {
  const service = useService(CounterService);
  const renders = useRenderCount();
  return (
    <section className="readout">
      <h2>
        Name <small data-testid="name-renders">{renders} renders</small>
      </h2>
      <output className="name" data-testid="name">
        {service.name}
      </output>
      <p>This component reads only the name.</p>
    </section>
  );
}
function Items() {
  const service = useService(CounterService);
  const renders = useRenderCount();
  return (
    <section className="readout">
      <h2>
        Nested array <small data-testid="items-renders">{renders} renders</small>
      </h2>
      <ul>
        {service.items.map((item) => (
          <li key={item.label}>{item.label}</li>
        ))}
      </ul>
    </section>
  );
}
function Composition() {
  const service = useService(CounterService);
  const renders = useRenderCount();
  return (
    <section className="readout">
      <h2>
        Compiled child props <small data-testid="prop-parent-renders">{renders} renders</small>
      </h2>
      <ReactiveItem item={service.items[0]!} />
      <p>
        Render callback count: <RenderContent>{() => service.count}</RenderContent>
      </p>
      <button
        onClick={() => {
          service.items[0]!.label += '!';
        }}
      >
        Edit first item
      </button>
    </section>
  );
}
function Controls() {
  const service = useService(CounterService);
  return (
    <aside>
      <h2>Change one thing.</h2>
      <p>
        Each readout observes only the properties it reads. Watch its render counter when you change
        another property.
      </p>
      <div className="controls">
        <button onClick={() => service.increment()}>Increment count</button>
        <button onClick={() => service.rename()}>Rename service</button>
        <button onClick={() => service.addItem()}>Add array item</button>
        <button onClick={() => void service.incrementLater()}>Increment after await</button>
      </div>
      <p className="note">
        Strict Mode is enabled. Counters include development render attempts; compare their changes.
      </p>
    </aside>
  );
}
function App() {
  return (
    <ServiceProvider services={[CounterService]}>
      <main>
        <header>
          <a href="https://react.dev/reference/react/useSyncExternalStore">Kinstate</a>
          <h1>
            One service.
            <br />
            Independent updates.
          </h1>
          <p>Ordinary classes. Reactive state.</p>
        </header>
        <div className="lab">
          <Controls />
          <div className="readouts">
            <Count />
            <Name />
            <Items />
            <Composition />
          </div>
        </div>
        <ExternalStateDemo />
        <footer>Try renaming the service. The count and array render counters stay still.</footer>
      </main>
    </ServiceProvider>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
