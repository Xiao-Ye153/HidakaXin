import { NextResponse } from 'next/server';
import { runHealthChecks } from '../../../lib/healthChecks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const results = await runHealthChecks();
  return NextResponse.json({ checkedAt: new Date().toISOString(), results });
}
