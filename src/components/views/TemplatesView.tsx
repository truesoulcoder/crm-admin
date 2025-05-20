'use client';

import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
  Bold,
  Edit3,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Loader2,
  Pilcrow,
  PlusCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import Toast from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase/client';

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
  if (!editor) {
    return null;
  }

  return (
    <div className="menu menu-horizontal bg-base-200 rounded-md p-1 mb-2 flex flex-wrap gap-1">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('bold') ? 'btn-active' : ''}`}
        title="Bold"
      >
        <Bold size={16}/>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('italic') ? 'btn-active' : ''}`}
        title="Italic"
      >
        <Italic size={16}/>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('bulletList') ? 'btn-active' : ''}`}
        title="Bullet List"
      >
        • List
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('orderedList') ? 'btn-active' : ''}`}
        title="Ordered List"
      >
        1. List
      </button>
      <button
        onClick={() => {
          const url = window.prompt('Enter URL');
          if (url) editor.chain().focus().setMark('link', { href: url }).run();
        }}
        className={`btn btn-sm btn-ghost ${editor.isActive('link') ? 'btn-active' : ''}`}
        title="Insert Link (Ctrl+K)"
      >
        🔗
      </button>
      <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('paragraph') ? 'btn-active' : ''}`}
        title="Paragraph"
      >
        <Pilcrow size={16}/>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('heading', { level: 1 }) ? 'btn-active' : ''}`}
        title="Heading 1"
      >
        <Heading1 size={16}/>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('heading', { level: 2 }) ? 'btn-active' : ''}`}
        title="Heading 2"
      >
        <Heading2 size={16}/>
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`btn btn-sm btn-ghost ${editor.isActive('heading', { level: 3 }) ? 'btn-active' : ''}`}
        title="Heading 3"
      >
        <Heading3 size={16}/>
      </button>
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
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          bulletList: {
            keepMarks: true,
            keepAttributes: false,
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false,
          },
        }),
        Placeholder.configure({
          placeholder: 'Enter HTML content here... use {{placeholder_name}} for variables.'
        }),
        Link,
      ],
      content: isClient ? newTemplateBody : '',
      onUpdate: ({ editor }) => {
        if (!isClient) return;
        const html = editor.getHTML();
        // Only update state if content actually changed
        if (html !== lastContent.current) {
          lastContent.current = html;
          setNewTemplateBody(html);
        }
      },
      editorProps: {
        attributes: {
          class: 'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl p-3 min-h-[10rem] border border-base-300 rounded-md focus:outline-none focus:border-primary w-full',
        },
      },
      autofocus: false,
      editable: isClient,
      injectCSS: isClient,
      enablePasteRules: isClient,
      enableInputRules: isClient,
    },
    [isClient] // Removed newTemplateBody from deps to prevent re-initialization
  );

  // --- PDF Preview Modal State and Handler ---
  const handlePreviewPdf = async (template: DocumentTemplate) => {
    setPdfLoading(true);
    setPdfError(null);
    setPdfModalOpen(true);
    try {
      // Only support document templates for now
      if (template.template_type !== 'document') {
        setPdfError('PDF preview is only available for document templates.');
        setPdfLoading(false);
        return;
      }
      const res = await fetch(`/api/document-templates/${template.id}-sample-pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF preview');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error('PDF preview error:', e);
      setPdfError(`Failed to load PDF preview: ${err}`);
      setPdfUrl(null);
    } finally {
      setPdfLoading(false);
    }
  };

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
    setClickablePlaceholders([]);
  }, []);

  const handleSubmitTemplate = useCallback(async () => {
    console.log('handleSubmitTemplate called with:', {
      name: newTemplateName,
      bodyLength: newTemplateBody.length,
      type: newTemplateType,
      subject: newTemplateSubject
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
    
    if (!templateBody) {
      setModalError('Template content cannot be empty.');
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

      const templateData = isEmailTemplate 
        ? {
            name: templateName,
            subject: templateSubject,
            body_html: templateBody,
            body_text: templateBody.replace(/<[^>]*>?/gm, ''), // Convert HTML to plain text
            placeholders: clickablePlaceholders.length > 0 ? clickablePlaceholders : [],
            is_active: true,
            user_id: user.id,
            created_by: user.id
          }
        : {
            name: templateName,
            content: templateBody,
            type: 'pdf',
            is_active: true,
            user_id: user.id,
            created_by: user.id
          };
      
      console.log('Saving with data:', { isEmailTemplate, endpoint, templateData });

      console.log('Sending template data:', templateData);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

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
  }, [editor, newTemplateName, newTemplateType, newTemplateSubject, newTemplateBody, rawPlaceholdersInput, editingTemplate, closeModal, fetchTemplates]);

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
    { value: 'document', label: 'Document' } // Changed from 'loi_document' to 'document' to match the filter
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
                  <button
                    className="btn btn-ghost btn-sm btn-circle"
                    title="Preview PDF"
                    onClick={() =>void handlePreviewPdf(template)}
                  >
                    <FileText size={16} />
                  </button>
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
                placeholder={newTemplateType === 'loi_document' ? 'e.g. Standard LOI' : 'e.g. Initial Outreach Q1'} 
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
                  checked={newTemplateType === 'loi_document'}
                  onChange={(e) => {
                    const isLOI = e.target.checked;
                    setNewTemplateType(isLOI ? 'loi_document' : 'email');
                    // Clear subject when switching to LOI document
                    if (isLOI) {
                      setNewTemplateSubject('');
                    }
                  }}
                  disabled={isSubmitting}
                />
                <span className={`text-sm ${newTemplateType === 'loi_document' ? 'font-semibold text-primary' : 'text-base-content/70'}`}>LOI Document</span>
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {clickablePlaceholders.map((placeholder, index) => (
                    <button // Changed from DaisyUI button to custom styled button for pill look
                      key={index}
                      type="button" // Explicitly type as button to prevent form submission
                      className="px-3 py-1 bg-base-200 hover:bg-base-300 text-base-content text-xs rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-150 ease-in-out shadow-sm"
                      onClick={() => {
                        if (editor) {
                          editor.chain().focus().insertContent(placeholder).run();
                        }
                      }}
                    >
                      {placeholder}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="form-control mt-4">
              <label className="label"><span className="label-text">Template Content (HTML)*</span></label>
              <MenuBar editor={editor} />
              <EditorContent editor={editor} />
            </div>
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
                    newTemplateName,
                    newTemplateBody: `${newTemplateBody.substring(0, 50)  }...`,
                    newTemplateType,
                    newTemplateSubject,
                    disabled: isSubmitting || !newTemplateName.trim() || !newTemplateBody.trim() || (newTemplateType === 'email' && !newTemplateSubject.trim())
                  });
                  if (!isSubmitting && 
                      newTemplateName.trim() && 
                      newTemplateBody.trim() && 
                      (newTemplateType !== 'email' || newTemplateSubject.trim())) {
                    void handleSubmitTemplate();
                  }
                }}
                disabled={isSubmitting || !newTemplateName.trim() || !newTemplateBody.trim() || (newTemplateType === 'email' && !newTemplateSubject.trim())}
              >
                {isSubmitting && <Loader2 className="animate-spin mr-2" size={18} />} 
                {isSubmitting ? (editingTemplate ? 'Saving...' : 'Creating...') : (editingTemplate ? 'Save Changes' : 'Create Template')}
              </button>
            </div>
          </div>
        </dialog>
      )}
      {/* PDF Preview Modal JSX */}
      {pdfModalOpen && (
        <dialog id="pdf_preview_modal" className="modal modal-open" open>
          <div className="modal-box w-11/12 max-w-3xl">
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={() => { setPdfModalOpen(false); setPdfUrl(null); setPdfError(null); }}>
                ✕
              </button>
            </form>
            <h3 className="font-bold text-lg mb-4">PDF Preview</h3>
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[300px]">
                <Loader2 className="animate-spin mb-4" size={32} />
                <span>Generating PDF preview...</span>
              </div>
            ) : pdfError ? (
              <div className="alert alert-error mb-4">
                <div className="flex-1">
                  <X size={18} className="mr-2"/>
                  <label>{pdfError}</label>
                </div>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="PDF Preview"
                className="w-full h-[70vh] border rounded-lg"
                style={{ minHeight: 400 }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px]">
                <span>No PDF to display or an error occurred.</span>
              </div>
            )}
          </div>
        </dialog>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TemplatesView;