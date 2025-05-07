'use client';

import React, { useState } from 'react';
import { FileText, PlusCircle, Edit3, Trash2, Eye, Search, Filter, ChevronsUpDown, Palette, X } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  subject: string;
  type: 'Email' | 'SMS';
  category: 'Promotional' | 'Transactional' | 'Welcome' | 'Follow-up';
  lastUpdated: string;
  previewImage?: string; // Optional URL to a preview image
}

const mockTemplates: Template[] = [
  {
    id: 'template-001',
    name: 'Welcome Email - New User',
    subject: 'Welcome to Our Platform, {{firstName}}!',
    type: 'Email',
    category: 'Welcome',
    lastUpdated: '2024-03-15',
    previewImage: 'https://via.placeholder.com/150/A9D5E0/333333?text=Welcome+Template',
  },
  {
    id: 'template-002',
    name: 'Abandoned Cart Reminder',
    subject: 'Still thinking it over, {{firstName}}?',
    type: 'Email',
    category: 'Transactional',
    lastUpdated: '2024-04-01',
    previewImage: 'https://via.placeholder.com/150/FFCBA4/333333?text=Cart+Reminder',
  },
  {
    id: 'template-003',
    name: 'Monthly Product Updates',
    subject: 'Exciting New Features This Month!',
    type: 'Email',
    category: 'Promotional',
    lastUpdated: '2024-04-20',
    previewImage: 'https://via.placeholder.com/150/C3B1E1/333333?text=Product+Updates',
  },
  {
    id: 'template-004',
    name: 'Appointment Confirmation SMS',
    subject: 'Your appointment on {{date}} at {{time}} is confirmed.',
    type: 'SMS',
    category: 'Transactional',
    lastUpdated: '2024-02-10',
  },
  {
    id: 'template-005',
    name: 'Post-Purchase Follow-up',
    subject: 'Thanks for your order, {{firstName}}! How was it?',
    type: 'Email',
    category: 'Follow-up',
    lastUpdated: '2024-04-28',
    previewImage: 'https://via.placeholder.com/150/A2D2A2/333333?text=Follow-Up',
  },
];

const getTypeBadge = (type: Template['type']) => {
  return type === 'Email' ? 
    <span className="badge badge-primary badge-outline">{type}</span> : 
    <span className="badge badge-secondary badge-outline">{type}</span>;
};

const getCategoryBadge = (category: Template['category']) => {
  const colors: Record<Template['category'], string> = {
    'Promotional': 'badge-accent',
    'Transactional': 'badge-info',
    'Welcome': 'badge-success',
    'Follow-up': 'badge-warning',
  };
  return <span className={`badge ${colors[category]} badge-sm`}>{category}</span>;
};

