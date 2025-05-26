// src/app/api/leads/upload/route.ts
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  const chunkFile = formData.get('file') as File | null;
  const marketRegion = formData.get('market_region') as string | null;
  const uploadId = formData.get('uploadId') as string | null;
  const chunkIndexStr = formData.get('chunkIndex') as string | null;
  const totalChunksStr = formData.get('totalChunks') as string | null;
  const originalFileName = formData.get('fileName') as string | null; // Added this

  console.log('API: Chunk upload request received.');
  console.log(`API: uploadId: ${uploadId}, chunkIndex: ${chunkIndexStr}, totalChunks: ${totalChunksStr}, fileName: ${originalFileName}, marketRegion: ${marketRegion}`);
  console.log('API: Chunk file object:', chunkFile ? { name: chunkFile.name, type: chunkFile.type, size: chunkFile.size } : 'No chunk file found');


  if (!chunkFile || !uploadId || chunkIndexStr === null || totalChunksStr === null || !originalFileName || !marketRegion) {
    console.error('API Error: Missing chunk metadata or file.');
    return NextResponse.json({ ok: false, error: 'Invalid chunk request: missing required fields.' }, { status: 400 });
  }

  const chunkIndex = parseInt(chunkIndexStr, 10);
  const totalChunks = parseInt(totalChunksStr, 10);

  if (isNaN(chunkIndex) || isNaN(totalChunks)) {
    return NextResponse.json({ ok: false, error: 'Invalid chunk metadata: chunkIndex or totalChunks is not a number.' }, { status: 400 });
  }
  
  const tempDir = path.join('/tmp', uploadId);
  const chunkFilePath = path.join(tempDir, `chunk_${chunkIndex}.bin`);

  let objectPath: string | null = null; // To store the path for potential cleanup, used after reassembly
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const bucket = 'lead-uploads'; // Define bucket name

  try {
    await fs.mkdir(tempDir, { recursive: true });
    console.log(`API: Temporary directory created/ensured: ${tempDir}`);

    const chunkBuffer = Buffer.from(await chunkFile.arrayBuffer());
    await fs.writeFile(chunkFilePath, chunkBuffer);
    console.log(`API: Chunk ${chunkIndex}/${totalChunks-1} for ${uploadId} stored at ${chunkFilePath}`);

    // Check if all chunks are received
    const filesInDir = await fs.readdir(tempDir);
    console.log(`API: Chunks received so far for ${uploadId}: ${filesInDir.length}/${totalChunks}`);

    if (filesInDir.length === totalChunks) {
      console.log(`API: All ${totalChunks} chunks received for ${uploadId}. Starting reassembly...`);
      const reassembledFileBuffers: Buffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const currentChunkPath = path.join(tempDir, `chunk_${i}.bin`);
        const buffer = await fs.readFile(currentChunkPath);
        reassembledFileBuffers.push(buffer);
        await fs.unlink(currentChunkPath); // Delete individual chunk file after reading
      }
      await fs.rmdir(tempDir); // Remove the temporary directory for this uploadId
      console.log(`API: Temporary chunks deleted and directory ${tempDir} removed.`);

      const reassembledFileBuffer = Buffer.concat(reassembledFileBuffers);
      console.log(`API: File ${originalFileName} reassembled. Total size: ${reassembledFileBuffer.length} bytes.`);
      
      // MAX_FILE_SIZE check on the reassembled file
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
      if (reassembledFileBuffer.length > MAX_FILE_SIZE) {
        console.error(`API Error: Reassembled file size (${reassembledFileBuffer.length}) exceeds 50MB limit.`);
        // Note: tempDir is already cleaned up at this point.
        return NextResponse.json({ ok: false, error: 'Reassembled file size exceeds 50MB limit.' }, { status: 413 });
      }

      // Simulate a File-like object for processFileInChunks and Supabase upload
      const reassembledFile = {
        name: originalFileName,
        type: chunkFile.type, // Use type from the last chunk, assuming consistency
        size: reassembledFileBuffer.length,
        arrayBuffer: async () => reassembledFileBuffer.buffer.slice(
            reassembledFileBuffer.byteOffset, 
            reassembledFileBuffer.byteOffset + reassembledFileBuffer.byteLength
        ),
        text: async () => reassembledFileBuffer.toString('utf-8'),
      };
      
      // --- BEGIN MAIN PROCESSING LOGIC (adapted from original) ---
      console.log('API: Attempting to upload reassembled file to storage...');
      const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      objectPath = `${randomUUID()}-${Date.now()}-${sanitizedFileName}`; // Used for Supabase path

      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(objectPath, await reassembledFile.arrayBuffer(), { // Use reassembled file buffer
          cacheControl: '3600',
          contentType: reassembledFile.type || 'text/csv',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload failed for reassembled file:', uploadError);
        // tempDir is already cleaned. No specific cleanup here other than general error response.
        return NextResponse.json(
          { ok: false, error: 'Storage upload failed for reassembled file.', details: uploadError.message },
          { status: 500 }
        );
      }
      console.log('Reassembled file uploaded to storage:', objectPath);

      console.log('API: Starting CSV processing for reassembled file...');
      let totalProcessed = 0;
      let allInsertedData: any[] = [];
      let hasError = false;
      let processingError: any = null;

      try {
        const BATCH_SIZE = 100; 
        // Pass the reassembledFile (File-like object) to processFileInChunks
        await processFileInChunks(
          reassembledFile as any, // Cast to 'any' if processFileInChunks expects a strict File type
          BATCH_SIZE,
          async (chunk, isLastChunk) => {
            if (hasError) return;
            try {
              console.log(`Processing chunk of ${chunk.length} rows from reassembled file...`);
              const leadsToInsert = chunk.map((csvRowData: any) => {
                const rawDataPayload: { [key: string]: any } = {};
                for (const key in csvRowData) {
                  if (Object.prototype.hasOwnProperty.call(csvRowData, key)) {
                    let newKey = convertToSnakeCase(key);
                    if (newKey === 'lot_size_sq_ft') newKey = 'lot_size_sqft';
                    if (newKey === 'property_postal_code') newKey = 'property_zip';
                    rawDataPayload[newKey] = csvRowData[key];
                  }
                }
                return {
                  uploaded_by: userId, // userId is from the initial auth check
                  original_filename: originalFileName, // Use originalFileName from chunk metadata
                  market_region: marketRegion, // Use marketRegion from chunk metadata
                  raw_data: rawDataPayload,
                };
              });

              const { data: batchInsertedData, error: batchInsertErr } = await supabaseAdmin
                .from('leads')
                .insert(leadsToInsert)
                .select();

              if (batchInsertErr) {
                console.error('Batch insert error:', batchInsertErr);
                throw batchInsertErr; // Propagate to trigger outer catch for this chunk processing
              }
              if (batchInsertedData) allInsertedData = [...allInsertedData, ...batchInsertedData];
              totalProcessed += chunk.length;
              console.log(`Successfully processed ${totalProcessed} rows from reassembled file so far...`);

            } catch (error) {
              hasError = true;
              processingError = error;
              throw error; // Propagate to stop further processing in processFileInChunks
            }
          }
        );

        if (hasError && processingError) throw processingError; // Throw if any chunk processing failed
        console.log('API: Finished processing reassembled CSV. Total rows processed:', totalProcessed);
        if (totalProcessed === 0) {
          // Attempt to cleanup storage if no data found
          if (objectPath) {
            await supabaseAdmin.storage.from(bucket).remove([objectPath]);
            console.log(`Cleaned up storage file ${objectPath} due to no data in CSV.`);
          }
          return NextResponse.json({ ok: false, error: 'No data found in CSV file.' }, { status: 400 });
        }
      } catch (error: any) {
        console.error('API Error during reassembled CSV processing:', error);
        if (objectPath) {
          console.log(`Attempting to cleanup storage file ${objectPath} due to processing failure...`);
          await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        }
        let errorMessage = 'Failed to process reassembled CSV file';
        if (error.message.includes('violates row-level security policy')) errorMessage = 'Permission denied during CSV processing.';
        else if (error.message.includes('invalid input syntax')) errorMessage = 'Invalid data format in reassembled CSV.';
        return NextResponse.json({ ok: false, error: errorMessage, details: error.message }, { status: 500 });
      }

      console.log('API: All data from reassembled file inserted. Total rows:', allInsertedData.length);

      // ---------- 3. CALL THE NORMALIZATION FUNCTION ----------
      console.log('API: Calling normalize_staged_leads for market_region:', marketRegion);
      const { error: rpcError } = await supabaseAdmin.rpc('normalize_staged_leads', { p_market_region: marketRegion });
      if (rpcError) {
        console.error('RPC normalize_staged_leads failed:', rpcError);
        if (objectPath) await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        return NextResponse.json({ ok: false, error: 'Failed to normalize staged leads.', details: rpcError.message }, { status: 500 });
      }
      console.log('API: Normalization successful.');

      // ---------- 4. CREATE MARKET-SPECIFIC TABLE ----------
      const saneMarketRegionPart = convertToSnakeCase(marketRegion); // marketRegion from chunk metadata
      if (!saneMarketRegionPart) {
        console.error(`API Error: Market region "${marketRegion}" is invalid after sanitization.`);
        if (objectPath) await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        return NextResponse.json({ ok: false, error: `Market region "${marketRegion}" is invalid.`}, { status: 400 });
      }
      const targetTableName = `mkt_${saneMarketRegionPart}`;
      console.log(`API: Creating market-specific table: ${targetTableName}`);
      const { error: marketTableError } = await supabaseAdmin.rpc('create_market_specific_lead_table', {
        p_target_table_name: targetTableName,
        p_market_region_filter: marketRegion
      });
      if (marketTableError) {
        console.error(`RPC create_market_specific_lead_table failed for ${targetTableName}:`, marketTableError);
        if (objectPath) await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        return NextResponse.json({ ok: false, error: `Failed to create market table '${targetTableName}'.`, details: marketTableError.message }, { status: 500 });
      }
      console.log(`API: Market-specific table ${targetTableName} created/populated.`);
      
      // ---------- 5. CREATE FINE-CUT LEADS TABLE ----------
      console.log(`API: Creating fine-cut leads for market: ${marketRegion}, user: ${userId}`);
      const { error: fineCutTableError } = await supabaseAdmin.rpc('create_fine_cut_leads_for_market', {
        p_market_region_raw_name: marketRegion,
        p_user_id: userId
      });
      if (fineCutTableError) {
        console.error(`RPC create_fine_cut_leads_for_market failed for ${marketRegion}:`, fineCutTableError);
        if (objectPath) await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        return NextResponse.json({ ok: false, error: `Failed to create fine-cut leads for '${marketRegion}'.`, details: fineCutTableError.message }, { status: 500 });
      }
      console.log(`API: Fine-cut leads table created/populated for ${marketRegion}.`);

      return NextResponse.json({
        ok: true,
        message: `Successfully processed ${allInsertedData.length} leads from ${originalFileName}. Market table '${targetTableName}' and fine-cut leads created.`,
        lead_count: allInsertedData.length,
        details: { count: allInsertedData.length } // Ensure details.count is sent for client
      });
      // --- END MAIN PROCESSING LOGIC ---

    } else {
      // Not all chunks received yet
      return NextResponse.json({ 
        ok: true, 
        message: `Chunk ${chunkIndex + 1} of ${totalChunks} for ${uploadId} received.` 
      });
    }

  } catch (error: any) {
    console.error('API: Unhandled error in POST /api/leads/upload (chunk processing):', error);
    // Attempt to clean up tempDir if it exists and error happened
    try {
      const dirExists = await fs.stat(tempDir).then(stat => stat.isDirectory()).catch(() => false);
      if (dirExists) {
        console.log(`Attempting to cleanup temporary directory ${tempDir} due to error...`);
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
        }
        await fs.rmdir(tempDir);
        console.log(`Temporary directory ${tempDir} cleaned up.`);
      }
    } catch (cleanupError) {
      console.error(`API: Error during tempDir cleanup for ${uploadId}:`, cleanupError);
    }
    
    // If an error occurs after Supabase upload (objectPath is set), try to remove the orphaned file
    if (objectPath) { // This check might be redundant if error occurs before objectPath is set
      console.log(`Attempting to cleanup orphaned storage file: ${objectPath} due to error...`);
      try {
        await supabaseAdmin.storage.from(bucket).remove([objectPath]);
        console.log(`Successfully cleaned up orphaned storage file: ${objectPath}`);
      } catch (cleanupStorageError) {
        console.error(`Failed to cleanup orphaned storage file ${objectPath}:`, cleanupStorageError);
      }
    }

    let errorMessage = 'An unexpected error occurred during chunk processing.';
    let errorDetails = error.message || 'No additional details available.';
    // Error specific messages can be added here if needed
    
    return NextResponse.json(
      { ok: false, error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}

// Basic GET handler for health check or testing
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Lead upload API is active.' });
}