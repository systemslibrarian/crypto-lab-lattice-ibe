import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#app')).toHaveCount(1);
  await expect(page.locator('[role="banner"]')).toHaveCount(1);
  await expect(page.locator('.cl-hero-why')).toHaveCount(1);
  await expect(page.locator('#results')).toBeVisible();
}

for (const viewport of [
  { width: 1280, height: 900, label: 'desktop' },
  { width: 380, height: 812, label: 'mobile' },
  { width: 280, height: 720, label: 'narrow reflow' },
]) {
  test(`has no WCAG A/AA violations or page overflow at ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await page.locator('details').click();
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(scan.violations).toEqual([]);
    const dimensions = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.root).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test('supports keyboard navigation, activation, and visible focus', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Tab');
  const skip = page.locator('.cl-skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#app')).toBeFocused();

  await page.locator('#identity').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('keyboard@example.edu');
  await expect(page.locator('#results')).toBeHidden();
  await page.getByRole('button', { name: 'Run the complete profile' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#run-status')).toContainText('Fresh result for keyboard@example.edu');
  const outline = await page.getByRole('button', { name: 'Run the complete profile' })
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');

  const trapdoorSummary = page.getByText('Omniscient teaching view: master trapdoor T');
  await trapdoorSummary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details')).toHaveAttribute('open', '');
  await expect(trapdoorSummary).toBeFocused();
  const scrollRegions = page.locator('.table-wrap, pre[tabindex="0"]');
  await expect(scrollRegions).toHaveCount(5);
  for (let index = 0; index < await scrollRegions.count(); index += 1) {
    const region = scrollRegions.nth(index);
    await region.focus();
    await expect(region).toBeFocused();
    await expect(region).toHaveAttribute('role', 'region');
    await expect(region).toHaveAttribute('aria-label', /\S+/);
  }
});

test('keeps the named error state accessible', async ({ page }) => {
  await ready(page);
  await page.locator('#identity').fill('contains a space');
  await page.getByRole('button', { name: 'Run the complete profile' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-result-state', 'error');
  await expect(page.locator('#run-status')).toContainText('IDENTITY_FORMAT');
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
});
