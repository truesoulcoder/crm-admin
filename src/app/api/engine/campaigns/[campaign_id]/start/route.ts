import { NextResponse } from 'next/server';
import { startCampaign } from '@/services/campaignEngine';

export async function POST(
  req: Request,
  { params }: { params: { campaign_id: string } }
) {
  try {
    const { campaign_id } = params;
    await startCampaign(campaign_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API startCampaign error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}