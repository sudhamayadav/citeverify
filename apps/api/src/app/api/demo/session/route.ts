import { NextRequest, NextResponse } from 'next/server';
import { DEMO_ROLE_COOKIE } from '@/lib/constants';

export async function GET(req: NextRequest) {
  const roleCookie = req.cookies.get(DEMO_ROLE_COOKIE)?.value;
  const role = roleCookie === 'Faculty Reviewer' ? 'Faculty Reviewer' : 'Researcher';

  return NextResponse.json({
    role,
    label: role === 'Faculty Reviewer' ? 'Demo Faculty Reviewer' : 'Demo Researcher',
    disclaimer: 'LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE. Local role switcher does not represent real authentication or security.',
  });
}
