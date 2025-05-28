import 'daisyui/dist/full.css';

import { MapPin, X } from 'lucide-react';
import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';

import { useGoogleMapsApi } from '@/components/maps/GoogleMapsLoader';
import { Database } from '@/types/db_types';

interface LeadFormModalProps {
  lead?: Partial<Database['public']['Tables']['crm_leads']['Row']>;
  onClose: () => void;
  onSubmit: (lead: Partial<Database['public']['Tables']['crm_leads']['Insert']>) => void;
  isOpen: boolean;
  isLoaded: boolean;
  initialPanoramaPosition?: { lat: number; lng: number } | null;
}

const LeadFormModal = ({ 
  lead = {}, 
  onClose, 
  onSubmit, 
  isOpen, 
  isLoaded,
  initialPanoramaPosition = null
}: LeadFormModalProps) => {
  const { isLoaded: mapsLoaded, loadError } = useGoogleMapsApi();
  const [streetViewLoaded, setStreetViewLoaded] = useState(false);
  const [panoramaPosition, setPanoramaPosition] = useState<{ lat: number; lng: number } | null>(initialPanoramaPosition);
  const [formData, setFormData] = useState<Partial<Database['public']['Tables']['crm_leads']['Row']>>(lead);

  const initStreetView = useCallback(async () => {
    if (!formData.property_address || !mapsLoaded || loadError) return;

    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ address: formData.property_address });
      
      if (response.results[0]) {
        const location = response.results[0].geometry.location;
        setPanoramaPosition({ 
          lat: location.lat(), 
          lng: location.lng() 
        });
        setStreetViewLoaded(true);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error loading StreetView:', error.message);
      } else {
        console.error('Unknown error loading StreetView');
      }
    }
  }, [mapsLoaded, loadError, formData.property_address]);

  useEffect(() => {
    void initStreetView();
  }, [initStreetView]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      void onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      // Optionally, handle error display to the user
    }
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: Partial<Database['public']['Tables']['crm_leads']['Row']>) => ({
      ...prev,
      [name]: value
    }));
  };

  const onGeocode = () => {
    // implement onGeocode logic
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
          <X size={18} />
        </button>
        <h3 className="font-bold text-lg mb-4">{formData.property_address || (lead ? 'Edit Lead' : 'Add New Lead')}</h3>
        
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
              <label className="label"><span className="label-text">Contact Name</span></label>
              <input 
                type="text" 
                name="contact_name" 
                placeholder="Contact Name" 
                className={`input input-sm input-bordered w-full ${formData.contact_name ? 'input-success' : ''}`} 
                value={formData.contact_name || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Contact Email</span></label>
              <input 
                type="email" 
                name="contact_email" 
                placeholder="Contact Email" 
                className={`input input-sm input-bordered w-full ${formData.contact_email ? 'input-success' : ''}`} 
                value={formData.contact_email || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Contact Type</span></label>
              <input 
                type="text" 
                name="contact_type" 
                placeholder="Contact Type" 
                className={`input input-sm input-bordered w-full ${formData.contact_type ? 'input-success' : ''}`} 
                value={formData.contact_type || ''} 
                onChange={onInputChange} 
              />
            </div>
            <div>
              <label className="label"><span className="label-text">Contact Phone</span></label>
              <input 
                type="tel" 
                name="contact_phone" 
                placeholder="Contact Phone" 
                className={`input input-sm input-bordered w-full ${formData.contact_phone ? 'input-success' : ''}`} 
                value={formData.contact_phone || ''} 
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
                className={`input input-sm input-bordered w-full pr-10 ${formData.property_address ? 'input-success' : ''}`} 
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
                  className={`input input-sm input-bordered w-full ${formData.property_city ? 'input-success' : ''}`} 
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
                  className={`input input-sm input-bordered w-full ${formData.property_state ? 'input-success' : ''}`} 
                  value={formData.property_state || ''} 
                  onChange={onInputChange} 
                />
              </div>
              <div>
                <label className="label"><span className="label-text">Zip</span></label>
                <input 
                  type="text" 
                  name="property_zip" 
                  placeholder="Zip" 
                  className={`input input-sm input-bordered w-full ${formData.property_zip ? 'input-success' : ''}`} 
                  value={formData.property_zip || ''} 
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
                className={`input input-sm input-bordered w-full ${formData.assessed_total ? 'input-success' : ''}`} 
                value={formData.assessed_total || ''} 
                min="0"
                step="0.01"
                onChange={onInputChange} 
              />
            </div>

            <div>
              <label className="label"><span className="label-text">Property Type</span></label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input 
                    type="radio" 
                    name="property_type" 
                    className="radio radio-sm radio-primary" 
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
                    className="radio radio-sm radio-primary" 
                    value="Vacant Land" 
                    checked={formData.property_type === 'Vacant Land'} 
                    onChange={onInputChange} 
                  />
                  <span className="ml-2">Vacant Land</span>
                </label>
              </div>
            </div>

            {formData.property_type === 'Single Family' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="label"><span className="label-text">Square Footage</span></label>
                  <input 
                    type="number" 
                    name="square_footage" 
                    placeholder="Square Footage" 
                    className={`input input-sm input-bordered w-full ${formData.square_footage ? 'input-success' : ''}`} 
                    value={formData.square_footage || ''} 
                    onChange={onInputChange} 
                  />
                </div>
                <div>
                  <label className="label"><span className="label-text">Beds</span></label>
                  <input 
                    type="number" 
                    name="beds" 
                    placeholder="Beds" 
                    className={`input input-sm input-bordered w-full ${formData.beds ? 'input-success' : ''}`} 
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
                    className={`input input-sm input-bordered w-full ${formData.baths ? 'input-success' : ''}`} 
                    value={formData.baths || ''} 
                    onChange={onInputChange} 
                  />
                </div>
                <div>
                  <label className="label"><span className="label-text">Year Built</span></label>
                  <input 
                    type="number" 
                    name="year_built" 
                    placeholder="Year Built" 
                    className={`input input-sm input-bordered w-full ${formData.year_built ? 'input-success' : ''}`} 
                    value={formData.year_built || ''} 
                    onChange={onInputChange} 
                  />
                </div>
              </div>
            )}

            {formData.property_type === 'Vacant Land' && (
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div>
                  <label className="label"><span className="label-text">Lot Size (sqft)</span></label>
                  <input 
                    type="number" 
                    name="lot_size_sqft" 
                    placeholder="Lot Size" 
                    className={`input input-sm input-bordered w-full ${formData.lot_size_sqft ? 'input-success' : ''}`} 
                    value={formData.lot_size_sqft || ''} 
                    onChange={onInputChange} 
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label"><span className="label-text">Notes</span></label>
              <textarea 
                name="notes" 
                placeholder="Additional notes..." 
                className={`textarea textarea-sm textarea-bordered w-full h-24 ${formData.notes ? 'textarea-success' : ''}`} 
                value={formData.notes || ''} 
                onChange={onInputChange} 
              />
            </div>
          </div>

          {/* StreetView Container */}
          {streetViewLoaded && panoramaPosition && (
            <div className="mt-4 h-64 w-full">
              <div 
                id="street-view" 
                className="h-full w-full rounded-lg border border-gray-200"
                ref={(ref) => {
                  if (ref && !ref.hasChildNodes() && panoramaPosition) {
                    new google.maps.StreetViewPanorama(ref, {
                      position: panoramaPosition,
                      pov: { heading: 165, pitch: 0 },
                      zoom: 1
                    });
                  }
                }}
              />
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {lead ? 'Update Lead' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
