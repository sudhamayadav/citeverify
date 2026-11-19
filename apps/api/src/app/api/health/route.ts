/**
 * GET /api/health
 *
 * Returns backend and database health status.
 * Must not expose secrets or internal paths.
 */

import { NextResponse } from 'next/server';
import { checkDatabaseConnection } from '@/lib/db';

const startTime = Date.now();

export async function GET() {
  const dbConnected = await checkDatabaseConnection();

  const response = {
    status: dbConnected ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    database: dbConnected ? 'connected' : 'disconnected',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return NextResponse.json(response, {
    status: dbConnected ? 200 : 503,
  });
}
