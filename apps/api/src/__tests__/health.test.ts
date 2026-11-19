/**
 * Health route unit test.
 *
 * Tests that the health endpoint returns valid JSON
 * matching the HealthResponseSchema from @citeverify/shared.
 */

import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/health/route';
import { HealthResponseSchema } from '@citeverify/shared';

// Mock the database check
vi.mock('@/lib/db', () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
}));

describe('GET /api/health', () => {
  it('returns 200 with valid health response when DB is connected', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    const parsed = HealthResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.status).toBe('ok');
      expect(parsed.data.database).toBe('connected');
      expect(parsed.data.version).toBe('0.1.0');
    }
  });

  it('returns 503 when DB is disconnected', async () => {
    const { checkDatabaseConnection } = await import('@/lib/db');
    vi.mocked(checkDatabaseConnection).mockResolvedValueOnce(false);

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe('error');
    expect(body.database).toBe('disconnected');
  });
});
