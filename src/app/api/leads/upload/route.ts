// src/app/api/leads/upload/route.ts
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Papa from 'papaparse';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Utility function to convert strings to snake_case
const convertToSnakeCase = (str: string): string => {
  if (!str) return '';
  return (
    str
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/__+/g, '_')
  );
};

type LeadStagingRow = Record<string, any>;

export async function POST(request: NextRequest) {
  console.log('API: /api/leads/upload POST request received.');

  const cookieStorePromise = cookies();
  const cookieStore = await cookieStorePromise;
  const supabaseUserClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // set and remove are not strictly needed here if we only fetch the user
        // but are good practice to include for the ssr client configuration
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();

  if (userError || !user) {
    console.error('API Error: User not authenticated for lead upload.', userError);
    return NextResponse.json({ ok: false, error: 'User not authenticated.' }, { status: 401 });
  }
  const userId = user.id;
  console.log('API: Authenticated user ID for lead upload:', userId);

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const marketRegion = formData.get('market_region') as string;

  console.log('API: FormData file object:', file ? { name: file.name, type: file.type, size: file.size } : 'No file object found');
  console.log('API: FormData market_region:', marketRegion);

  if (!file) {
    console.error('API Error: No file provided.');
    return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 });
  }
  // Enforce max file size (50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_FILE_SIZE) {
    console.error(`API Error: File size exceeds 50MB limit. Provided: ${file.size}`);
    return NextResponse.json({ ok: false, error: 'File size exceeds 50MB limit.' }, { status: 413 });
  }
  if (!marketRegion || marketRegion.trim() === '') {
    console.error('API Error: No market region provided or market region is empty.');
    return NextResponse.json({ ok: false, error: 'No market region provided.' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    console.log('API: Attempting to upload to storage...');
    const fileBytes = await file.arrayBuffer();
    const bucket = 'lead-uploads'; 
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${randomUUID()}-${Date.now()}-${sanitizedFileName}`;

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

    console.log('API: Attempting to parse CSV...');
    const fileContent = Buffer.from(fileBytes).toString('utf8');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      console.error('API Error: CSV parsing errors:', parsed.errors);
      return NextResponse.json(
        { ok: false, error: 'Failed to parse CSV.', details: parsed.errors.slice(0, 5) }, 
        { status: 400 }
      );
    }

    let leadsToInsert: LeadStagingRow[] = parsed.data.map((leadData: any) => {
      const leadForStaging: { [key: string]: any } = {};
      for (const key in leadData) {
        if (Object.prototype.hasOwnProperty.call(leadData, key)) {
          let newKey = convertToSnakeCase(key);
          
          if (newKey === 'id') {
            continue; 
          }
          
          if (newKey === 'lot_size_sq_ft') { 
            newKey = 'lot_size_sqft'; 
          }
          
          // **** ADD THIS TRANSFORMATION ****
          if (newKey === 'property_postal_code') {
            newKey = 'property_zip';
          }
          // **** END OF ADDED TRANSFORMATION ****
          
          leadForStaging[newKey] = leadData[key];
        }
      }
      leadForStaging.original_filename = file.name; 
      leadForStaging.market_region = marketRegion; // Ensure market_region is added
      return leadForStaging;
    });

    console.log('API: Number of leads to insert (before check):', leadsToInsert.length); 

    if (leadsToInsert.length === 0) {
      console.error('API Error: No data found in CSV file after parsing.');
      return NextResponse.json({ ok: false, error: 'No data found in CSV file.' }, { status: 400 });
    }

    console.log('API: Sample of leadsToInsert (first 3 rows):');
    for (let i = 0; i < Math.min(leadsToInsert.length, 3); i++) {
      console.log(`Row ${i + 1}:`, JSON.stringify(leadsToInsert[i], null, 2));
    }

    console.log('API: Attempting to insert into staging table...'); 
    const { error: insertErr, data: insertedData } = await supabaseAdmin
      .from('leads')
      .insert(leadsToInsert)
      .select();

    if (insertErr) {
      console.error('Staging insert failed:', insertErr);
      let errorMessage = `Failed to insert leads into staging table.`;
      if (insertErr.message.includes("violates row-level security policy")) {
        errorMessage += " Possible RLS policy violation.";
      } else if (insertErr.message.includes("column") && insertErr.message.includes("does not exist")) {
        errorMessage += ` A specified column might not exist in the 'leads' table. Details: ${insertErr.message}`;
      } else if (insertErr.code === '22P02') {
        errorMessage += ` Invalid input syntax for a column type. Check data for columns like UUIDs, numbers, dates. Details: ${insertErr.message}`;
      } else if (insertErr.code) {
        errorMessage += ` Code: ${insertErr.code}. Details: ${insertErr.details || insertErr.message}`;
      } else {
        errorMessage += ` Details: ${insertErr.message}`;
      }
      console.error('Full staging insert error object:', JSON.stringify(insertErr, null, 2));
      return NextResponse.json({ ok: false, error: errorMessage, details: insertErr }, { status: 500 });
    }
    
    console.log('API: Staging insert successful. Number of rows affected/returned:', insertedData ? insertedData.length : 0);
    // console.log('API: Sample of insertedData from staging (first row):', insertedData && insertedData.length > 0 ? JSON.stringify(insertedData[0], null, 2) : 'No data returned');


    // ---------- 3. CALL THE NORMALIZATION FUNCTION ----------
    console.log('API: Attempting to call normalize_staged_leads function for user:', userId);
    const { error: rpcError } = await supabaseAdmin.rpc('normalize_staged_leads', { p_market_region: marketRegion });

    if (rpcError) {
      console.error('RPC call to normalize_staged_leads failed:', rpcError);
      return NextResponse.json(
        { ok: false, error: 'Failed to normalize staged leads.', details: rpcError.message },
        { status: 500 }
      );
    }

    console.log('API: normalize_staged_leads function called successfully.');
    return NextResponse.json({ ok: true, message: 'File processed and leads normalized successfully.' });

  } catch (error: any) {
    console.error('API: Unhandled error in POST /api/leads/upload:', error);
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred.', details: error.message },
      { status: 500 }
    );
  }
}

// Basic GET handler for health check or testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Lead upload API is active.' });
}