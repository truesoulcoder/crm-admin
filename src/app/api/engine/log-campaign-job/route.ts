// src/app/api/engine/log-campaign-job/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { logCampaignJob } from '@/app/api/engine/log-campaign-job/helpers';

export async function POST(req: NextRequest) {
  try {
    const job = await req.json();
    const result = await logCampaignJob(job);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[POST /log-campaign-job] Unexpected error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
