import { PDFOptions } from 'puppeteer-core';

export interface PdfGenerationOptions extends Omit<PDFOptions, 'path'> {
  format?: 'A4' | 'Letter' | PDFOptions['format'];
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export interface TemplateContext {
  [key: string]: unknown;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) return '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = context[key.trim()];
    return value !== undefined && value !== null ? String(value) : '';
  });
}
