import { MapPin, X } from 'lucide-react';
import React, { ChangeEvent, FormEvent, useState } from 'react';

import { Database } from '@/types/db_types';

type NormalizedLead = Database['public']['Tables']['normalized_leads']['Row'];

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  formData: Partial<NormalizedLead>;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onGeocode: () => void;
  modalTitleAddress?: string;
  isEditMode: boolean;
  isLoaded: boolean;
  panoramaPosition: { lat: number; lng: number } | null;
  lat: number;
  lng: number;
}

export const LeadFormModal: React.FC<LeadFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  onInputChange,
  onGeocode,
  modalTitleAddress,
  isEditMode,
  isLoaded,
  panoramaPosition,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      void onSubmit(e);
    } catch (error) {
      console.error('Form submission error:', error);
      // Optionally, handle error display to the user
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          <X size={18} />
        </button>
        <h3 className="font-bold text-lg mb-4">{modalTitleAddress || (isEditMode ? 'Edit Lead' : 'Add New Lead')}</h3>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Info */}
            <div>
              <label className="label"><span className="label-text">Contact 1 Name</span></label>
              <input 
                type="text" 
                name="contact1_name" 
                placeholder="Contact 1 Name" 
                className="input input-bordered w-full" 
                value={formData.contact1_name || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Contact 1 Email</span></label>
              <input 
                type="email" 
                name="contact1_email_1" 
                placeholder="Contact 1 Email" 
                className="input input-bordered w-full" 
                value={formData.contact1_email_1 || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Contact 2 Name</span></label>
              <input 
                type="text" 
                name="contact2_name" 
                placeholder="Contact 2 Name" 
                className="input input-bordered w-full" 
                value={formData.contact2_name || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Contact 2 Email</span></label>
              <input 
                type="email" 
                name="contact2_email_1" 
                placeholder="Contact 2 Email" 
                className="input input-bordered w-full" 
                value={formData.contact2_email_1 || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">MLS List Agent Name</span></label>
              <input 
                type="text" 
                name="mls_curr_list_agent_name" 
                placeholder="MLS List Agent Name" 
                className="input input-bordered w-full" 
                value={formData.mls_curr_list_agent_name || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">MLS List Agent Email</span></label>
              <input 
                type="email" 
                name="mls_curr_list_agent_email" 
                placeholder="MLS List Agent Email" 
                className="input input-bordered w-full" 
                value={formData.mls_curr_list_agent_email || ''} 
                onChange={onInputChange} 
              />
            </div>
          </div>

          {/* Property Info */}
          <div className="divider">Property Information</div>
          <div className="space-y-4">
            <div className="relative">
              <label className="label"><span className="label-text">Property Address</span></label>
              <input 
                type="text" 
                name="property_address" 
                placeholder="Property Address" 
                className="input input-bordered w-full pr-10" 
                value={formData.property_address || ''} 
                onChange={onInputChange} 
              />
              <button 
                type="button"
                className="absolute right-2 top-10 transform -translate-y-1/2 text-gray-500 hover:text-primary"
                onClick={onGeocode}
                disabled={!formData.property_address || !isLoaded}
              >
                <MapPin size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label"><span className="label-text">City</span></label>
                <input 
                  type="text" 
                  name="property_city" 
                  placeholder="City" 
                  className="input input-bordered w-full" 
                  value={formData.property_city || ''} 
                  onChange={onInputChange} 
                />
              </div>
              <div>
                <label className="label"><span className="label-text">State</span></label>
                <input 
                  type="text" 
                  name="property_state" 
                  placeholder="State" 
                  className="input input-bordered w-full" 
                  value={formData.property_state || ''} 
                  onChange={onInputChange} 
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Postal Code</span></label>
                <input 
                  type="text" 
                  name="property_postal_code" 
                  placeholder="Postal Code" 
                  className="input input-bordered w-full" 
                  value={formData.property_postal_code || ''} 
                  onChange={onInputChange} 
                />
              </div>
            </div>

            <div>
              <label className="label"><span className="label-text">Property Type</span></label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    name="property_type" 
                    className="radio radio-primary" 
                    value="Single Family" 
                    checked={formData.property_type === 'Single Family'} 
                    onChange={onInputChange} 
                  />
                  <span className="ml-2">Single Family</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    name="property_type" 
                    className="radio radio-primary" 
                    value="Vacant Land" 
                    checked={formData.property_type === 'Vacant Land'} 
                    onChange={onInputChange} 
                  />
                  <span className="ml-2">Vacant Land</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label"><span className="label-text">Beds</span></label>
                <input 
                  type="number" 
                  name="beds" 
                  placeholder="Beds" 
                  className="input input-bordered w-full" 
                  value={formData.beds || ''} 
                  onChange={onInputChange} 
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Baths</span></label>
                <input 
                  type="number" 
                  name="baths" 
                  placeholder="Baths" 
                  className="input input-bordered w-full" 
                  value={formData.baths || ''} 
                  onChange={onInputChange} 
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Square Footage</span></label>
                <input 
                  type="number" 
                  name="square_footage" 
                  placeholder="Sq Ft" 
                  className="input input-bordered w-full" 
                  value={formData.square_footage || ''} 
                  min="0"
                  onChange={onInputChange} 
                />
              </div>
            </div>

            <div>
              <label className="label"><span className="label-text">Assessed Value</span></label>
              <input 
                type="number" 
                name="assessed_total" 
                placeholder="e.g., 250000" 
                className="input input-bordered w-full" 
                value={formData.assessed_total || ''} 
                  min="0"
                  step="0.01"
                onChange={onInputChange} 
              />
            </div>

            <div>
              <label className="label"><span className="label-text">Notes</span></label>
              <textarea 
                name="notes" 
                placeholder="Additional notes..." 
                className="textarea textarea-bordered w-full h-24" 
                value={formData.notes || ''} 
                onChange={onInputChange} 
              />
            </div>
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {isEditMode ? 'Update Lead' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
