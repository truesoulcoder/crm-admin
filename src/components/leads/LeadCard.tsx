import { MapPin, X, ChevronDown } from 'lucide-react'; // Added X for close, ChevronDown for select
import React, { useState, useEffect } from 'react';

// Define a more comprehensive Lead type for the form, including new fields
export interface LeadData {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string;

  // Detailed address fields from the image
  property_address_full?: string; // For the main display and search
  property_address_street?: string;
  property_address_city?: string;
  property_address_state?: string;
  property_address_zip?: string;

  appraised_value?: number; // Renamed from assessed_total for clarity with image
  beds?: number;
  baths?: number;
  sq_ft?: number;

  notes?: string;

  // Retaining some fields from original LeadCardProps if they might be relevant
  // though not directly editable in this specific form design
  mls_curr_status?: string;
  mls_curr_days_on_market?: string;
  market_region?: string;
}

export interface LeadEditModalProps {
  lead: LeadData;
  isOpen: boolean; // To control modal visibility
  onClose: () => void; // To close the modal
  onUpdateLead: (updatedLead: LeadData) => void;
  onDeleteLead: (leadId: string) => void;
  // onShowMap?: ()_ => void; // Optional: if you want to handle the "Show Map" click
}

// Status options based on your original LeadCard component
const statusOptions: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  'CONTRACT-SENT': 'Contract Sent',
  'CONTRACT-SIGNED': 'Contract Signed',
  'NEEDS-DISPO': 'Needs Disposition',
  ASSIGNED: 'Assigned',
  CLOSED: 'Closed',
  DEAD: 'Dead',
  QUALIFIED: 'Qualified',
  UNQUALIFIED: 'Unqualified',
};

