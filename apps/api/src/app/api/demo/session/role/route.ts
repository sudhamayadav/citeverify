import { NextRequest, NextResponse } from 'next/server';
import { DEMO_ROLE_COOKIE } from '../route';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { role } = body;

    if (role !== 'Researcher' && role !== 'Faculty Reviewer') {
      return NextResponse.json(
        { error: 'Invalid role. Must be Researcher or Faculty Reviewer.' },
        { status: 400 }
      );
    }

    const res = NextResponse.json({
      success: true,
      role,
      label: role === 'Faculty Reviewer' ? 'Demo Faculty Reviewer' : 'Demo Researcher',
      disclaimer: 'LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE. Local role switcher does not represent real authentication or security.',
    });

    // Set server cookie (httpOnly: false so client can read if needed, path: '/')
    res.cookies.set(DEMO_ROLE_COOKIE, role, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
