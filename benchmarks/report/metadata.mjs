export const descriptions = {
  'persist-json':
    'Edit one row, then serialize the same canonical {count, rows} projection and synchronously write it to localStorage. Every adapter uses the same harness-owned JSON/storage path; quota preflight is excluded and final persisted contents are verified.',
  'reactive-prop-row':
    'Pass a live row into a compiled receiving child (Kinstate), an observer child (MobX), an immutable row prop (Zustand), or a scoped snapshot child (Valtio). Count both parent and child render calls; edit one visible row.',
  'memo-filter':
    'Memoized filter/sort presentation with one consumer. Kinstate uses authored React useMemo reading live rows; MobX uses its tracked computed getter before React memoization, and immutable adapters cache by row-array identity. Same sorting/projection and output, idiomatic dependency ownership.',
  'memo-local-render':
    'Force 100 consumer renders through a changing React prop while service inputs remain unchanged. Compare component-local memo cache hits and cached dependency replay; all use React useMemo.',
  'immutable-input-filter':
    'Filter/sort newly published immutable API payloads. The source only replaces its collection. Kinstate serviceInputs copies plain data into service-owned reactive state; MobX observable.ref, Valtio ref and Zustand retain replacement-only storage. Includes payload allocation, adoption and filtering/sorting. Ownership costs differ; historical borrowed-input Kinstate timings are incompatible.',
  'api-payload':
    'Create a fresh plain incoming payload without reading existing reactive rows, then assign it. Includes identical payload allocation and library-specific adoption costs.',
  'api-frozen':
    "Create a deeply frozen incoming row payload and assign it. Includes identical source allocation/freezing and each library's ownership and adoption costs.",
  'array-remove': 'Remove the last row and observe collection length.',
  'array-reorder': 'Reverse the array while 100 consumers observe their current row index.',
  'bulk-rows-100':
    'Edit 100 distinct row values in one logical transaction. Each library publishes one batch; Zustand copies the array once.',
  'record-churn':
    'Insert and delete a transient record key within one transaction; visible state remains unchanged. Heap retention is tested separately.',
  'no-op':
    'Assign the current value back to itself. Measures the equality-check and scheduling floor without a state change.',
  'full-list-row':
    'Mount one DOM consumer for every record, then edit one row. Collection size equals mounted consumer count; no virtualization.',
  unrelated: 'Change an unobserved field while every mounted consumer observes another field.',
  'single-field': 'Update a primitive field observed by one mounted consumer.',
  'shared-fanout': 'Update one shared field observed by all consumers.',
  conditional:
    'Alternate branch switches, writes to the inactive branch, and writes to the active branch, exercising dependency replacement.',
  'nested-field': 'Update one field inside a nested object.',
  'batch-100': 'Perform 100 synchronous field mutations in each scheduled operation.',
  'array-visible-row': 'Edit a row rendered by the mounted list consumers.',
  'array-offscreen-row':
    'Edit a row outside the mounted consumer window; no virtualization library is involved.',
  'normalized-row': 'Edit one record addressed by its key in normalized state.',
  append: 'Append a record to the collection.',
  'map-and-replace':
    'Map the existing reactive array into fresh row objects, change the first value, and replace the array. Includes reading observable rows and allocating/reobserving the replacement; this is not a plain incoming API payload assignment.',
  'filter-sort':
    'Promote one source row, filter and sort the collection into its top 100 entries, and render the first result in one consumer.',
  'parent-rerender':
    'Rerender the parent, including the service provider, while memoized consumers retain unchanged props and state. Measures memo bailout overhead.',
};
export const workloadLabels = {
  'persist-json': 'Edit and persist JSON',
  'reactive-prop-row': 'Edit a row passed to a child',
  'memo-filter': 'Memoize filter/sort presentation',
  'memo-local-render': 'Rerender memoized presentation',
  'immutable-input-filter': 'Filter replaced API payloads',
  'api-payload': 'Assign incoming API data',
  'api-frozen': 'Assign frozen API data',
  'array-remove': 'Remove an array row',
  'array-reorder': 'Reorder the array',
  'bulk-rows-100': 'Batch 100 row edits',
  'record-churn': 'Insert and delete record keys',
  'no-op': 'Same-value assignment',
  'full-list-row': 'Edit a row in a full list',
  unrelated: 'Change unobserved state',
  'single-field': 'Update one field',
  'shared-fanout': 'One field, 100 readers',
  conditional: 'Switch conditional dependencies',
  'nested-field': 'Edit a nested object',
  'batch-100': 'Batch 100 changes',
  'array-visible-row': 'Edit a visible array row',
  'array-offscreen-row': 'Edit an offscreen row',
  'normalized-row': 'Edit a record by ID',
  append: 'Append to an array',
  'map-and-replace': 'Map and replace the array',
  'filter-sort': 'Filter and sort data',
  'parent-rerender': 'Update local parent state',
};
export const labels = {
  kinstate: 'Kinstate',
  // Historical measurements retain their original identifier and timestamps.
  'react-service': 'Kinstate',
  mobx: 'MobX',
  zustand: 'Zustand',
  valtio: 'Valtio',
};