const LeadEditModal: React.FC<LeadEditModalProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateLead,
  onDeleteLead,
}) => {
  const [formData, setFormData] = useState<LeadData>(lead);

  useEffect(() => {
    setFormData(lead); // Update form data if the lead prop changes
  }, [lead]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? undefined : Number(value),
    }));
  };

  const handleSubmit = () => {
    onUpdateLead(formData);
  };

  const handleDelete = () => {
    onDeleteLead(formData.id);
  };

  const fullAddressForDisplay =
    formData.property_address_full ||
    [
      formData.property_address_street,
      formData.property_address_city,
      formData.property_address_state,
      formData.property_address_zip,
    ]
      .filter(Boolean)
      .join(', ') ||
    'N/A';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0d1a2e] text-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold flex items-center">
            <MapPin size={20} className="mr-2 text-gray-400" />
            Property Location - {fullAddressForDisplay}
          </h2>
          <div className="flex items-center space-x-3">
            <button
              // onClick={onShowMap} // Implement this if needed
              className="text-sm bg-white bg-opacity-10 hover:bg-opacity-20 px-3 py-1.5 rounded text-gray-200"
            >
              Show Map
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="h-48 bg-gray-700 flex items-center justify-center text-gray-500">
          {/* In a real app, you would integrate a map component here */}
          Map View (e.g., Google Maps integration)
          {/* Example: <img src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(fullAddressForDisplay)}&zoom=14&size=600x200&key=YOUR_API_KEY`} alt="Map of property" className="w-full h-full object-cover" /> */}
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-grow">
          {/* Location Section */}
          <section>
            <h3 className="text-xl font-semibold text-gray-300 mb-4">LOCATION</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-400 mb-1">
                  Status
                </label>
                <div className="relative">
                  <select
                    id="status"
                    name="status"
                    value={formData.status || ''}
                    onChange={handleChange}
                    className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm appearance-none"
                  >
                    <option value="" disabled>Select status</option>
                    {Object.entries(statusOptions).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="property_address_full" className="block text-sm font-medium text-gray-400 mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  name="property_address_full"
                  id="property_address_full"
                  value={formData.property_address_full || ''}
                  onChange={handleChange}
                  placeholder="Start typing an address..."
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="property_address_street" className="block text-sm font-medium text-gray-400 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  name="property_address_street"
                  id="property_address_street"
                  value={formData.property_address_street || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="property_address_city" className="block text-sm font-medium text-gray-400 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="property_address_city"
                  id="property_address_city"
                  value={formData.property_address_city || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="property_address_state" className="block text-sm font-medium text-gray-400 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="property_address_state"
                  id="property_address_state"
                  value={formData.property_address_state || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="property_address_zip" className="block text-sm font-medium text-gray-400 mb-1">
                  Zip
                </label>
                <input
                  type="text"
                  name="property_address_zip"
                  id="property_address_zip"
                  value={formData.property_address_zip || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="appraised_value" className="block text-sm font-medium text-gray-400 mb-1">
                  Appraised Value
                </label>
                <input
                  type="number"
                  name="appraised_value"
                  id="appraised_value"
                  value={formData.appraised_value === undefined ? '' : formData.appraised_value}
                  onChange={handleNumericChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-x-4">
                <div>
                  <label htmlFor="beds" className="block text-sm font-medium text-gray-400 mb-1">
                    Beds
                  </label>
                  <input
                    type="number"
                    name="beds"
                    id="beds"
                    value={formData.beds === undefined ? '' : formData.beds}
                    onChange={handleNumericChange}
                    className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="baths" className="block text-sm font-medium text-gray-400 mb-1">
                    Baths
                  </label>
                  <input
                    type="number"
                    name="baths"
                    id="baths"
                    value={formData.baths === undefined ? '' : formData.baths}
                    onChange={handleNumericChange}
                    className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="sq_ft" className="block text-sm font-medium text-gray-400 mb-1">
                    SQ FT
                  </label>
                  <input
                    type="number"
                    name="sq_ft"
                    id="sq_ft"
                    value={formData.sq_ft === undefined ? '' : formData.sq_ft}
                    onChange={handleNumericChange}
                    className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section>
            <h3 className="text-xl font-semibold text-gray-300 mb-4">CONTACT</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-400 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  id="first_name"
                  value={formData.first_name || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-400 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  id="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </section>

          {/* Notes Section */}
          <section>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">NOTES</h3>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={formData.notes || ''}
              onChange={handleChange}
              className="w-full bg-[#1a2b41] border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0d1a2e] border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md"
          >
            DELETE LEAD
          </button>
          <div className="space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:bg-gray-700 text-sm font-medium rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
            >
              UPDATE LEAD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadEditModal;

// Example Usage (conceptual):
// const App = () => {
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [currentLead, setCurrentLead] = useState<LeadData | null>(null);

//   const sampleLead: LeadData = {
//     id: '123',
//     first_name: 'John',
//     last_name: 'Doe',
//     email: 'john.doe@example.com',
//     phone: '555-1234',
//     status: 'UNQUALIFIED', // Matches the image's selected status
//     property_address_full: '806 IOWA ST, KEENE TX 76059',
//     property_address_street: '806 IOWA ST',
//     property_address_city: 'KEENE',
//     property_address_state: 'TX',
//     property_address_zip: '76059',
//     appraised_value: 150000,
//     beds: 3,
//     baths: 2,
//     sq_ft: 1800,
//     notes: 'Initial contact made, client is interested in a cash offer. Follow up next week.'
//   };

//   const handleOpenModal = (leadToEdit: LeadData) => {
//     setCurrentLead(leadToEdit);
//     setIsModalOpen(true);
//   };

//   const handleCloseModal = () => {
//     setIsModalOpen(false);
//     setCurrentLead(null);
//   };

//   const handleUpdate = (updatedLead: LeadData) => {
//     console.log('Updating lead:', updatedLead);
//     // API call to update lead
//     handleCloseModal();
//   };

//   const handleDelete = (leadId: string) => {
//     console.log('Deleting lead ID:', leadId);
//     // API call to delete lead
//     handleCloseModal();
//   };

//   return (
//     <div>
//       <button onClick={() => handleOpenModal(sampleLead)} className="p-2 bg-blue-500 text-white rounded">
//         Edit Lead (Open Modal)
//       </button>
//       {currentLead && (
//         <LeadEditModal
//           isOpen={isModalOpen}
//           lead={currentLead}
//           onClose={handleCloseModal}
//           onUpdateLead={handleUpdate}
//           onDeleteLead={handleDelete}
//         />
//       )}
//     </div>
//   );
// };