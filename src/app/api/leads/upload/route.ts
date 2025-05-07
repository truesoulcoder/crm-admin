// src/app/api/leads/upload/route.ts
import { createClient } from '@supabase/supabase-js'; // For service role client
import { cookies } from 'next/headers'; // Still needed if you were to use @supabase/ssr for user context
import Papa from 'papaparse';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to convert header keys to snake_case
const toSnakeCase = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[\s-]+/g, '_') 
    .replace(/([A-Z]+)/g, (match) => `_${match.toLowerCase()}`)
    .replace(/^_/, '') 
    .replace(/__+/g, '_') 
    .toLowerCase(); 
};

// Define the expected shape of a row after header transformation
type LeadStagingRow = Record<string, any>; 

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const marketRegion = formData.get('market_region') as string;

  if (!file) {
    return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 });
  }
  if (!marketRegion || marketRegion.trim() === '') {
    return NextResponse.json({ ok: false, error: 'No market region provided.' }, { status: 400 });
  }

  // Service role client for backend operations
  // Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    /* ---------- 1. PUSH THE RAW FILE TO STORAGE ---------- */
    const fileBytes = await file.arrayBuffer();
    const bucket = 'lead-uploads'; 
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `raw/${randomUUID()}/${Date.now()}-${sanitizedFileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage 
      .from(bucket)
      .upload(objectPath, fileBytes, {
        cacheControl: '3600',
        contentType: file.type || 'text/csv',
        upsert: false, 
      });

    if (uploadErr) {
      console.error('Storage upload failed:', uploadErr);
      return NextResponse.json(
        { ok: false, error: 'Storage upload failed.', details: uploadErr.message },
        { status: 500 }
      );
    }
    console.log('File uploaded to storage:', objectPath);

    /* ---------- 2. PARSE + BULK INSERT INTO staging 'leads' TABLE ---------- */
    const csvText = new TextDecoder().decode(fileBytes);
    const parsed = Papa.parse<Record<string, any>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string): string => toSnakeCase(header.trim()),
    });

    if (parsed.errors.length) {
      console.error('CSV parse errors:', parsed.errors);
      return NextResponse.json(
        { ok: false, error: 'CSV parse errors.', details: parsed.errors.map((err: Papa.ParseError) => err.message) }, 
        { status: 400 }
      );
    }

    let leadsToInsert: LeadStagingRow[] = parsed.data;

    if (leadsToInsert.length === 0) {
      return NextResponse.json({ ok: false, error: 'No data found in CSV file.' }, { status: 400 });
    }

    const { error: insertErr } = await supabaseAdmin
      .from('leads') 
      .insert(leadsToInsert);

    if (insertErr) {
      console.error('Staging insert failed:', insertErr);
      return NextResponse.json(
        { ok: false, error: 'Failed to insert leads into staging table.', details: insertErr.message },
        { status: 500 }
      );
    }
    console.log(`${leadsToInsert.length} leads inserted into staging table.`);

    /* ---------- 3. CALL NORMALIZATION FUNCTION ---------- */
    const { error: normalizeErr } = await supabaseAdmin.rpc('normalize_staged_leads', {
      p_market_region: marketRegion.trim()
    });

    if (normalizeErr) {
      console.error('Normalization RPC failed:', normalizeErr);
      return NextResponse.json(
        { ok: false, error: 'Normalization failed.', details: normalizeErr.message },
        { status: 500 }
      );
    }
    console.log('Normalization function called successfully for market:', marketRegion.trim());

    return NextResponse.json({
      ok: true,
      message: `Successfully uploaded and processed ${file.name}. ${leadsToInsert.length} leads staged. Market: ${marketRegion.trim()}`,
      details: { filePath: objectPath, stagedCount: leadsToInsert.length }
    });

  } catch (error) {
    console.error('Upload process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { ok: false, error: 'Upload process failed.', details: errorMessage }, 
      { status: 500 }
    );
  }
}

// Basic GET handler for health check or testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Lead upload API is active.' });
}
