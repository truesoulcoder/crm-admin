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
import React, { useState, useEffect, useCallback, useMemo } from 'react';

import Toast from '@/components/ui/Toast';

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

const getTypeBadge = (template_type: DocumentTemplate['template_type']) => {
  let badgeClass = 'badge-outline';
  if (template_type.toLowerCase() === 'email') badgeClass = 'badge-primary badge-outline';
  else if (template_type.toLowerCase() === 'loi_document') badgeClass = 'badge-secondary badge-outline';
  else badgeClass = 'badge-neutral badge-outline'; 
  return <span className={`badge ${badgeClass}`}>{template_type}</span>;
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
  const [toast, setToast] = useState<{message: string, type?: 'success' | 'error' | 'info'}|null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All'); 
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<string>('email'); 
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState(''); 
  const [rawPlaceholdersInput, setRawPlaceholdersInput] = useState('');
  const [clickablePlaceholders, setClickablePlaceholders] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);

  const editor = useEditor({
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
      Placeholder.configure({ placeholder: 'Enter HTML content here... use {{placeholder_name}} for variables.' }),
      Link,
    ],
    content: newTemplateBody,
    onUpdate: ({ editor }) => {
      setNewTemplateBody(editor.getHTML());
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl p-3 min-h-[10rem] border border-base-300 rounded-md focus:outline-none focus:border-primary w-full',
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== newTemplateBody) {
      editor.commands.setContent(newTemplateBody || '', false); 
    }
  }, [newTemplateBody, editor]);

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
      const response = await fetch('/api/document-templates');
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }
      const responseJson = await response.json();
      if (responseJson && Array.isArray(responseJson.data)) {
        setDocumentTemplates(responseJson.data as DocumentTemplate[]);
      } else {
        console.error("API /api/document-templates response did not contain a 'data' array. Received:", responseJson);
        setDocumentTemplates([]); // Default to an empty array to prevent runtime error
        setError("Received invalid data format for templates from API.");
        setToast({ message: "Error: Could not load templates due to API data format issue.", type: 'error' });
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
        setToast({ message: e.message, type: 'error' });
      } else {
        const unknownErrorMessage = 'An unknown error occurred while fetching templates.';
        setError(unknownErrorMessage);
        setToast({ message: unknownErrorMessage, type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [setToast, setError, setIsLoading, setDocumentTemplates]); // Added dependencies

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setNewTemplateName('');
    setNewTemplateType('email');
    setNewTemplateSubject('');
    setNewTemplateBody(''); 
    setRawPlaceholdersInput(''); // Start with empty input for custom placeholders
    // For new templates, set clickablePlaceholders to defaults initially.
    // The effect above will then merge if user types custom ones.
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
    setClickablePlaceholders([]); // Clear clickable on close
  }, []);

  const handleSubmitTemplate = useCallback(async () => {
    if (!editor) return;
    setModalError(null);

    if (!newTemplateName.trim()) {
      setModalError('Template name is required.');
      return;
    }
    if (!newTemplateBody.trim()) {
      setModalError('Template body cannot be empty.');
      return;
    }

    const placeholdersToSave = rawPlaceholdersInput.split(',').map(p => p.trim()).filter(p => p.startsWith('{{') && p.endsWith('}}'));
    if (rawPlaceholdersInput.trim() && placeholdersToSave.length === 0 && !DEFAULT_PLACEHOLDERS.some(dp => rawPlaceholdersInput.includes(dp))) {
        if (!rawPlaceholdersInput.split(',').every(p => p.trim().startsWith('{{') && p.trim().endsWith('}}'))) {
            setModalError('Custom placeholders must be in {{placeholder_name}} format.');
            return;
        }
    }

    setIsSubmitting(true);
    const method = editingTemplate ? 'PUT' : 'POST';
    const url = editingTemplate ? `/api/document-templates?id=${editingTemplate.id}` : '/api/document-templates';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName,
          template_type: newTemplateType,
          subject: newTemplateType === 'email' ? newTemplateSubject : null,
          body: newTemplateBody,
          available_placeholders: placeholdersToSave.length > 0 ? placeholdersToSave : DEFAULT_PLACEHOLDERS,
          is_active: true, 
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to save template';
        try {
          const errorData: ApiErrorResponse = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = `Failed to save template: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      setToast({ message: `Template ${editingTemplate ? 'updated' : 'created'} successfully!`, type: 'success' });
      closeModal();
      await fetchTemplates(); 
    } catch (e: unknown) {
      if (e instanceof Error) {
        setModalError(e.message);
      } else {
        setModalError('An unknown error occurred while saving the template.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [editor, newTemplateName, newTemplateType, newTemplateSubject, newTemplateBody, rawPlaceholdersInput, editingTemplate, closeModal, fetchTemplates]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/document-templates?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        let errorMsg = 'Failed to delete template';
        try {
          const errorData: ApiErrorResponse = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          // response was not JSON, use default message or statusText
          errorMsg = `Failed to delete template: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }
      setToast({ message: 'Template deleted successfully!', type: 'success' });
      await fetchTemplates(); // Re-fetch templates after deletion
    } catch (e: unknown) {
      if (e instanceof Error) {
        setToast({ message: e.message, type: 'error' });
      } else {
        setToast({ message: 'An unknown error occurred while deleting the template.', type: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchTemplates]);

  const filteredTemplates = documentTemplates.filter(template => {
    if (!template.is_active) return false; // Ensure only active templates are considered
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (template.subject && template.subject.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'All' || (template.template_type && template.template_type.toLowerCase() === filterType.toLowerCase());
    return matchesSearch && matchesType;
  });

  const uniqueTemplateTypes = Array.from(new Set(documentTemplates.map(t => t.template_type)));

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
        <button className="btn btn-primary" onClick={() => void fetchTemplates()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-base-content">Document Templates</h1> 
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
              {uniqueTemplateTypes.map(template_type => (
                <option key={template_type} value={template_type}>{template_type.charAt(0).toUpperCase() + template_type.slice(1)}</option>
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
              <input type="text" placeholder="e.g. Initial Outreach Q1" className="input input-bordered w-full" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} readOnly={isSubmitting} />
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
                    setNewTemplateType(e.target.checked ? 'loi_document' : 'email');
                  }}
                  disabled={isSubmitting}
                />
                <span className={`text-sm ${newTemplateType === 'loi_document' ? 'font-semibold text-primary' : 'text-base-content/70'}`}>LOI Document</span>
              </div>
            </div>
            {newTemplateType === 'email' && (
              <div className="form-control mt-4">
                <label className="label"><span className="label-text">Subject Line</span></label>
                <input type="text" placeholder="e.g. Following up on your property" className="input input-bordered w-full" value={newTemplateSubject} onChange={(e) => setNewTemplateSubject(e.target.value)} readOnly={isSubmitting} />
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
              <button className="btn btn-ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
              <button className="btn btn-primary" onClick={() => void handleSubmitTemplate()} disabled={isSubmitting || !newTemplateName || !newTemplateBody}>
                {isSubmitting && <Loader2 className="animate-spin mr-2" size={18} />} 
                {isSubmitting ? (editingTemplate ? 'Saving...' : 'Creating...') : (editingTemplate ? 'Save Changes' : 'Create Template')}
              </button>
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