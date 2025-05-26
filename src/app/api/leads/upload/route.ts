// src/app/api/leads/upload/route.ts
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'papaparse';

// Max execution time for this API route (in seconds)
export const maxDuration = 60; // 1 minute

// Helper function to process file in chunks with streaming
const processFileInChunks = (
  file: File,
  chunkSize: number,
  processChunk: (chunk: any[], isLastChunk: boolean) => Promise<void>
) => {
  return new Promise<void>((resolve, reject) => {
    let chunk: any[] = [];
    let rowCount = 0;
    let headers: string[] = [];
    let isFirstChunk = true;

    // Process the file in chunks
    file.text()
      .then(text => {
        parse(text, {
          header: true,
          skipEmptyLines: true,
          step: (row, parser) => {
            if (isFirstChunk && typeof row.data === 'object' && row.data !== null) {
              headers = Object.keys(row.data);
              isFirstChunk = false;
            }
            
            chunk.push(row.data);
            rowCount++;

            if (chunk.length >= chunkSize) {
              // Pause parsing while we process this chunk
              parser.pause();
              const currentChunk = [...chunk];
              chunk = [];
              
              processChunk(currentChunk, false)
                .then(() => parser.resume())
                .catch(error => {
                  parser.abort();
                  reject(error);
                });
            }
          },
          complete: () => {
            // Process any remaining rows in the last chunk
            if (chunk.length > 0) {
              processChunk(chunk, true)
                .then(() => resolve())
                .catch(error => reject(error));
            } else {
              resolve();
            }
          },
          error: (error: Error) => {
            reject(error);
          }
        });
      })
      .catch(error => {
        reject(error);
      });
  });
};


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
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Assign to the outer scoped objectPath for cleanup purposes
    objectPath = `${randomUUID()}-${Date.now()}-${sanitizedFileName}`;

    // Split the file into smaller chunks for upload (under 4.5MB to be safe)
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
    const chunks = [];
    
    for (let i = 0; i < fileBytes.byteLength; i += CHUNK_SIZE) {
      chunks.push(fileBytes.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Uploading file in ${chunks.length} chunks...`);
    
    let uploadError = null;
    
    // If it's a small file, upload in one go
    if (chunks.length <= 1) {
      const { error } = await supabaseAdmin.storage 
        .from(bucket)
        .upload(objectPath, fileBytes, {
          cacheControl: '3600',
          contentType: file.type || 'text/csv',
          upsert: false,
        });
      uploadError = error;
    } else {
      // For larger files, use resumable upload
      const { data: uploadData, error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(objectPath, fileBytes, {
          cacheControl: '3600',
          contentType: file.type || 'text/csv',
          upsert: false
        });
      uploadError = error;
    }

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return NextResponse.json(
        { ok: false, error: 'Storage upload failed.', details: uploadError.message },
        { status: 500 }
      );
    }
    console.log('File uploaded to storage:', objectPath);

    console.log('API: Starting chunked CSV processing...');
    let totalProcessed = 0;
    let allInsertedData: any[] = [];
    let hasError = false;
    let processingError: any = null;

    try {
      // Reduce batch size to 100 rows at a time to prevent memory issues
      const BATCH_SIZE = 100;
      await processFileInChunks(
        file,
        BATCH_SIZE, // Process 100 rows at a time
        async (chunk, isLastChunk) => {
          if (hasError) return;

          try {
            console.log(`Processing chunk of ${chunk.length} rows...`);
            
            // Process the chunk of rows
            const leadsToInsert = chunk.map((csvRowData: any) => {
              const rawDataPayload: { [key: string]: any } = {};
              for (const key in csvRowData) {
                if (Object.prototype.hasOwnProperty.call(csvRowData, key)) {
                  let newKey = convertToSnakeCase(key);
                  
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
                uploaded_by: userId,
                original_filename: file.name,
                market_region: marketRegion,
                raw_data: rawDataPayload
              };
            });

            // Insert the chunk into the database with error handling
            try {
              const { data: batchInsertedData, error: batchInsertErr } = await supabaseAdmin
                .from('leads')
                .insert(leadsToInsert)
                .select();

              if (batchInsertErr) {
                console.error('Batch insert error:', batchInsertErr);
                throw batchInsertErr;
              }

              if (batchInsertedData) {
                allInsertedData = [...allInsertedData, ...batchInsertedData];
              }
            } catch (insertError) {
              console.error('Error inserting batch:', insertError);
              // Try to continue with the next batch even if one fails
              // You might want to log the failed batch for later processing
              console.error('Failed batch data (first row):', leadsToInsert[0]);
            }

            totalProcessed += chunk.length;
            console.log(`Successfully processed ${totalProcessed} rows so far...`);

          } catch (error) {
            hasError = true;
            processingError = error;
            throw error;
          }
        }
      );

      if (hasError && processingError) {
        throw processingError;
      }

      console.log('API: Finished processing all chunks. Total rows processed:', totalProcessed);

      if (totalProcessed === 0) {
        console.error('API Error: No data found in CSV file after parsing.');
        return NextResponse.json({ ok: false, error: 'No data found in CSV file.' }, { status: 400 });
      }

    } catch (error: any) {
      console.error('API Error during chunked processing:', error);
      // Attempt to cleanup the storage file if processing fails
      if (objectPath) {
        console.log(`Attempting to cleanup storage file due to processing failure: ${objectPath}`);
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup storage file ${objectPath} after processing failure:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up storage file after processing failure: ${objectPath}`);
        }
      }
      
      let errorMessage = 'Failed to process CSV file';
      if (error.message.includes('violates row-level security policy')) {
        errorMessage = 'Permission denied. You may not have the necessary permissions to upload leads.';
      } else if (error.message.includes('invalid input syntax')) {
        errorMessage = 'Invalid data format in the CSV file. Please check your data and try again.';
      }
      
      return NextResponse.json(
        { ok: false, error: errorMessage, details: error.message },
        { status: 500 }
      );
    }

    // The chunked processing has already inserted all rows and populated allInsertedData
    console.log('API: All chunks processed. Total rows inserted:', allInsertedData.length);
    
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

    // ---------- 5. CREATE FINE-CUT LEADS TABLE ----------
    console.log(`API: Attempting to create fine-cut leads table for market: ${marketRegion} by user: ${userId}`);
    const { error: fineCutTableError } = await supabaseAdmin.rpc('create_fine_cut_leads_for_market', {
      p_market_region_raw_name: marketRegion,
      p_user_id: userId
    });

    if (fineCutTableError) {
      console.error(`RPC call to create_fine_cut_leads_for_market for ${marketRegion} failed:`, fineCutTableError);
      // Attempt to cleanup the storage file if this final step fails
      if (objectPath) {
        console.log(`Attempting to cleanup storage file due to fine-cut table creation failure: ${objectPath}`);
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup storage file ${objectPath} after fine-cut table failure:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up storage file: ${objectPath}`);
        }
      }
      return NextResponse.json(
        { ok: false, error: `Failed to create fine-cut leads table for market '${marketRegion}'.`, details: fineCutTableError.message },
        { status: 500 }
      );
    }
    console.log(`API: Successfully created/populated fine-cut leads table for market ${marketRegion}.`);

    return NextResponse.json({ 
      ok: true, 
      message: `Successfully processed ${allInsertedData.length} leads. Market table '${targetTableName}' and fine-cut leads table for '${marketRegion}' created/updated.`, 
      lead_count: allInsertedData.length
    });

  } catch (error: any) {
    console.error('API: Unhandled error in POST /api/leads/upload:', error);
    // Ensure we return a proper JSON response even in case of errors
    let errorMessage = 'An unexpected error occurred during processing.';
    let errorDetails = error.message || 'No additional details available.';
    let statusCode = 500;
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('PayloadTooLargeError') || error.message.includes('413')) {
        errorMessage = 'File size exceeds the maximum allowed limit (50MB).';
        errorDetails = 'The uploaded file is too large. Please reduce the file size and try again.';
        statusCode = 413;
      } else if (error.message.includes('Unexpected token') || error.message.includes('JSON') || error.message.includes('CSV')) {
        errorMessage = 'Invalid file format.';
        errorDetails = 'The file could not be processed. Please ensure the file is a valid CSV.';
        statusCode = 400;
      } else if (error.message.includes('ENOMEM') || error.message.includes('heap out of memory')) {
        errorMessage = 'Server memory limit exceeded.';
        errorDetails = 'The file is too large to process. Please try with a smaller file or split it into smaller chunks.';
        statusCode = 413;
      } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Request timeout.';
        errorDetails = 'The request took too long to process. Please try again with a smaller file.';
        statusCode = 408;
      }
    }
    
    // If an error occurs after file upload, try to remove the orphaned file from storage
    if (objectPath) {
      console.log(`Attempting to cleanup orphaned storage file: ${objectPath}`);
      try {
        const { error: cleanupError } = await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        if (cleanupError) {
          console.error(`Failed to cleanup orphaned storage file ${objectPath}:`, cleanupError);
        } else {
          console.log(`Successfully cleaned up orphaned storage file: ${objectPath}`);
        }
      } catch (cleanupErr) {
        console.error('Error during cleanup:', cleanupErr);
      }
    }
    
    // Return a properly formatted JSON response
    return NextResponse.json(
      { 
        ok: false, 
        error: errorMessage, 
        details: errorDetails 
      },
      { status: 500 }
    );
  }
}

// Basic GET handler for health check or testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Lead upload API is active.' });
}