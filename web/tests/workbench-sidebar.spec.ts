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
