'use client';

import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { 
  Bold, 
  Edit3, 
  FileText, 
  Italic, 
  Loader2, 
  Search, 
  Trash2, 
  X, 
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ListOrdered,
  List,
  Quote,
  Code,
  Undo,
  Redo,
  Code2,
  Highlighter,
  Pilcrow,
  Link as LinkIcon,
  PlusCircle,
  Unlink,
  IndentIncrease,
  IndentDecrease
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import Toast from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase/client';

// Type declarations
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (attributes?: { color: string }) => ReturnType;
      toggleHighlight: (attributes?: { color: string }) => ReturnType;
      unsetHighlight: () => ReturnType;
    };
    textAlign: {
      setTextAlign: (alignment: string) => ReturnType;
      unsetTextAlign: () => ReturnType;
      toggleTextAlign: (alignment: string) => ReturnType;
    };
    underline: {
      setUnderline: () => ReturnType;
      toggleUnderline: () => ReturnType;
      unsetUnderline: () => ReturnType;
    };
  }
}

// PDF generation is now handled via API route

// --- Helper Functions ---

// Simple debounce utility function (moved outside the component)
function debounce<P extends unknown[], R>(
  func: (...args: P) => R,
  waitFor: number
): (...args: P) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: P): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
      // timeout = null; // Not strictly necessary here
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
}

const DEFAULT_PLACEHOLDERS = [
  '{{property_address}}',
  '{{property_city}}',
  '{{property_state}}',
  '{{property_zip_code}}',
  '{{current_date}}',
  '{{contact_name}}',
  '{{company_name}}',
  '{{title_company}}',
  '{{senders_name}}',
  '{{senders_title}}',
  '{{closing_date}}',
  '{{offer_price}}',
  '{{emd_amount}}',
  '{{title_company}}'
];

interface DocumentTemplate {
  id: string;
  name: string;
  template_type: string; 
  body: string; 
  subject?: string | null;
  available_placeholders?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  file_path?: string | null;
}

interface ApiErrorResponse {
  error?: string;
}

const getTypeBadge = (template_type: string) => {
  const type = template_type.toLowerCase();
  let badgeClass = 'badge-outline';
  let displayText = template_type;
  
  if (type === 'email') {
    badgeClass = 'badge-primary';
  } else if (type === 'document') {
    badgeClass = 'badge-secondary';
    displayText = 'Document';
  } else {
    badgeClass = 'badge-neutral';
  }
  
  return <span className={`badge ${badgeClass} capitalize`}>{displayText}</span>;
};

