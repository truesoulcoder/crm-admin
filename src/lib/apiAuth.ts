// Node.js built-in modules
import { createHmac } from 'crypto';

// Third-party dependencies
import { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';

// Environment variables
const SEND_EMAIL_API_KEY = process.env.SEND_EMAIL_API_KEY || '';
const API_SECRET = process.env.SEND_EMAIL_API_SECRET || '';

// Type for API key parts
interface ApiKeyParts {
  prefix: string;
  timestamp: number;
  hmac: string;
  random: string;
}

// Type for API response
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Generate a secure API key
export function generateApiKey(prefix = 'el5'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const hmac = createHmac('sha256', API_SECRET)
    .update(`${timestamp}${random}`)
    .digest('hex');
  return `${prefix}_${timestamp}_${hmac}`;
}

// Parse and validate API key structure
function parseApiKey(apiKey: string): ApiKeyParts | null {
  const parts = apiKey.split('_');
  if (parts.length < 3) return null;
  
  const [prefix, timestampStr, ...rest] = parts;
  const timestamp = parseInt(timestampStr, 10);
  
  if (isNaN(timestamp)) return null;
  
  return {
    prefix,
    timestamp,
    hmac: rest[0] || '',
    random: rest.slice(1).join('_')
  };
}

// Validate an API key
export function validateApiKey(apiKey: string | undefined | null): boolean {
  // First, check if the provided key matches the exact SEND_EMAIL_API_KEY
  if (apiKey === SEND_EMAIL_API_KEY) {
    return true;
  }
  
  // For backward compatibility, also check the HMAC validation
  if (!apiKey) return false;
  
  try {
    const keyParts = parseApiKey(apiKey);
    if (!keyParts) return false;
    
    const { prefix, timestamp, hmac, random } = keyParts;
    if (prefix !== 'el5') return false;
    
    // Check if the key is expired (e.g., 24 hours)
    const keyAge = Date.now() - timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (keyAge > maxAge) return false;
    
    // Verify the HMAC
    const expectedHmac = createHmac('sha256', API_SECRET)
      .update(`${timestamp}${random}`)
      .digest('hex');
      
    return hmac === expectedHmac;
  } catch (error) {
    console.error('API key validation error:', error);
    return false;
  }
}

// Middleware for API key validation
export function withApiKey<T = any>(
  handler: NextApiHandler<ApiResponse<T>>
): NextApiHandler<ApiResponse<T>> {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    // Check for API key in headers (preferred) or query parameters
    const apiKey = typeof req.headers['x-api-key'] === 'string' 
      ? req.headers['x-api-key'] 
      : req.query.apiKey as string | undefined;
    
    // If no API key is provided in the request, check the environment
    if (!apiKey) {
      console.error('No API key provided in request');
      return res.status(401).json({ 
        success: false, 
        error: 'API key is required' 
      });
    }
    
    // Validate the API key
    const isValid = validateApiKey(apiKey);
    
    if (!isValid) {
      console.error('Invalid API key provided');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid API key' 
      });
    }
    
    // If we get here, the API key is valid
    return handler(req, res);
  };
}
