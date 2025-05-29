// src/app/api/engine/email-metrics/route.ts
import { NextResponse } from 'next/server';

import { logCampaignjob } from './helpers';

export async function POST(req: Request) {
  try {
    const job = await req.json();
    const result = await logCampaignjob(job);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[POST /email-metrics] Unexpected error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';