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
  return new Promise<void>(async (resolve, reject) => { // Added async here
    try { // Wrap in try-catch for async operations like file.text()
      const fileText = await file.text(); // Get the full text once

      let originalHeaders: string[] = [];
      let headerParseError: Error | null = null;

      parse(fileText, {
        preview: 1, // Only parse the first row
        header: false, // Treat the first row as an array of strings
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0 && Array.isArray(results.data[0])) {
            originalHeaders = results.data[0] as string[];
          }
        },
        error: (error: Error) => {
          // Capture error to reject promise outside
          headerParseError = new Error('Failed to parse header row: ' + error.message);
        }
      });

      if (headerParseError) {
        reject(headerParseError);
        return;
      }

      if (originalHeaders.length === 0 && file.size > 0) {
        reject(new Error('No header row found in CSV file.'));
        return;
      }
      
      const finalHeaders: string[] = [];
      const headerCounts: { [key: string]: number } = {};
      
      for (const h of originalHeaders) {
        let snakeCasedHeader = convertToSnakeCase(h); // convertToSnakeCase must be defined above or passed in
        if (headerCounts[snakeCasedHeader] === undefined) {
          headerCounts[snakeCasedHeader] = 0;
          finalHeaders.push(snakeCasedHeader);
        } else {
          headerCounts[snakeCasedHeader]++;
          finalHeaders.push(`${snakeCasedHeader}_${headerCounts[snakeCasedHeader]}`);
        }
      }

      // Now, the main parsing, using the `fileText` obtained earlier
      let isHeaderRowSkipped = false; // To skip the first row in the main parse
      let chunk: any[] = [];
      let rowCount = 0;

      parse(fileText, { // Use the full fileText here
        header: false, // IMPORTANT: Headers are now manually handled
        skipEmptyLines: true,
        step: (row, parser) => {
          const rowDataArray = row.data as any[];

          if (!isHeaderRowSkipped) {
            isHeaderRowSkipped = true;
            // Check if the current row is indeed the header row we already processed
            if (originalHeaders.length > 0 && 
                rowDataArray.length === originalHeaders.length && 
                originalHeaders.every((val, idx) => val === rowDataArray[idx])) {
               return; // Skip this row
            }
          }

          const csvRowData: { [key: string]: any } = {};
          finalHeaders.forEach((headerKey, index) => {
            if (index < rowDataArray.length) {
              csvRowData[headerKey] = rowDataArray[index];
            } else {
              // If rowDataArray is shorter than finalHeaders, assign null to missing fields
              csvRowData[headerKey] = null; 
            }
          });
          
          // Ensure not an empty or all-null object before pushing
          if (Object.keys(csvRowData).length > 0 && !Object.values(csvRowData).every(v => v === null || v === '' || (typeof v === 'string' && v.trim() === ''))) {
            chunk.push(csvRowData);
            rowCount++;

            if (chunk.length >= chunkSize) {
              parser.pause();
              const currentChunkToProcess = [...chunk];
              chunk = [];
              
              processChunk(currentChunkToProcess, false)
                .then(() => parser.resume())
                .catch(error => {
                  parser.abort();
                  reject(error); 
                });
            }
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
    } catch (error) { // Catch errors from await file.text() or other synchronous parts
      reject(error);
    }
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
          async (chunkToProcess, isLastChunk) => { // Renamed 'chunk' to 'chunkToProcess' for clarity
            if (hasError) return;
            try {
              console.log(`Processing chunk of ${chunkToProcess.length} rows from reassembled file...`);
              const leadsToInsert = chunkToProcess.map((processedCsvRowData: any) => { // Name updated to processedCsvRowData
                const rawDataPayload: { [key: string]: any } = {};
                // Keys in processedCsvRowData are already snake_cased and de-duplicated
                for (const key in processedCsvRowData) {
                  if (Object.prototype.hasOwnProperty.call(processedCsvRowData, key)) {
                    // The keys are already processed (snake_cased and de-duplicated).
                    // Specific renaming like 'lot_size_sq_ft' to 'lot_size_sqft'
                    // and 'property_postal_code' to 'property_zip'
                    // should be handled by the initial header processing if they are common patterns
                    // or as a separate step if they are complex transformations.
                    // For now, we directly use the key as it is.
                    // However, the existing code still has these specific remappings.
                    // To fully align with the "NO LONGER NEEDED here" instruction,
                    // we will remove them. If these are truly needed,
                    // they should be part of a more robust header mapping strategy.
                    let finalKey = key;
                    // Example of how specific post-processing could be applied IF NECESSARY,
                    // but the goal is that `finalHeaders` from `processFileInChunks` is definitive.
                    // According to instructions, specific remapping is no longer needed here.
                    rawDataPayload[key] = processedCsvRowData[key];
                  }
                }
                return {
                  uploaded_by: userId, 
                  original_filename: originalFileName, 
                  market_region: marketRegion, 
                  raw_data: rawDataPayload, // rawDataPayload now uses the keys directly from processedCsvRowData
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
              totalProcessed += chunkToProcess.length; // Use chunkToProcess.length
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
  return NextResponse.json({ 
    ok: false, 
    error: 'Failed to normalize staged leads.', 
    details: rpcError.message 
  }, { status: 500 });
}
console.log('API: Normalization successful.');

// ---------- 4. CREATE FINE-CUT LEADS TABLE ----------
console.log(`API: Creating fine-cut leads for market: ${marketRegion}, user: ${userId}, file: ${originalFileName}`);
console.log('About to call create_fine_cut_leads_for_market with:', {
  p_market_region_raw_name: marketRegion,
  p_user_id: userId,
  p_file_name: originalFileName
});

const { data: fineCutData, error: fineCutTableError } = await supabaseAdmin.rpc('create_fine_cut_leads_for_market', {
  p_market_region_raw_name: marketRegion,
  p_user_id: userId,
  p_file_name: originalFileName
});

console.log('RPC create_fine_cut_leads_for_market response:', { data: fineCutData, error: fineCutTableError });

if (fineCutTableError) {
  console.error(`RPC call to create_fine_cut_leads_for_market failed for ${marketRegion}:`, fineCutTableError);
  if (objectPath) {
    console.log(`Attempting to cleanup storage file ${objectPath} due to fine-cut leads RPC error...`);
    await supabaseAdmin.storage.from(bucket).remove([objectPath]);
  }
  return NextResponse.json({ 
    ok: false, 
    error: `RPC error when creating fine-cut leads for '${marketRegion}'.`, 
    details: fineCutTableError.message 
  }, { status: 500 });
}

if (fineCutData && fineCutData.success === false) {
  console.error(`Fine-cut leads creation function reported failure for ${marketRegion}:`, fineCutData.error);
  if (objectPath) {
    console.log(`Attempting to cleanup storage file ${objectPath} due to fine-cut leads function failure...`);
    await supabaseAdmin.storage.from(bucket).remove([objectPath]);
  }
  return NextResponse.json({
    ok: false,
    error: `Fine-cut leads creation failed for '${marketRegion}': ${fineCutData.error || 'Unknown error from function.'}`,
    details: fineCutData
  }, { status: 500 });
}

if (!fineCutData || typeof fineCutData.success !== 'boolean') {
    console.error(`API: Fine-cut leads table operation for ${marketRegion} returned unexpected data or no data. Response:`, fineCutData);
    if (objectPath) {
        console.log(`Attempting to cleanup storage file ${objectPath} due to unexpected fine-cut leads response...`);
        await supabaseAdmin.storage.from(bucket).remove([objectPath]);
    }
    return NextResponse.json({
        ok: false,
        error: `Unexpected response from fine-cut leads creation for '${marketRegion}'.`,
        details: fineCutData
    }, { status: 500 });
}

console.log(`API: Fine-cut leads operation successful for ${marketRegion}. Function response:`, fineCutData);

const fineCutLeadCount = (fineCutData && fineCutData.record_count !== undefined) ? fineCutData.record_count : 0;

return NextResponse.json({
  ok: true,
  message: `Successfully processed ${allInsertedData.length} leads from ${originalFileName}. Fine-cut leads operation completed. Processed ${fineCutLeadCount} fine-cut leads for market '${marketRegion}'.`,
  staged_lead_count: allInsertedData.length,
  fine_cut_lead_count: fineCutLeadCount,
  fine_cut_details: fineCutData 
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