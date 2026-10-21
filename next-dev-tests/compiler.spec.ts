import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('SWC development hydration, selective updates and Fast Refresh retain service state', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('count')).toHaveText('7');
  await expect(page.getByTestId('name-renders')).not.toHaveText('');
  const nameRenders = await page.getByTestId('name-renders').textContent();
  await page.getByRole('button', { name: 'Increment', exact: true }).click();
  await expect(page.getByTestId('count')).toHaveText('8');
  await expect(page.getByTestId('name-renders')).toHaveText(nameRenders!);

  const filename = fileURLToPath(
    new URL('../packages/examples/nextjs/app/Counter.tsx', import.meta.url),
  );
  const original = await readFile(filename, 'utf8');
  try {
    expect(original).toContain('Count renders:');
    await writeFile(filename, original.replace('Count renders:', 'Counter renders:'));
    await expect(page.getByText('Counter renders:', { exact: false })).toBeVisible();
    await expect(page.getByTestId('count')).toHaveText('8');
    await page.getByRole('button', { name: 'Increment', exact: true }).click();
    await expect(page.getByTestId('count')).toHaveText('9');
  } finally {
    await writeFile(filename, original);
    await expect(page.getByText('Count renders:', { exact: false })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
