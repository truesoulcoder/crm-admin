// This is a client-side utility for making authenticated API calls
// It automatically includes the API key from localStorage or environment variables

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Type for API response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Type for API error
export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Get the API key from localStorage or environment variable
function getApiKey(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('apiKey') || process.env.NEXT_PUBLIC_API_KEY || null;
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return process.env.NEXT_PUBLIC_API_KEY || null;
    }
  }
  return process.env.API_KEY || null;
}

/**
 * Make an authenticated API request
 * @template T Expected response data type
 * @param endpoint API endpoint (e.g., '/api/endpoint')
 * @param options Fetch options
 * @returns Promise with typed response data
 */
export async function apiFetch<T = unknown>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const headers = new Headers(options.headers);
  
  // Add API key to headers if available
  if (apiKey) {
    headers.set('x-api-key', apiKey);
  }
  
  // Ensure content type is set for POST/PUT requests with body
  if ((options.method === 'POST' || options.method === 'PUT') && options.body) {
    if (!headers.has('Content-Type') && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    const responseData: ApiResponse<T> = await response.json().catch(() => ({
      success: false,
      error: 'Invalid JSON response',
    }));
    
    if (!response.ok) {
      throw new ApiError(
        responseData.error || responseData.message || 'API request failed',
        response.status,
        responseData
      );
    }
    
    if (!responseData.success) {
      throw new ApiError(
        responseData.error || responseData.message || 'API request was not successful',
        response.status,
        responseData
      );
    }
    
    return responseData.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'An unknown error occurred',
      0,
      error
    );
  }
}

// Example usage:
/*
// GET request
const data = await apiFetch('/api/some-endpoint');

// POST request
const result = await apiFetch('/api/some-endpoint', {
  method: 'POST',
  body: JSON.stringify({ key: 'value' })
});
*/
