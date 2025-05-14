import { NextResponse } from 'next/server';
import { stopCampaign } from '@/services/campaignEngine';

// POST handler to stop a campaign
export async function POST(
  req: Request,
  { params }: { params: { campaign_id: string } }
) {
  try {
    const { campaign_id } = params;

    if (!campaign_id) {
      return NextResponse.json(
        { success: false, error: 'Campaign ID is missing in parameters.' },
        { status: 400 }
      );
    }

    await stopCampaign(campaign_id);
    return NextResponse.json({ success: true, campaign_id });

  } catch (error) {
    console.error('API POST /engine/campaigns/[campaign_id]/stop error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Failed to stop campaign: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// GET handler for build-time data collection or other GET requests
export async function GET(
  request: Request,
  { params }: { params: { campaign_id: string } }
) {
  try {
    const { campaign_id } = params;

    if (!campaign_id) {
      return NextResponse.json(
        { success: false, error: 'Campaign ID is missing in parameters for GET request.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'ok - build data collection or GET request successful',
      retrieved_campaign_id: campaign_id,
    });

  } catch (error) {
    console.error('API GET /engine/campaigns/[campaign_id]/stop error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Error processing GET request: ${errorMessage}` },
      { status: 500 }
    );
  }
}