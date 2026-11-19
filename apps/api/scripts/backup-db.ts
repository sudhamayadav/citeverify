import { prisma } from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function run() {
  // Checkpoint WAL first
  await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);');
  const integrity = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
  console.log('INTEGRITY_CHECK_RESULT:', JSON.stringify(integrity));

  const dbPath = path.resolve(__dirname, '../prisma/citeverify.db');
  const timestamp = Date.now();
  const backupPath = path.resolve(__dirname, `../prisma/citeverify.m9_backup_${timestamp}.db`);

  fs.copyFileSync(dbPath, backupPath);

  const fileBytes = fs.readFileSync(backupPath);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');

  console.log('BACKUP_FILE:', backupPath);
  console.log('BACKUP_SIZE:', fileBytes.length, 'bytes');
  console.log('BACKUP_SHA256:', sha256);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('BACKUP_FAILED:', e);
    process.exit(1);
  });
