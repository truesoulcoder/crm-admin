import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { ReadableStream } from 'web-streams-polyfill/ponyfill';

// List email templates
export async function GET(_req: NextRequest) {
  try {
    const templatesDir = path.resolve(process.cwd(), 'src/components/templates');
    const files = await fs.readdir(templatesDir);
    const now = new Date().toISOString();
    const templates = await Promise.all(
      files.filter(f => f.endsWith('.html')).map(async file => {
        const id = file.replace(/\.html$/, '');
        const name = id.replace(/_/g, ' ');
        const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');
        // file timestamps
        const stat = await fs.stat(path.join(templatesDir, file));
        const created_at = stat.birthtime.toISOString();
        const updated_at = stat.mtime.toISOString();
        return { id, name, type: 'email', content, subject: null, available_placeholders: null, is_active: true, created_at, updated_at };
      })
    );
    return NextResponse.json(templates);
  } catch (err: any) {
    console.error('Error listing email templates:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Create a new email template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, content } = body;
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const filePath = path.resolve(process.cwd(), 'src/components/templates', `${id}.html`);
    await fs.writeFile(filePath, content, 'utf-8');
    const now = new Date().toISOString();
    return NextResponse.json(
      { id, name, type: 'email', content, subject: null, available_placeholders: null, is_active: true, created_at: now, updated_at: now },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error creating email template:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}