import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error 
    ? error.message
    : typeof error === 'string'
    ? error
    : 'Unknown error';
}
