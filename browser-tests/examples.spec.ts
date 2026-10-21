import { test, expect } from '@playwright/test';
test('Vite independent render counters and nested array updates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4273');
  const nameBefore = await page.getByTestId('name-renders').textContent();
  const itemsBefore = await page.getByTestId('items-renders').textContent();
  await page.getByRole('button', { name: 'Increment count', exact: true }).click();
  await expect(page.getByTestId('count')).toHaveText('1');
  await expect(page.getByTestId('name-renders')).toHaveText(nameBefore!);
  await expect(page.getByTestId('items-renders')).toHaveText(itemsBefore!);
  const countBefore = await page.getByTestId('count-renders').textContent();
  await page.getByRole('button', { name: 'Rename service' }).click();
  await expect(page.getByTestId('name')).toHaveText('Renamed');
  await expect(page.getByTestId('count-renders')).toHaveText(countBefore!);
  await page.getByRole('button', { name: 'Add array item' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Increment after await' }).click();
  await expect(page.getByTestId('count')).toHaveText('2');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('Next.js request initial state hydrates and remains isolated', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:4274');
  await expect(page.getByTestId('count')).toHaveText('7');
  await expect(page.getByTestId('name-renders')).not.toHaveText('');
  const nameRenders = await page.getByTestId('name-renders').textContent();
  await page.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(page.getByTestId('count')).toHaveText('8');
  await expect(page.getByTestId('name-renders')).toHaveText(nameRenders!);
  const countRenders = await page.getByTestId('count-renders').textContent();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(page.getByTestId('name')).toHaveText('Renamed');
  await expect(page.getByTestId('count-renders')).toHaveText(countRenders!);
  const second = await browser.newPage();
  try {
    await second.goto('http://127.0.0.1:4274');
    await expect(second.getByTestId('count')).toHaveText('7');
  } finally {
    await second.close();
  }
  expect(errors).toEqual([]);
});

test('generic external state and callbacks update a service while preserving its local draft', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4273');
  await expect(page.getByTestId('external-caption')).toHaveText('Ada');
  await page.getByRole('textbox', { name: 'Local draft' }).fill('Keep my edit');
  await page.getByRole('button', { name: 'Send draft through callback' }).click();
  await expect(page.getByTestId('external-published')).toHaveText('Keep my edit (Ada)');
  await page.getByRole('button', { name: 'Publish external data' }).click();
  await expect(page.getByTestId('external-caption')).toHaveText('Grace');
  await page.getByRole('button', { name: 'Send draft through callback' }).click();
  await expect(page.getByTestId('external-published')).toHaveText('Keep my edit (Grace)');
  await expect(page.getByRole('textbox', { name: 'Local draft' })).toHaveValue('Keep my edit');
  await page.getByRole('button', { name: 'Toggle external loading' }).click();
  await expect(page.getByTestId('external-caption')).toHaveText('Loading…');
  await page.getByRole('button', { name: 'Toggle external loading' }).click();
  await expect(page.getByTestId('external-caption')).toHaveText('Grace');
  expect(errors).toEqual([]);
});

test('compiled cross-module props and render callbacks subscribe in the receiving child', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4273');
  const parent = await page.getByTestId('prop-parent-renders').textContent();
  const child = await page.getByTestId('prop-child-renders').textContent();
  await page.getByRole('button', { name: 'Edit first item', exact: true }).click();
  await expect(page.getByTestId('prop-item')).toHaveText('First item!');
  await expect(page.getByTestId('prop-parent-renders')).toHaveText(parent!);
  await expect(page.getByTestId('prop-child-renders')).not.toHaveText(child!);
  const updatedChild = await page.getByTestId('prop-child-renders').textContent();
  await page.getByRole('button', { name: 'Increment count', exact: true }).click();
  await expect(page.getByTestId('render-content')).toHaveText('1');
  await expect(page.getByTestId('prop-parent-renders')).toHaveText(parent!);
  await expect(page.getByTestId('prop-child-renders')).toHaveText(updatedChild!);
  expect(errors).toEqual([]);
});
