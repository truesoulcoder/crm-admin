import { NextResponse } from 'next/server';
import { stopCampaign } from '@/services/campaignEngine';

export async function POST(
  req: Request,
  { params }: { params: { campaign_id: string } }
) {
  try {
    const { campaign_id } = params;
    await stopCampaign(campaign_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API stopCampaign error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}