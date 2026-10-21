import { useCallback, useState } from 'react';
import { serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
import { ExternalService } from './ExternalService.js';

function ExternalDisplay() {
  const service = useService(ExternalService);
  return (
    <section className="readout external-readout">
      <h2>Service state</h2>
      <output className="name" data-testid="external-caption">
        {service.caption}
      </output>
      <label>
        Local draft{' '}
        <input
          aria-label="Local draft"
          value={service.draft}
          onChange={(event) => {
            service.setDraft(event.target.value);
          }}
        />
      </label>
      <button onClick={() => service.publish()} disabled={!service.onPublish}>
        Send draft through callback
      </button>
      <p>The draft belongs to the service and survives external data updates.</p>
    </section>
  );
}

/** Swap these local-state values for props, context, or values from another hook. */
export function ExternalStateDemo() {
  const [data, setData] = useState({ name: 'Ada' });
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState('Nothing published yet');
  const onPublish = useCallback(
    (draft: string) => {
      setPublished(`${draft} (${data.name})`);
    },
    [data.name],
  );
  return (
    <section className="external-demo">
      <h2>Bring your own state</h2>
      <p>
        These values come from React useState. A query hook, context, or another library can supply
        the same ordinary values and callbacks.
      </p>
      <div className="lab">
        <div className="controls">
          <button
            onClick={() =>
              setData((current) => ({ name: current.name === 'Ada' ? 'Grace' : 'Ada' }))
            }
          >
            Publish external data
          </button>
          <button onClick={() => setLoading((current) => !current)}>Toggle external loading</button>
          <p data-testid="external-published" role="status">
            {published}
          </p>
        </div>
        <ServiceProvider services={[serviceInputs(ExternalService, { data, loading, onPublish })]}>
          <ExternalDisplay />
        </ServiceProvider>
      </div>
    </section>
  );
}
