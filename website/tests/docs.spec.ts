import { test, expect } from '@playwright/test';

test('dark-only docs hydrate, track independent reads, navigate and search', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Ordinary classes. Reactive state.',
  );
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByTestId('demo-count')).toHaveText('0');
  // Wait for hydration by observing an interactive state update, not a timer.
  const nameRenders = await page.getByTestId('name-renders').innerText();
  await page.getByRole('button', { name: 'Increment count' }).click();
  await expect(page.getByTestId('demo-count')).toHaveText('1');
  await expect(page.getByTestId('name-renders')).toHaveText(nameRenders);
  const countRenders = await page.getByTestId('count-renders').innerText();
  await page.getByRole('button', { name: 'Change name', exact: true }).click();
  await expect(page.getByTestId('demo-name')).toHaveText('Grace');
  await expect(page.getByTestId('count-renders')).toHaveText(countRenders);
  await page.getByRole('link', { name: 'Get started', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Quick start/i);
  await expect(page).toHaveURL(/\/guide\/quick-start/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Quick start/i);
  // Search also has to work from a project-path deployment.
  await page.keyboard.press('Control+k');
  const search = page.getByRole('textbox', { name: 'SearchPanelInput' });
  await expect(search).toBeVisible();
  await search.fill('callbacks');
  await expect(page.locator('.rp-search-panel__modal').getByRole('link').first()).toBeVisible();
  await expect(page.locator('.rp-search-panel__modal')).toContainText(/callback/i);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('mobile navigation, root-safe assets and dark mode ignore saved light preference', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('rspress-theme-appearance', 'light'));
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Increment count' }).click();
  await expect(page.getByTestId('demo-count')).toHaveText('1');
  expect(
    await page
      .locator('.rp-doc-layout__doc')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.goto('./guide/external-state');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /menu/i }).first().click();
  await expect(
    page.getByRole('link', { name: 'Computed state', exact: true }).first(),
  ).toBeVisible();
  expect(failures).toEqual([]);
});