const TemplatesView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Email' | 'SMS'>('All');
  const [filterCategory, setFilterCategory] = useState<'All' | Template['category']>('All');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // State for new template form
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<'Email' | 'SMS'>('Email');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<Template['category']>('Promotional');
  const [newTemplateBody, setNewTemplateBody] = useState('');

  const handleCreateTemplate = () => {
    // Mock creation logic
    console.log('Creating template:', {
      name: newTemplateName,
      type: newTemplateType,
      subject: newTemplateSubject,
      category: newTemplateCategory,
      body: newTemplateBody,
    });
    // Reset form and close modal
    setNewTemplateName('');
    setNewTemplateType('Email');
    setNewTemplateSubject('');
    setNewTemplateCategory('Promotional');
    setNewTemplateBody('');
    setIsTemplateModalOpen(false);
  };

  const filteredTemplates = mockTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'All' || template.type === filterType;
    const matchesCategory = filterCategory === 'All' || template.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-base-content">Message Templates</h1>
        <button className="btn btn-primary w-full sm:w-auto" onClick={() => setIsTemplateModalOpen(true)}>
          <PlusCircle size={18} className="mr-2" /> Create New Template
        </button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 p-4 card bg-base-200 shadow rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
              onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            >
              <option value="All">All Types</option>
              <option value="Email">Email</option>
              <option value="SMS">SMS</option>
            </select>
          </div>
          <div className="form-control w-full">
            <label className="label"><span className="label-text">Filter by Category</span></label>
            <select 
              className="select select-bordered w-full"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as typeof filterCategory)}
            >
              <option value="All">All Categories</option>
              <option value="Promotional">Promotional</option>
              <option value="Transactional">Transactional</option>
              <option value="Welcome">Welcome</option>
              <option value="Follow-up">Follow-up</option>
            </select>
          </div>
          <button className="btn btn-ghost text-base-content/70 w-full sm:w-auto">
            <Filter size={18} className="mr-2" /> Advanced Filters
          </button>
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="text-center py-10 card bg-base-100 shadow-md">
          <FileText size={48} className="mx-auto text-base-content/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Templates Found</h2>
          <p className="text-base-content/70">Try adjusting your search or filters, or create a new template.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
              {template.previewImage && (
                <figure className="h-40 bg-base-200 flex items-center justify-center">
                  <img src={template.previewImage} alt={`${template.name} preview`} className="object-contain max-h-full max-w-full" />
                </figure>
              )}
              {!template.previewImage && template.type === 'SMS' && (
                 <figure className="h-40 bg-secondary/10 flex items-center justify-center">
                    <FileText size={48} className="text-secondary" />
                 </figure>
              )}
              <div className="card-body p-4">
                <h2 className="card-title text-lg truncate" title={template.name}>{template.name}</h2>
                <p className="text-xs text-base-content/70 truncate" title={template.subject}>{template.subject}</p>
                <div className="flex items-center justify-between mt-2">
                  {getTypeBadge(template.type)}
                  {getCategoryBadge(template.category)}
                </div>
                <p className="text-xs text-base-content/60 mt-1">Last Updated: {new Date(template.lastUpdated).toLocaleDateString()}</p>
                <div className="card-actions justify-end mt-3">
                  <button className="btn btn-ghost btn-xs" title="Preview"><Eye size={16}/></button>
                  <button className="btn btn-ghost btn-xs" title="Customize Design"><Palette size={16}/></button>
                  <button className="btn btn-ghost btn-xs" title="Edit"><Edit3 size={16}/></button>
                  <button className="btn btn-ghost btn-xs text-error" title="Delete"><Trash2 size={16}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Create New Template Modal */}
      {isTemplateModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" 
              onClick={() => setIsTemplateModalOpen(false)}
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-xl mb-6">Create New Message Template</h3>
            
            <div className="form-control mb-4">
              <label className="label"><span className="label-text">Template Name</span></label>
              <input 
                type="text" 
                placeholder="e.g., Welcome Series - Email 1"
                className="input input-bordered w-full" 
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Template Type</span></label>
                <select 
                  className="select select-bordered w-full"
                  value={newTemplateType}
                  onChange={(e) => setNewTemplateType(e.target.value as 'Email' | 'SMS')}
                >
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Category</span></label>
                <select 
                  className="select select-bordered w-full"
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value as Template['category'])}
                >
                  <option value="Promotional">Promotional</option>
                  <option value="Transactional">Transactional</option>
                  <option value="Welcome">Welcome</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
              </div>
            </div>

            {newTemplateType === 'Email' && (
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">Email Subject</span></label>
                <input 
                  type="text" 
                  placeholder="e.g., Your Weekly Update is Here!"
                  className="input input-bordered w-full" 
                  value={newTemplateSubject}
                  onChange={(e) => setNewTemplateSubject(e.target.value)}
                />
              </div>
            )}

            <div className="form-control mb-6">
              <label className="label"><span className="label-text">Message Body</span></label>
              <textarea 
                className="textarea textarea-bordered h-32 w-full" 
                placeholder={newTemplateType === 'Email' ? "Enter your email body content here. You can use variables like {{firstName}}." : "Enter your SMS content. Remember character limits. {{link}}"}
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
              ></textarea>
              {newTemplateType === 'SMS' && <p className="text-xs text-base-content/60 mt-1">Max 160 characters for standard SMS.</p>}
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setIsTemplateModalOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary"
                onClick={handleCreateTemplate} 
                disabled={!newTemplateName || (newTemplateType === 'Email' && !newTemplateSubject) || !newTemplateBody}
              >
                Create Template
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setIsTemplateModalOpen(false)}>close</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TemplatesView;