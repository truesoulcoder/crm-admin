'use client';

import { useState, useTransition, useRef, useEffect } from 'react';

import { supabase } from '@/lib/supabase/client';

// Define the expected response structure from the upload API
interface UploadResponse {
  ok: boolean;
  error?: string;
  message?: string; // Optional success message from API
  warning?: string; // Optional warning message
  details?: any;    // Optional details
}

interface LeadUploaderProps {
  onUploadSuccess?: (filename: string, count?: number) => void; // Callback with filename and count on successful upload
  addMessage?: (type: 'info' | 'error' | 'success' | 'warning', message: string) => void; // Callback to send messages to parent
  isProcessing?: boolean; // To disable uploader during parent's processing (e.g., normalization)
}

export default function LeadUploader({ onUploadSuccess, addMessage, isProcessing }: LeadUploaderProps) {

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [marketRegion, setMarketRegion] = useState<string>('');
  const [marketRegions, setMarketRegions] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition(); 
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const failureAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      successAudioRef.current = new Audio('https://ygkbhfdqvrluegsrjpaj.supabase.co/storage/v1/object/public/media/success.mp3'); 
      failureAudioRef.current = new Audio('https://ygkbhfdqvrluegsrjpaj.supabase.co/storage/v1/object/public/media/fail.mp3');
      successAudioRef.current.load();
      failureAudioRef.current.load();
    } catch (err) {
      console.warn('Audio initialization error:', err);
    }
  }, []);

  // Fetch available market regions
  useEffect(() => {
    const fetchMarketRegions = async () => {
      const { data, error } = await supabase
        .from('normalized_leads')
        .select('market_region');
      if (!error && data) {
        const regions = Array.from(new Set(data.map((row: any) => row.market_region)));
        setMarketRegions(regions);
      }
    };
    
    void fetchMarketRegions();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !marketRegion.trim()) { 
        setMessage('Please select a file and enter a market region.');
        if (addMessage) addMessage('error', 'Please select a file and enter a market region.');
        return;
    }

    setMessage(`Uploading file: ${selectedFile.name} for market: ${marketRegion}...`); 

    const formData = new FormData();
    formData.append('market_region', marketRegion.trim()); // Keep this for initial validation or if needed by API before chunking

    startTransition(async () => {
      if (!selectedFile) return; // Should be caught by earlier validation, but good practice

      const uploadId = crypto.randomUUID();
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
      const fileName = selectedFile.name;
      const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);

      setMessage(`Preparing to upload ${fileName}...`);

      const reader = new FileReader();

      reader.onload = async (e_reader) => {
        if (!e_reader.target?.result) {
          setMessage('Failed to read file.');
          if (addMessage) addMessage('error', 'Failed to read file.');
          if (failureAudioRef.current) failureAudioRef.current.play().catch(err => console.warn('Failure audio error:', err));
          return;
        }

        const buffer = e_reader.target.result as ArrayBuffer;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
          const chunk = buffer.slice(start, end);
          const chunkBlob = new Blob([chunk], { type: selectedFile.type });

          const chunkFormData = new FormData();
          chunkFormData.append('file', chunkBlob, fileName); // Server expects 'file'
          chunkFormData.append('market_region', marketRegion.trim());
          chunkFormData.append('chunkIndex', chunkIndex.toString());
          chunkFormData.append('totalChunks', totalChunks.toString());
          chunkFormData.append('uploadId', uploadId);
          chunkFormData.append('fileName', fileName); // Explicitly send fileName

          setMessage(`Uploading chunk ${chunkIndex + 1} of ${totalChunks} for ${fileName}...`);

          try {
            const res = await fetch('/api/leads/upload', {
              method: 'POST',
              body: chunkFormData,
            });
            const result: UploadResponse = await res.json();

            if (!result.ok) {
              const errorMsg = result.error || `Chunk ${chunkIndex + 1} upload failed.`;
              const fullErrorMsg = `Upload failed: ${errorMsg}`;
              setMessage(fullErrorMsg);
              if (addMessage) addMessage('error', fullErrorMsg);
              if (failureAudioRef.current) failureAudioRef.current.play().catch(err => console.warn('Failure audio error:', err));
              return; // Stop on first error
            }

            if (result.warning && addMessage) {
              addMessage('warning', result.warning);
            }
            
            // If it's the last chunk and upload was successful
            if (chunkIndex === totalChunks - 1) {
              const successMsg = result.message || 'File uploaded successfully!';
              setMessage(successMsg);
              if (addMessage) addMessage('success', successMsg);
              if (onUploadSuccess) {
                const count = typeof result.details === 'number' ? result.details : (result.details?.count as number | undefined);
                onUploadSuccess(fileName, count);
              }
              if (successAudioRef.current) {
                successAudioRef.current.play().catch(err => console.warn('Success audio error:', err));
              }
            }
          } catch (err) {
            console.error('Chunk upload fetch error:', err);
            const errorMsg = err instanceof Error ? err.message : String(err);
            const fullErrorMsg = `Upload failed during chunk ${chunkIndex + 1}: ${errorMsg}`;
            setMessage(fullErrorMsg);
            if (addMessage) addMessage('error', fullErrorMsg);
            if (failureAudioRef.current) failureAudioRef.current.play().catch(err => console.warn('Failure audio error:', err));
            return; // Stop on error
          }
        }
      };

      reader.onerror = () => {
        setMessage('Error reading file.');
        if (addMessage) addMessage('error', 'Error reading file.');
        if (failureAudioRef.current) failureAudioRef.current.play().catch(err => console.warn('Failure audio error:', err));
      };

      reader.readAsArrayBuffer(selectedFile);
    });
  }

  return (
    <>
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(e);
        }} 
        className="space-y-4 p-4 border border-gray-200 rounded-lg shadow-sm bg-white"
      >
        <div>
          <label htmlFor="market-region" className="block text-sm font-medium text-gray-700 mb-1">Market Region</label>
          <input
            id="market-region"
            value={marketRegion}
            onChange={(e) => setMarketRegion(e.target.value)}
            className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPending || isProcessing}
            required
          />
        </div>
        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-1">Leads CSV File</label>
          <input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPending || isProcessing}
            required 
          />
        </div>
        <button 
          type="submit" 
          disabled={!selectedFile || !marketRegion.trim() || isPending || isProcessing} 
          className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out"
        >
          {isPending ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </span>
          ) : 'Upload Leads CSV'}
        </button>
        {message && (
          <p className={`mt-3 text-sm text-center ${message.startsWith('Upload failed') || message.startsWith('Please select') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </>
  );
}