const MenuBar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  const addLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', previousUrl || 'https://');
    
    // User cancelled the prompt
    if (url === null) return;
    
    // Empty string means remove the link
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    // Validate URL format
    try {
      // This will throw for invalid URLs
      new URL(url);
    } catch (e) {
      // Invalid URL, show error and return
      alert('Please enter a valid URL (e.g., https://example.com)');
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="menu menu-horizontal bg-base-200 rounded-md p-1.5 mb-3 flex flex-wrap gap-1 shadow-sm border border-base-300">
      {/* Text Formatting */}
      <div className="flex items-center gap-1 border-r border-base-300 pr-2 mr-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('bold') ? 'btn-active' : ''}`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('italic') ? 'btn-active' : ''}`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('underline') ? 'btn-active' : ''}`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('strike') ? 'btn-active' : ''}`}
          title="Strikethrough (Ctrl+Shift+S)"
        >
          <Strikethrough size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('highlight') ? 'btn-active' : ''}`}
          title="Highlight (Ctrl+Shift+H)"
        >
          <Highlighter size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('code') ? 'btn-active' : ''}`}
          title="Code (Ctrl+E)"
        >
          <Code size={16} />
        </button>
      </div>

      {/* Text Alignment */}
      <div className="flex items-center gap-1 border-r border-base-300 px-2 mr-1">
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive({ textAlign: 'left' }) ? 'btn-active' : ''}`}
          type="button"
          title="Align Left"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive({ textAlign: 'center' }) ? 'btn-active' : ''}`}
          type="button"
          title="Center"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive({ textAlign: 'right' }) ? 'btn-active' : ''}`}
          type="button"
          title="Align Right"
        >
          <AlignRight size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive({ textAlign: 'justify' }) ? 'btn-active' : ''}`}
          type="button"
          title="Justify"
        >
          <AlignJustify size={16} />
        </button>
      </div>

      {/* Lists & Indentation */}
      <div className="flex items-center gap-1 border-r border-base-300 px-2 mr-1">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('bulletList') ? 'btn-active' : ''}`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`btn btn-xs btn-ghost btn-square ${editor.isActive('orderedList') ? 'btn-active' : ''}`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
          disabled={!editor.can().sinkListItem('listItem')}
          className="btn btn-xs btn-ghost btn-square"
          title="Indent"
        >
          <IndentIncrease size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().liftListItem('listItem').run()}
          disabled={!editor.can().liftListItem('listItem')}
          className="btn btn-xs btn-ghost btn-square"
          title="Outdent"
        >
          <IndentDecrease size={16} />
        </button>
      </div>

      {/* Headings & Blocks */}
      <div className="flex items-center gap-1 border-r border-base-300 px-2 mr-1">
        <button
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={`btn btn-xs btn-ghost ${editor.isActive('paragraph') ? 'btn-active' : ''}`}
          title="Paragraph"
        >
          <Pilcrow size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`btn btn-xs btn-ghost ${editor.isActive('heading', { level: 1 }) ? 'btn-active' : ''}`}
          title="Heading 1"
        >
          <span className="font-bold">H1</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`btn btn-xs btn-ghost ${editor.isActive('heading', { level: 2 }) ? 'btn-active' : ''}`}
          title="Heading 2"
        >
          <span className="font-bold">H2</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`btn btn-xs btn-ghost ${editor.isActive('heading', { level: 3 }) ? 'btn-active' : ''}`}
          title="Heading 3"
        >
          <span className="font-bold">H3</span>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`btn btn-xs btn-ghost ${editor.isActive('blockquote') ? 'btn-active' : ''}`}
          title="Blockquote"
        >
          <Quote size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`btn btn-xs btn-ghost ${editor.isActive('codeBlock') ? 'btn-active' : ''}`}
          title="Code Block"
        >
          <Code2 size={16} />
        </button>
      </div>

      {/* Links & Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={addLink}
          className={`btn btn-xs btn-ghost ${editor.isActive('link') ? 'btn-active' : ''}`}
          title="Add/Edit Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          className="btn btn-xs btn-ghost"
          title="Remove Link"
        >
          <Unlink size={16} />
        </button>
        <div className="divider divider-horizontal mx-0"></div>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="btn btn-xs btn-ghost"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="btn btn-xs btn-ghost"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} />
        </button>
      </div>
    </div>
  );
};

const TemplatesView: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [toast, setToast] = useState<{message: string, type?: 'success' | 'error' | 'info'}|null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // State for search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  
  // State for templates data
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for template form
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<string>('email');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [rawPlaceholdersInput, setRawPlaceholdersInput] = useState('');
  const [clickablePlaceholders, setClickablePlaceholders] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);

  // Set client-side flag on mount and get user
  useEffect(() => {
    setIsClient(true);
    
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error getting user:', error);
      }
    };
    
    void getUser();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Track if this is the initial load
  const isInitialLoad = useRef(true);
  const lastContent = useRef('');

  // Initialize editor only on client side
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // We'll use the custom one
      }),
      Underline.extend({
        addKeyboardShortcuts() {
          return {
            'Mod-u': () => this.editor.commands.toggleUnderline(),
          };
        },
      }).configure({
        HTMLAttributes: {
          class: 'underline',
        },
      }),
      Highlight.extend({
        addKeyboardShortcuts() {
          return {
            'Mod-h': () => this.editor.commands.toggleHighlight(),
          };
        },
      }).configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-800',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Placeholder.configure({
        placeholder: 'Start typing your template here...',
      }),
      Link.configure({
        openOnClick: true,
      }),
    ],
    content: isClient ? newTemplateBody : '',
    onUpdate: ({ editor: editorInstance }) => {
      if (!isClient) return;
      const html = editorInstance.getHTML();
      // Only update state if content actually changed
      if (html !== lastContent.current) {
        lastContent.current = html;
        setNewTemplateBody(html);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl p-3 min-h-[10rem] border border-base-300 rounded-md focus:outline-none focus:border-primary w-full bg-white',
      },
    },
    autofocus: true,
    editable: isClient,
    injectCSS: true,
    enablePasteRules: isClient,
    enableInputRules: isClient,
  }, [isClient, newTemplateBody]);

  // --- PDF Preview Modal State and Handler ---
  const handlePreviewPdf = useCallback(async (template: DocumentTemplate) => {
    setPdfLoading(true);
    setPdfError(null);
    setPdfModalOpen(true);
    setPreviewTemplate(template);

    try {
      if (template.template_type === 'document' && template.file_path) {
        // Generate a signed URL for the PDF file
        const { data, error } = await supabase.storage
          .from('pdf-templates')
          .createSignedUrl(template.file_path, 3600); // URL valid for 1 hour
          
        if (error) throw error;
        if (data?.signedUrl) {
          console.log('Generated signed URL for PDF:', data.signedUrl);
          setPdfUrl(data.signedUrl);
        } else {
          throw new Error('Could not generate preview URL');
        }
      } else if (template.template_type === 'email') {
        // For email templates, we'll show the HTML content in a modal
        setPdfUrl(null);
      } else {
        throw new Error('Unsupported template type for preview');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error('Error in handlePreviewPdf:', e);
      setPdfError(`Failed to load preview: ${errorMessage}`);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  // Update editor content when newTemplateBody changes (only on initial load or when editing a different template)
  useEffect(() => {
    if (editor && newTemplateBody !== lastContent.current) {
      // Only update if content is different
      const currentContent = editor.getHTML();
      if (currentContent !== newTemplateBody) {
        // Use a small timeout to ensure the editor is fully initialized
        const timer = setTimeout(() => {
          editor.commands.setContent(newTemplateBody || '');
          lastContent.current = newTemplateBody;
        }, 10);
        return () => clearTimeout(timer);
      }
    }
  }, [editor, newTemplateBody]);

  // Clean up refs on unmount
  useEffect(() => {
    return () => {
      isInitialLoad.current = true;
      lastContent.current = '';
    };
  }, []);

  // Step 1: Create a stable callback for the core logic
  const parseAndSetPlaceholders = useCallback((placeholdersString: string, isEditing: boolean) => {
    let finalPlaceholders: string[] = [];

    const customPlaceholders = placeholdersString
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0 && p.startsWith('{{') && p.endsWith('}}'));

    if (isEditing) {
      // When editing, the input string IS the source of truth for all placeholders for that template
      finalPlaceholders = customPlaceholders;
    } else {
      // When creating new, combine defaults with custom, ensuring uniqueness
      finalPlaceholders = Array.from(new Set([...DEFAULT_PLACEHOLDERS, ...customPlaceholders]));
    }

    setClickablePlaceholders(finalPlaceholders);

  }, [setClickablePlaceholders]); // setClickablePlaceholders is stable

  // Step 2: Memoize the debounced version of the stable callback
  const debouncedUpdateClickablePlaceholders = useMemo(
    () => debounce(parseAndSetPlaceholders, 500),
    [parseAndSetPlaceholders]
  );

  // Effect to call the debounced function when rawPlaceholdersInput changes
  useEffect(() => {
    // Pass whether we are in 'editing' mode to the debounced function
    debouncedUpdateClickablePlaceholders(rawPlaceholdersInput, !!editingTemplate);
  }, [rawPlaceholdersInput, editingTemplate, debouncedUpdateClickablePlaceholders]);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch both email and document templates in parallel
      const [emailTemplatesRes, documentTemplatesRes] = await Promise.all([
        fetch('/api/email-templates'),
        fetch('/api/document-templates')
      ]);

      if (!emailTemplatesRes.ok || !documentTemplatesRes.ok) {
        const emailError = emailTemplatesRes.ok ? null : await emailTemplatesRes.json().catch(() => ({}));
        const docError = documentTemplatesRes.ok ? null : await documentTemplatesRes.json().catch(() => ({}));
        
        console.error('Error fetching templates:', { 
          emailError: emailError?.error, 
          docError: docError?.error 
        });
        
        throw new Error(
          [emailError?.error, docError?.error]
            .filter(Boolean)
            .join('; ') || 'Failed to fetch templates'
        );
      }

      let emailTemplates = [];
      let documentTemplates = [];

      try {
        const emailData = await emailTemplatesRes.json();
        emailTemplates = Array.isArray(emailData) ? emailData : [];
      } catch (e) {
        console.error('Error parsing email templates:', e);
        emailTemplates = [];
      }

      try {
        const docData = await documentTemplatesRes.json();
        // Handle both direct array and paginated response formats
        documentTemplates = Array.isArray(docData) 
          ? docData 
          : (docData.data && Array.isArray(docData.data) ? docData.data : []);
      } catch (e) {
        console.error('Error parsing document templates:', e);
        documentTemplates = [];
      }

      // Combine and normalize the templates
      const processedEmailTemplates = emailTemplates.map((t: any) => ({
        ...t,
        id: t.id,
        name: t.name,
        body: t.body || '',  // email-templates use 'body'
        subject: t.subject || '',
        template_type: 'email',
        is_active: t.is_active !== false, // default to true if not set
        created_at: t.created_at,
        updated_at: t.updated_at,
        available_placeholders: t.available_placeholders || []
      }));
      
      const processedDocumentTemplates = documentTemplates.map((t: any) => ({
        ...t,
        id: t.id,
        name: t.name,
        body: t.content || '',  // document-templates use 'content' but we map to 'body' for UI
        subject: t.subject || '',
        template_type: 'document',
        is_active: t.is_active !== false, // default to true if not set
        created_at: t.created_at,
        updated_at: t.updated_at,
        available_placeholders: t.available_placeholders || []
      }));
      
      const combinedTemplates = [
        ...processedEmailTemplates,
        ...processedDocumentTemplates
      ];
      
      console.log('Total templates loaded:', combinedTemplates.length, 
        `(${processedEmailTemplates.length} email, ${processedDocumentTemplates.length} document)`);

      setDocumentTemplates(combinedTemplates);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching templates';
      setError(errorMessage);
      console.error('Error fetching templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setNewTemplateName('');
    setNewTemplateType('email');
    setNewTemplateSubject('');
    setNewTemplateBody('');
    setRawPlaceholdersInput('');
    setPdfFile(null);
    setPdfPreviewUrl(null);
    setClickablePlaceholders([...DEFAULT_PLACEHOLDERS]);
    setModalError(null);
    setIsTemplateModalOpen(true);
  };

  const openEditModal = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplateType(template.template_type);
    setNewTemplateSubject(template.subject || '');
    setNewTemplateBody(template.body);
    const currentPlaceholders = template.available_placeholders || [];
    setRawPlaceholdersInput(currentPlaceholders.join(', '));
    // For editing, clickablePlaceholders are derived from rawPlaceholdersInput via useEffect
    // so no direct setClickablePlaceholders here, let the effect handle it.
    setModalError(null);
    setIsTemplateModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);
    setModalError(null);
    setNewTemplateName('');
    setNewTemplateType('email');
    setNewTemplateSubject('');
    setNewTemplateBody('');
    setRawPlaceholdersInput('');
    setPdfFile(null);
    setPdfPreviewUrl(null);
    setClickablePlaceholders([]);
  }, []);

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setPdfPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitTemplate = useCallback(async () => {
    console.log('handleSubmitTemplate called with:', {
      name: newTemplateName,
      bodyLength: newTemplateBody.length,
      type: newTemplateType,
      subject: newTemplateSubject,
      hasPdfFile: !!pdfFile
    });
    
    if (!editor) {
      console.error('Editor not initialized');
      return;
    }
    
    setModalError(null);
    
    // Validate form
    const templateName = newTemplateName.trim();
    const templateBody = newTemplateBody.trim();
    const templateSubject = newTemplateSubject.trim();
    
    if (!templateName) {
      setModalError('Template name is required.');
      return;
    }
    
    if (newTemplateType === 'document' && !pdfFile) {
      setModalError('Please upload a PDF file for document templates.');
      return;
    }
    
    if (newTemplateType === 'email' && !templateSubject) {
      setModalError('Email subject is required for email templates.');
      return;
    }

    setIsSubmitting(true);
    const isEmailTemplate = newTemplateType === 'email';
    const endpoint = isEmailTemplate ? 'email-templates' : 'document-templates';
    const method = editingTemplate ? 'PUT' : 'POST';
    const url = editingTemplate 
      ? `/api/${endpoint}?id=${editingTemplate.id}` 
      : `/api/${endpoint}`;

    try {
      // Prepare template data based on template type
      // Ensure user is authenticated before proceeding
      if (!user) {
        setModalError('You must be logged in to save templates');
        setIsSubmitting(false);
        return;
      }

      let templateData;
      // const filePath = ''; // filePath is determined within the document handling block

      // Scan newTemplateBody for actual placeholders used in the content
      const foundPlaceholdersSet = new Set<string>();
      const placeholderRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g; // Matches {{placeholder_name}}
      let match;
      while ((match = placeholderRegex.exec(newTemplateBody)) !== null) {
        foundPlaceholdersSet.add(match[0]); // match[0] is the full {{placeholder_name}}
      }
      const actualPlaceholdersInContent = Array.from(foundPlaceholdersSet);

      if (isEmailTemplate) {
        // Handle email template
        templateData = {
          name: templateName,
          subject: templateSubject,
          body_html: templateBody,
          body_text: templateBody.replace(/<[^>]*>?/gm, ''), // Convert HTML to plain text
          available_placeholders: actualPlaceholdersInContent, // Use placeholders scanned from content
          is_active: true,
          user_id: user.id,
          created_by: user.id
        };
      } else {
        // Handle document template with PDF upload
        if (!pdfFile) {
          throw new Error('No PDF file provided for document template');
        }

        setIsPdfUploading(true);
        
        try {
          // Use the original filename for the template
          const fileName = pdfFile.name;
          
          // First, check if file exists and delete it if it does
          const { error: checkError } = await supabase.storage
            .from('pdf-templates')
            .remove([fileName]);
            
          if (checkError && checkError.message !== 'The resource was not found') {
            console.warn('Error checking for existing file:', checkError);
          }
          
          // Upload the PDF file directly to the root of the pdf-templates bucket
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('pdf-templates')
            .upload(fileName, pdfFile, {
              contentType: 'application/pdf',
              upsert: true, // Allow overwriting since we're using the same filename
              cacheControl: '3600'
            });

          if (uploadError) {
            console.error('Error uploading PDF to storage:', uploadError);
            throw new Error(`Failed to upload PDF to storage: ${uploadError.message}`);
          }

          console.log('PDF uploaded successfully:', uploadData);

          // Prepare document template data
          templateData = {
            name: templateName,
            type: 'document', // Corrected field name for API schema
            content: templateBody, // Corrected field name for API schema
            file_path: fileName, // Just store the filename
            file_type: pdfFile.type || 'application/pdf', // Add file_type for the API
            available_placeholders: actualPlaceholdersInContent, // Use placeholders scanned from content
            is_active: true, // Client sets this, server also defaults if not provided
            subject: null, // Explicitly null for document type
            // user_id and created_by are set by the server based on the authenticated user session
          };
          
          console.log('Document template data prepared:', templateData);
        } finally {
          setIsPdfUploading(false);
        }
      }

      console.log('Saving template data:', templateData);

      // 6. Save template metadata to database
      console.log('Sending template data to API:', JSON.stringify(templateData, null, 2));
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include', // Include credentials for auth
        body: JSON.stringify(templateData),
      });
      
      console.log('API Response Status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || 'Failed to save template to database');
      }
      
      console.log('API response status:', response.status);

      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', responseData);
        throw new Error(responseData.error || 'Failed to save template');
      }

      // Close the modal first to prevent any UI conflicts
      closeModal();
      
      // Show success message
      setToast({ 
        message: `Template ${editingTemplate ? 'updated' : 'created'} successfully!`, 
        type: 'success' 
      });
      
      // Refresh the templates list
      try {
        await fetchTemplates();
      } catch (error) {
        console.error('Error refreshing templates:', error);
        setToast({
          message: 'Template saved, but there was an error refreshing the list',
          type: 'error'
        });
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred while saving the template.';
      setModalError(errorMessage);
      console.error('Error saving template:', e);
    } finally {
      setIsSubmitting(false);
    }
  }, [editor, newTemplateName, newTemplateType, newTemplateSubject, newTemplateBody, rawPlaceholdersInput, editingTemplate, closeModal, fetchTemplates, pdfFile, user]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/document-templates?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete template');
      }

      setToast({ message: 'Template deleted successfully!', type: 'success' });
      await fetchTemplates();
    } catch (err: unknown) {
      let errorMessage = 'An error occurred while deleting the template.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
      console.error('Error deleting template:', err);
      // It might be better to not re-fetch if the deletion failed, 
      // or to ensure the UI reflects the failed state, but for now, keeping existing logic.
      await fetchTemplates(); 
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchTemplates]);

  // Filter templates based on search term and type
  const filteredTemplates = documentTemplates.filter(template => {
    if (!template.is_active) return false; // Ensure only active templates are considered
    
    // Check if template matches search term (name or subject)
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTermLower) ||
      (template.subject && template.subject.toLowerCase().includes(searchTermLower));
    
    // Check if template matches selected type
    const matchesType = filterType === 'All' || 
      template.template_type.toLowerCase() === filterType.toLowerCase();
    
    return matchesSearch && matchesType;
  });
  
  if (filteredTemplates.length === 0) {
    console.log('No templates match the current filter');
  }

  // Static list of template types for filtering
  const templateTypeOptions = [
    { value: 'email', label: 'Email' },
    { value: 'document', label: 'Document' } // Changed from 'pdf_document' to 'document' to match the filter
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-xl">Loading templates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <X size={48} className="text-error mb-4" />
        <h2 className="text-2xl font-semibold text-error mb-2">Error Loading Templates</h2>
        <p className="text-base-content/70 mb-4">{error}</p>
        <button className="btn btn-primary" onClick={() => void handleSubmitTemplate()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-base-content">Template Management</h1> 
        <button className="btn btn-primary w-full sm:w-auto" onClick={openCreateModal}>
          <PlusCircle size={18} className="mr-2" /> Create New Template
        </button>
      </div>

      <div className="mb-6 p-4 card bg-base-200 shadow rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end"> 
          <div className="form-control w-full">
            <label className="label"><span className="label-text">Search Templates</span></label>
            <div className="join">
              <input
                type="text"
                placeholder="Search by name or subject..."
                className="input input-bordered join-item w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="btn btn-ghost join-item"><Search size={18}/></button>
            </div>
          </div>
          <div className="form-control w-full">
            <label className="label"><span className="label-text">Filter by Type</span></label>
            <select 
              className="select select-bordered w-full"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              {templateTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredTemplates.length === 0 && !isLoading ? ( 
        <div className="text-center py-10 card bg-base-100 shadow-md">
          <FileText size={48} className="mx-auto text-base-content/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Templates Found</h2>
          <p className="text-base-content/70">Try adjusting your search or filters, or click &quot;Create New Template&quot; to add one.</p> 
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="card-body p-4">
                <h2 className="card-title text-lg truncate" title={template.name}>{template.name}</h2>
                {template.subject && <p className="text-xs text-base-content/70 truncate" title={template.subject}>{template.subject}</p>}
                <div className="flex items-center justify-between mt-2">
                  {getTypeBadge(template.template_type)}
                </div>
                <p className="text-xs text-base-content/50 mt-1">Last Updated: {new Date(template.updated_at).toLocaleDateString()}</p>
                <div className="card-actions justify-end mt-4">
                  <button className="btn btn-ghost btn-sm btn-circle" title="View/Edit" onClick={() => openEditModal(template)}>
                    <Edit3 size={16} /> 
                  </button>
                  {template.template_type === 'document' && (
                    <button
                      className="btn btn-ghost btn-sm btn-circle"
                      title="Preview Document"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handlePreviewPdf(template);
                      }}
                    >
                      <FileText size={16} />
                    </button>
                  )}
                  <button 
                    className="btn btn-ghost btn-sm btn-circle text-error" 
                    title="Delete" 
                    onClick={() => void handleDeleteTemplate(template.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isTemplateModalOpen && (
        <dialog id="template_modal" className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={closeModal}>✕</button>
            </form>
            <h3 className="font-bold text-lg mb-4">{editingTemplate ? 'Edit Document Template' : 'Create New Document Template'}</h3>
            {modalError && (
              <div role="alert" className="alert alert-error mb-4">
                <X size={20} />
                <span>{modalError}</span>
              </div>
            )}
            <div className="form-control">
              <label className="label"><span className="label-text">Template Name*</span></label>
              <input 
                type="text" 
                placeholder={newTemplateType === 'pdf_document' ? 'e.g. Standard LOI' : 'e.g. Initial Outreach Q1'} 
                className="input input-bordered w-full" 
                value={newTemplateName} 
                onChange={(e) => setNewTemplateName(e.target.value)} 
                readOnly={isSubmitting} 
              />
            </div>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Template Type</span></label>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-sm ${newTemplateType === 'email' ? 'font-semibold text-primary' : 'text-base-content/70'}`}>Email</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary align-middle"
                  checked={newTemplateType === 'pdf_document'}
                  onChange={(e) => {
                    const isLOI = e.target.checked;
                    setNewTemplateType(isLOI ? 'pdf_document' : 'email');
                    // Clear subject when switching to LOI document
                    if (isLOI) {
                      setNewTemplateSubject('');
                    }
                  }}
                  disabled={isSubmitting}
                />
                <span className={`text-sm ${newTemplateType === 'pdf_document' ? 'font-semibold text-primary' : 'text-base-content/70'}`}>PDF Document</span>
              </div>
            </div>
            {newTemplateType === 'email' && (
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">Subject Line*</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. Following up on your property" 
                  className="input input-bordered w-full" 
                  value={newTemplateSubject} 
                  onChange={(e) => setNewTemplateSubject(e.target.value)} 
                  readOnly={isSubmitting} 
                />
              </div>
            )}
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Available Placeholders (comma-separated)</span></label>
              <input 
                type="text" 
                placeholder="e.g. {{firstName}}, {{propertyAddress}}"
                className="input input-bordered w-full" 
                value={rawPlaceholdersInput} 
                onChange={(e) => setRawPlaceholdersInput(e.target.value)} 
                readOnly={isSubmitting}
              />
              {clickablePlaceholders.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-base-content/70 mb-2">Click to insert placeholders:</p>
                  <div className="flex flex-wrap gap-2">
                    {clickablePlaceholders.map((placeholder, index) => (
                      <button
                        key={index}
                        type="button"
                        className="btn btn-xs btn-outline btn-primary hover:bg-primary/10 hover:text-primary-content transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 rounded-full border-2 border-primary/30 hover:border-primary/50 px-3 py-1.5 text-xs font-medium shadow-sm"
                        onClick={() => {
                          if (editor) {
                            editor.chain().focus().insertContent(placeholder).run();
                          }
                        }}
                        title={`Insert ${placeholder}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span className="text-primary/80">{placeholder}</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary/60" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {newTemplateType === 'pdf_document' ? (
              <div className="form-control mt-4">
                <label className="label">
                  <span className="label-text">PDF Document*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfFileChange}
                  className="file-input file-input-bordered w-full"
                  disabled={isSubmitting || isPdfUploading}
                />
                {pdfPreviewUrl && (
                  <div className="mt-2">
                    <p className="text-sm text-base-content/70 mb-1">Preview:</p>
                    <iframe
                      src={pdfPreviewUrl}
                      className="w-full h-64 border rounded-md"
                      title="PDF Preview"
                    />
                  </div>
                )}
                {isPdfUploading && (
                  <div className="mt-2 flex items-center text-sm text-base-content/70">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Uploading PDF...
                  </div>
                )}
              </div>
            ) : (
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">Template Content (HTML)*</span></label>
                <MenuBar editor={editor} />
                <EditorContent editor={editor} />
              </div>
            )}
            <div className="modal-action mt-6">
              {/* Debug info - will appear in browser dev tools */}
              <div className="hidden" data-debug-info={JSON.stringify({
                isSubmitting,
                newTemplateName: `'${newTemplateName}'`,
                newTemplateNameTrimmed: `'${newTemplateName.trim()}'`,
                newTemplateBody: `'${newTemplateBody.substring(0, 20)}...'`,
                newTemplateBodyTrimmed: `'${newTemplateBody.trim().substring(0, 20)}...'`,
                newTemplateType,
                newTemplateSubject: `'${newTemplateSubject}'`,
                disabledBecause: {
                  isSubmitting,
                  noName: !newTemplateName.trim(),
                  noBody: !newTemplateBody.trim(),
                  isEmail: newTemplateType === 'email',
                  noSubject: newTemplateType === 'email' && !newTemplateSubject.trim()
                }
              })} />
              
              <button className="btn btn-ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Create Template button clicked');
                  console.log('Current state:', {
                    isSubmitting,
                    isPdfUploading,
                    newTemplateName,
                    newTemplateBody: `${newTemplateBody.substring(0, 50)}...`,
                    newTemplateType,
                    newTemplateSubject,
                    hasPdfFile: !!pdfFile,
                    disabled: isSubmitting || isPdfUploading || !newTemplateName.trim() || 
                      (newTemplateType === 'email' ? !newTemplateBody.trim() : !pdfFile) || 
                      (newTemplateType === 'email' && !newTemplateSubject.trim())
                  });
                  
                  if (isSubmitting || isPdfUploading) return;
                  
                  if (!newTemplateName.trim()) {
                    setModalError('Template name is required');
                    return;
                  }
                  
                  if (newTemplateType === 'email') {
                    if (!newTemplateBody.trim()) {
                      setModalError('Email content cannot be empty');
                      return;
                    }
                    if (!newTemplateSubject.trim()) {
                      setModalError('Email subject is required');
                      return;
                    }
                  } else if (!pdfFile) {
                    setModalError('Please upload a PDF file');
                    return;
                  }
                  
                  void handleSubmitTemplate();
                }}
                disabled={
                  isSubmitting || 
                  isPdfUploading || 
                  !newTemplateName.trim() || 
                  (newTemplateType === 'email' ? !newTemplateBody.trim() : !pdfFile) || 
                  (newTemplateType === 'email' && !newTemplateSubject.trim())
                }
              >
                {(isSubmitting || isPdfUploading) && <Loader2 className="animate-spin mr-2" size={18} />} 
                {isSubmitting || isPdfUploading 
                  ? (editingTemplate ? 'Saving...' : 'Creating...') 
                  : (editingTemplate ? 'Save Changes' : 'Create Template')}
              </button>
            </div>
          </div>
        </dialog>
      )}
      {/* PDF Preview Modal JSX */}
      {pdfModalOpen && (
        <dialog id="pdf_preview_modal" className="modal modal-open" open>
          <div className="modal-box w-11/12 max-w-5xl h-[90vh] flex flex-col">
            <form method="dialog" className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                {previewTemplate?.template_type === 'document' ? 'Document Preview' : 'Email Template Preview'}
                {previewTemplate?.name && (
                  <span className="ml-2 text-sm font-normal text-base-content/70">
                    - {previewTemplate.name}
                  </span>
                )}
              </h3>
              <button 
                className="btn btn-sm btn-circle btn-ghost" 
                onClick={(e) => {
                  e.preventDefault();
                  setPdfModalOpen(false);
                  setPdfUrl(null);
                  setPdfError(null);
                  setPreviewTemplate(null);
                }}
              >
                ✕
              </button>
            </form>
            
            <div className="flex-1 flex flex-col bg-base-200 rounded-lg p-4 overflow-auto">
              {pdfLoading ? (
                <div className="flex flex-col items-center justify-center flex-1">
                  <Loader2 className="animate-spin mb-4" size={32} />
                  <span>Loading preview...</span>
                </div>
              ) : pdfError ? (
                <div className="alert alert-error mb-4">
                  <div className="flex-1">
                    <X size={18} className="mr-2"/>
                    <label>{pdfError}</label>
                  </div>
                </div>
              ) : previewTemplate?.template_type === 'document' && pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  title="Document Preview"
                  className="w-full h-full min-h-[70vh] border rounded-lg bg-white"
                  style={{ minHeight: '500px' }}
                />
              ) : previewTemplate?.template_type === 'email' ? (
                <div className="bg-white p-6 rounded-lg shadow-lg flex-1 overflow-auto">
                  <div className="border-b border-base-300 pb-4 mb-4">
                    <h4 className="font-bold text-lg">{previewTemplate.subject || 'No Subject'}</h4>
                  </div>
                  <div 
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.body || '<p>No content available</p>' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1">
                  <FileText size={48} className="text-base-content/30 mb-4" />
                  <p className="text-base-content/70">No preview available for this template type.</p>
                </div>
              )}
            </div>
          </div>
        </dialog>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TemplatesView;