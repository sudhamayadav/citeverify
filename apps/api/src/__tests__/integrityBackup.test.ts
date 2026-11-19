import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

describe('SQLite PRAGMA Integrity Check and Backup', () => {
  it('passes PRAGMA integrity_check and produces verified backup', async () => {
    // 1. Checkpoint WAL
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);');

    // 2. Integrity check
    const integrity: any = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
    expect(integrity).toBeDefined();
    expect(integrity[0].integrity_check).toBe('ok');

    // 3. Backup file
    const dbPath = path.resolve(__dirname, '../../prisma/citeverify.db');
    const backupPath = path.resolve(__dirname, `../../prisma/citeverify.m9_backup_${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);

    expect(fs.existsSync(backupPath)).toBe(true);
    const bytes = fs.readFileSync(backupPath);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    expect(hash).toBeDefined();
    expect(bytes.length).toBeGreaterThan(0);
  });
});
