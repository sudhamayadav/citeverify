import { prisma } from '@/lib/db';

export async function applyAuditSecurityTriggers(): Promise<void> {
  // Prevent UPDATE on RunAuditSnapshot
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS abort_audit_snapshot_update
    BEFORE UPDATE ON RunAuditSnapshot
    BEGIN
      SELECT RAISE(ABORT, 'RunAuditSnapshot is append-only and cannot be updated');
    END;
  `);

  // Prevent DELETE on RunAuditSnapshot
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS abort_audit_snapshot_delete
    BEFORE DELETE ON RunAuditSnapshot
    BEGIN
      SELECT RAISE(ABORT, 'RunAuditSnapshot is append-only and cannot be deleted');
    END;
  `);

  // Prevent UPDATE on RunAuditEvent
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS abort_audit_event_update
    BEFORE UPDATE ON RunAuditEvent
    BEGIN
      SELECT RAISE(ABORT, 'RunAuditEvent is append-only and cannot be updated');
    END;
  `);

  // Prevent DELETE on RunAuditEvent
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS abort_audit_event_delete
    BEFORE DELETE ON RunAuditEvent
    BEGIN
      SELECT RAISE(ABORT, 'RunAuditEvent is append-only and cannot be deleted');
    END;
  `);
}
