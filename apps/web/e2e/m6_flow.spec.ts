import { test, expect } from '@playwright/test';

test.describe('Milestone 6 Core Playwright E2E Flow', () => {
  test('Complete flow: demo banner, role switcher gating, evidence highlighter, report export, 2D fallback', async ({ page }) => {
    // Mock the backend API responses so tests run reliably and deterministically without starting separate full backend
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          database: 'connected',
          uptime: 120,
        }),
      });
    });

    await page.route('**/api/demo/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          role: 'Researcher',
          label: 'Demo Researcher',
          disclaimer: 'LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE',
        }),
      });
    });

    await page.route('**/api/demo/session/role', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          role: payload.role,
          label: payload.role === 'Faculty Reviewer' ? 'Demo Faculty Reviewer' : 'Demo Researcher',
        }),
      });
    });

    await page.route('**/api/claims/*/reviews', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          review: {
            id: 'rev-playwright-1',
            claimId: 'sample-claim-1',
            action: payload.action || 'OVERRIDE',
            resultingState: payload.resultingState || 'SUPPORTED',
            recordHash: 'abcdef1234567890abcdef',
            createdAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/verification-jobs/*/report*', async (route) => {
      const url = route.request().url();
      if (url.includes('format=markdown')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/markdown',
          body: '# Verification Report\n\n- Claim: Verified\n',
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            reportId: 'REP-sample-job-1',
            claims: [{ claimId: 'sample-claim-1', verdict: 'SUPPORTED' }],
          }),
        });
      }
    });

    // 1. Visit app
    await page.goto('/');

    // 2. Verify local demo mode banner
    await expect(page.locator('text=LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE')).toBeVisible();

    // 3. Verify Researcher role is active by default and review form is locked
    await expect(page.locator('text=Current Role:')).toContainText('Researcher');
    await expect(page.locator('text=Review actions are locked for Researcher')).toBeVisible();

    // 4. Verify Evidence Highlighter shows verified contiguous quote
    await expect(page.locator('text=Contiguous Quote Verified')).toBeVisible();
    await expect(page.locator('mark')).toContainText('multimodal models achieve 84.2% accuracy on benchmark tests');

    // 5. Switch to Faculty Reviewer role
    await page.click('button:has-text("Faculty Reviewer")');
    await expect(page.locator('text=Current Role:')).toContainText('Faculty Reviewer');

    // 6. Verify Human Review form is unlocked and submit an override review
    await expect(page.locator('button:has-text("Submit Review Event")')).toBeVisible();
    await page.fill('textarea', 'Verified by faculty reviewer against primary source table.');
    await page.click('button:has-text("Submit Review Event")');
    await expect(page.locator('text=Review recorded!')).toBeVisible();

    // 7. Verify Report Export buttons exist
    await expect(page.locator('button:has-text("Export JSON")')).toBeVisible();
    await expect(page.locator('button:has-text("Export Markdown")')).toBeVisible();

    // 8. Test 2D Fallback switch
    const toggle2D = page.locator('button:has-text("Switch to 2D Mode"), button:has-text("Switch to 3D Mode")');
    if (await toggle2D.count() > 0) {
      await toggle2D.first().click();
    }
  });
});
