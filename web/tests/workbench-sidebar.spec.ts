import type { Repo } from '../../shared/api';
import { test, expect, repos } from './fixtures';

/** A repository with no recent activity and no open backlog: one the sidebar lists as inactive. */
const stale = (key: string): Repo => ({
  ...repos[0],
  key,
  name: key.slice(key.indexOf('/') + 1),
  nameWithOwner: key,
  url: `https://github.com/${key}`,
  lastActivityAt: '2025-01-01T00:00:00Z',
  pushedAt: '2025-01-01T00:00:00Z',
  stats: { ...repos[0].stats, openPrs: 0, openIssues: 0, mergedPrs30d: 0, commits30d: 0, newStars30d: 0, weeklyCommits: Array(12).fill(0) },
});

test('selected inactive repositories stay visible while the inactive section is collapsed', async ({ page }) => {
  await page.route('**/api/v1/repos', (route) =>
    route.fulfill({ json: { items: [...repos, stale('owner/old-one'), stale('owner/old-two')] } }));
  await page.goto('/prs?source=github.com');
  const sidebar = page.getByRole('complementary', { name: 'Repository scope' });
  const toggle = sidebar.locator('button.side-more');
  const oldOne = sidebar.getByRole('button', { name: 'Filter to old-one' });
  const oldTwo = sidebar.getByRole('button', { name: 'Filter to old-two' });

  // Collapsed: both inactive repositories are in the default selection, so both stay listed.
  await expect(toggle).toHaveText('Show 2 inactive');
  await expect(oldOne).toBeVisible();
  await expect(oldTwo).toBeVisible();

  // Unselect one: collapsed, only the selected repository remains visible.
  // The row unmounts on deselection, so click and assert the row is gone instead of waiting
  // on the checkbox's own state.
  await sidebar.getByRole('checkbox', { name: 'Include old-two' }).click();
  await expect(oldTwo).toHaveCount(0);
  await expect(oldOne).toBeVisible();

  // Expanding lists every inactive repository again; collapsing keeps the selected one.
  await toggle.click();
  await expect(toggle).toHaveText('Hide 2 inactive');
  await expect(oldTwo).toBeVisible();
  await toggle.click();
  await expect(oldTwo).toHaveCount(0);
  await expect(oldOne).toBeVisible();
});

test('the collapsed inactive section lists up to the limit of selected repositories', async ({ page }) => {
  await page.route('**/api/v1/repos', (route) =>
    route.fulfill({ json: { items: [...repos, stale('owner/old-one'), stale('owner/old-two'), stale('owner/old-three'), stale('owner/old-four')] } }));
  await page.goto('/prs?source=github.com');
  const sidebar = page.getByRole('complementary', { name: 'Repository scope' });
  const toggle = sidebar.locator('button.side-more');
  const row = (name: string) => sidebar.getByRole('button', { name: `Filter to ${name}` });

  // Four selected inactive repositories are over the limit of 3: collapsed shows only the toggle.
  await expect(toggle).toHaveText('Show 4 inactive');
  await expect(row('old-one')).toHaveCount(0);
  await expect(row('old-two')).toHaveCount(0);
  await expect(row('old-three')).toHaveCount(0);
  await expect(row('old-four')).toHaveCount(0);

  // The rows only exist while expanded, so deselect there: three selected is the limit itself,
  // and the limit is inclusive, so all three are listed while collapsed.
  await toggle.click();
  await expect(row('old-four')).toBeVisible();
  await sidebar.getByRole('checkbox', { name: 'Include old-four' }).click();
  await toggle.click();
  await expect(toggle).toHaveText('Show 4 inactive');
  await expect(row('old-one')).toBeVisible();
  await expect(row('old-two')).toBeVisible();
  await expect(row('old-three')).toBeVisible();
  await expect(row('old-four')).toHaveCount(0);

  // Expanding lists every inactive repository regardless of the limit.
  await toggle.click();
  await expect(toggle).toHaveText('Hide 4 inactive');
  await expect(row('old-four')).toBeVisible();
});

test('the collapsed inactive limit is configurable in Settings', async ({ page }) => {
  const settings: Record<string, unknown> = { syncIntervalMinutes: 30, backfillDays: 365, myEmails: [], includeForks: false, collapsedInactiveLimit: 3, diffCacheMb: 200 };
  await page.route('**/api/v1/settings', async (route) => {
    if (route.request().method() === 'PATCH') Object.assign(settings, await route.request().postDataJSON());
    await route.fulfill({ json: settings });
  });
  await page.route('**/api/v1/repos', (route) =>
    route.fulfill({ json: { items: [...repos, stale('owner/old-one'), stale('owner/old-two')] } }));
  const sidebar = page.getByRole('complementary', { name: 'Repository scope' });
  const toggle = sidebar.locator('button.side-more');
  const oldOne = sidebar.getByRole('button', { name: 'Filter to old-one' });

  // Two selected inactive repositories: listed at the default limit of 3.
  await page.goto('/prs?source=github.com');
  await expect(toggle).toHaveText('Show 2 inactive');
  await expect(oldOne).toBeVisible();

  // Setting the limit to 0 stops listing them while collapsed; expanding still shows them.
  await page.goto('/settings');
  await page.getByRole('spinbutton', { name: /Sidebar inactive limit/ }).fill('0');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.goto('/prs?source=github.com');
  await expect(toggle).toHaveText('Show 2 inactive');
  await expect(oldOne).toHaveCount(0);
  await toggle.click();
  await expect(oldOne).toBeVisible();
});
