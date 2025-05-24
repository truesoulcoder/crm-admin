// src/app/api/leads/upload/route.ts
import { randomUUID } from 'crypto';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';


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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const bucket = 'lead-uploads';
  let objectPath: string | null = null; // To store the path for potential cleanup
  
  try {
    console.log('API: Attempting to upload to storage...');
    const fileBytes = await file.arrayBuffer();
    const bucket = 'lead-uploads'; 
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Assign to the outer scoped objectPath for cleanup purposes
    objectPath = `${randomUUID()}-${Date.now()}-${sanitizedFileName}`;

    const { error: uploadErr } = await supabaseAdmin.storage 
      .from(bucket)
      .upload(objectPath, fileBytes, {
        cacheControl: '3600',
        contentType: file.type || 'text/csv',
        upsert: false, 
      });

    if (uploadErr) {
      console.error('Storage upload failed:', uploadErr);
      // No need to cleanup objectPath here as it was never successfully uploaded
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
      // Attempt to cleanup the storage file if CSV parsing fails
      if (objectPath) {
        console.log(`Attempting to cleanup storage file due to CSV parsing failure: ${objectPath}`);
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup storage file ${objectPath} after CSV parsing failure:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up storage file after CSV parsing failure: ${objectPath}`);
        }
      }
      return NextResponse.json(
        { ok: false, error: 'Failed to parse CSV.', details: parsed.errors.slice(0, 5) }, 
        { status: 400 }
      );
    }

    let leadsToInsert = parsed.data.map((csvRowData: any) => {
      const rawDataPayload: { [key: string]: any } = {};
      for (const key in csvRowData) {
        if (Object.prototype.hasOwnProperty.call(csvRowData, key)) {
          let newKey = convertToSnakeCase(key);
          
          // If CSV has an 'id' column, it will be stored as 'id' within raw_data.
          // This is generally fine as the 'leads' table PK is a separate UUID.
          
          // Keep existing key transformations for consistency within raw_data
          if (newKey === 'lot_size_sq_ft') { 
            newKey = 'lot_size_sqft'; 
          }
          
          if (newKey === 'property_postal_code') {
            newKey = 'property_zip';
          }
          
          rawDataPayload[newKey] = csvRowData[key];
        }
      }
      
      // Construct the object that matches the 'leads' table schema
      return {
        uploaded_by: userId, // userId is available from auth context
        original_filename: file.name, // Use original_filename as per schema
        market_region: marketRegion,
        raw_data: rawDataPayload // All CSV data goes here
      };
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

    // ------ BATCH INSERTION LOGIC ------
    const BATCH_SIZE = 250; // Define a suitable batch size
    let allInsertedData: any[] = [];
    let overallInsertError: any = null;

    console.log(`API: Attempting to insert ${leadsToInsert.length} leads in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
      console.log(`API: Inserting batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(leadsToInsert.length / BATCH_SIZE)}, size: ${batch.length}`);
      
      const { data: batchInsertedData, error: batchInsertErr } = await supabaseAdmin
        .from('leads')
        .insert(batch)
        .select();

      if (batchInsertErr) {
        console.error(`Staging insert failed for batch starting at index ${i}:`, batchInsertErr);
        overallInsertError = batchInsertErr; // Store the first error encountered
        break; // Stop processing further batches on error
      }

      if (batchInsertedData) {
        allInsertedData = allInsertedData.concat(batchInsertedData);
      }
      console.log(`API: Batch ${Math.floor(i / BATCH_SIZE) + 1} insert successful. Rows in batch: ${batch.length}, Rows returned from DB: ${batchInsertedData ? batchInsertedData.length : 0}`);
    }

    if (overallInsertError) {
      console.error('Staging insert failed:', overallInsertError);
      let errorMessage = `Failed to insert leads into staging table.`;
      if (overallInsertError.message.includes("violates row-level security policy")) {
        errorMessage += " Possible RLS policy violation.";
      } else if (overallInsertError.message.includes("column") && overallInsertError.message.includes("does not exist")) {
        errorMessage += ` A specified column might not exist in the 'leads' table. Details: ${overallInsertError.message}`;
      } else if (overallInsertError.code === '22P02') {
        errorMessage += ` Invalid input syntax for a column type. Check data for columns like UUIDs, numbers, dates. Details: ${overallInsertError.message}`;
      } else if (overallInsertError.code === '57014') { // Statement timeout
        errorMessage += ` Statement timeout during batch insert. Consider reducing batch size or optimizing table/indexes. Details: ${overallInsertError.message}`;
      } else if (overallInsertError.code) {
        errorMessage += ` Code: ${overallInsertError.code}. Details: ${overallInsertError.details || overallInsertError.message}`;
      } else {
        errorMessage += ` Details: ${overallInsertError.message}`;
      }
      console.error('Full staging insert error object:', JSON.stringify(overallInsertError, null, 2));
      // Attempt to cleanup the storage file if insert fails
      if (objectPath) {
        console.log(`Attempting to cleanup storage file due to DB insert failure: ${objectPath}`);
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup storage file ${objectPath} after DB insert failure:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up storage file after DB insert failure: ${objectPath}`);
        }
      }
      return NextResponse.json({ ok: false, error: errorMessage, details: overallInsertError }, { status: 500 });
    }
    
    console.log('API: All batches inserted successfully. Total rows affected/returned:', allInsertedData.length);
    // console.log('API: Sample of insertedData from staging (first row):', allInsertedData.length > 0 ? JSON.stringify(allInsertedData[0], null, 2) : 'No data returned');


    // ---------- 3. CALL THE NORMALIZATION FUNCTION ----------
    console.log('API: Attempting to call normalize_staged_leads function for market_region:', marketRegion);
    const { error: rpcError } = await supabaseAdmin.rpc('normalize_staged_leads', { p_market_region: marketRegion });

    if (rpcError) {
      console.error('RPC call to normalize_staged_leads failed:', rpcError);
      // Attempt to cleanup the storage file if RPC call fails
      if (objectPath) {
        console.log(`Attempting to cleanup storage file due to RPC failure: ${objectPath}`);
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup storage file ${objectPath} after RPC failure:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up storage file after RPC failure: ${objectPath}`);
        }
      }
      return NextResponse.json(
        { ok: false, error: 'Failed to normalize staged leads.', details: rpcError.message },
        { status: 500 }
      );
    }

    console.log('API: Lead import and normalization process completed successfully.');

    // ---------- 4. CREATE MARKET-SPECIFIC TABLE ----------
    const saneMarketRegionPart = convertToSnakeCase(marketRegion);
    if (!saneMarketRegionPart) {
      console.error(`API Error: Market region "${marketRegion}" results in an empty string after sanitization.`);
      // Note: File is already uploaded and leads normalized. Consider if cleanup is needed here.
      // For now, we proceed but the table name might be 'mkt_'
      return NextResponse.json(
        { ok: false, error: `Market region "${marketRegion}" is invalid for table creation.` },
        { status: 400 }
      );
    }
    const targetTableName = `mkt_${saneMarketRegionPart}`;
    console.log(`API: Attempting to create/populate market-specific table: ${targetTableName} for market: ${marketRegion}`);

    const { error: marketTableError } = await supabaseAdmin.rpc('create_market_specific_lead_table', {
      p_target_table_name: targetTableName,
      p_market_region_filter: marketRegion
    });

    if (marketTableError) {
      console.error(`RPC call to create_market_specific_lead_table for ${targetTableName} failed:`, marketTableError);
      // Attempt to cleanup the storage file if this final step fails
      if (objectPath) {
        console.log(`Attempting to cleanup storage file due to market-specific table creation failure: ${objectPath}`);
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup storage file ${objectPath} after market-specific table failure:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up storage file: ${objectPath}`);
        }
      }
      return NextResponse.json(
        { ok: false, error: `Failed to create or populate market-specific table '${targetTableName}'.`, details: marketTableError.message },
        { status: 500 }
      );
    }

    console.log(`API: Successfully created/populated market-specific table ${targetTableName}.`);
    return NextResponse.json({ 
      ok: true, 
      message: `File processed, leads normalized, and market table '${targetTableName}' created/updated successfully.` 
    });

  } catch (error: any) {
    console.error('API: Unhandled error in POST /api/leads/upload:', error);
    // If an error occurs after file upload, try to remove the orphaned file from storage
    if (objectPath) {
      console.log(`Attempting to cleanup orphaned storage file: ${objectPath}`);
      const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
      if (cleanupError) {
        console.error(`Failed to cleanup orphaned storage file ${objectPath}:`, cleanupError);
      } else {
        console.log(`Successfully cleaned up orphaned storage file: ${objectPath}`);
      }
    }
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred during processing.', details: error.message },
      { status: 500 }
    );
  }
}

// Basic GET handler for health check or testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Lead upload API is active.' });
}