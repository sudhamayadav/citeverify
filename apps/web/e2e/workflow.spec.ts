import { test, expect } from '@playwright/test';

test.describe('CiteVerify End-to-End Workflow', () => {
  test('Upload -> Extraction Confirm -> Verify -> Evidence Inspect -> Role Switch -> Faculty Override -> Export', async ({ page }) => {
    // Mock backend API routes for deterministic, isolated E2E testing
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: 'connected', uptime: 100 }),
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
            id: 'rev-e2e-1',
            claimId: 'claim-1',
            action: payload.action || 'OVERRIDE',
            resultingState: payload.resultingState || 'SUPPORTED',
            recordHash: '1234567890abcdef1234567890abcdef',
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
            reportId: 'REP-job-demo-1',
            claims: [{ claimId: 'claim-1', verdict: 'SUPPORTED' }],
          }),
        });
      }
    });

    // 1. Visit homepage
    await page.goto('/');

    // 2. Check Top-bar Local-Only Demo Mode banner & Researcher role active
    await expect(page.locator('text=LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE')).toBeVisible();
    await expect(page.locator('text=Current Role:')).toContainText('Researcher');

    // 3. Step 1: Upload Workspace -> Click Upload
    await expect(page.locator('text=Upload Scientific Manuscript')).toBeVisible();
    await page.click('button:has-text("Upload & Extract Claims")');

    // 4. Step 2: Extraction Correction screen -> Confirm extraction
    await expect(page.locator('text=Stage 2: Review & Correct Extracted Claims')).toBeVisible();
    await page.click('button:has-text("Confirm & Proceed to Verification")');

    // 5. Step 3: Live Verification Timeline -> Jump to Verification Report
    await expect(page.locator('text=Verification Job In Progress')).toBeVisible();
    await page.click('button:has-text("Jump to Verification Report")');

    // 6. Step 4: Verification Report page -> Inspect Evidence, badges, and clickable URL
    await expect(page.locator('text=Claim Explorer')).toBeVisible();
    await expect(page.locator('text=Contiguous Quote Verified')).toBeVisible();
    await expect(page.locator('mark')).toContainText('multimodal models achieve 84.2% accuracy on benchmark tests');
    await expect(page.locator('a[href="https://arxiv.org/abs/2301.00001"]')).toBeVisible();

    // 7. Check Audit Inspector Drawer opens
    await page.click('button:has-text("Inspect Audit Trail")');
    await expect(page.locator('text=Reproducibility & Audit Trail')).toBeVisible();
    await page.click('button[aria-label="Close audit drawer"]');

    // 8. Role Switch: Switch to Faculty Reviewer & Faculty Override
    await page.click('button:has-text("Faculty Reviewer")');
    await expect(page.locator('text=Current Role:')).toContainText('Faculty Reviewer');

    await expect(page.locator('button:has-text("Submit Review Event")')).toBeVisible();
    await page.selectOption('select', 'OVERRIDE');
    await page.fill('textarea', 'Faculty override verified against primary table.');
    await page.click('button:has-text("Submit Review Event")');
    await expect(page.locator('text=Review recorded!')).toBeVisible();

    // 9. Export JSON and Markdown
    await expect(page.locator('button:has-text("Export JSON")')).toBeVisible();
    await expect(page.locator('button:has-text("Export Markdown")')).toBeVisible();
  });
});
