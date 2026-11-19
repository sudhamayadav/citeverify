import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/db';
import { HealthResponseSchema } from '@citeverify/shared';

describe('GET /api/health (Integration with live DB)', () => {
  it('returns status ok and database connected using the real SQLite DB', async () => {
    // Verify connection directly
    const rawResult = await prisma.$queryRaw`SELECT 1 as result`;
    expect(rawResult).toBeDefined();

    // Call actual GET route handler without mocks
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
});
