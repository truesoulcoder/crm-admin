import { Mail, Phone, MapPin, Home, DollarSign, Calendar, Tag, ArrowRight } from 'lucide-react';
import React from 'react';

export interface LeadCardProps {
  lead: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    status?: string;
    property_address?: string;
    property_city?: string;
    property_state?: string;
    property_postal_code?: string;
    assessed_total?: number;
    mls_curr_status?: string;
    mls_curr_days_on_market?: string;
    market_region?: string;
  };
  onEdit?: () => void;
  onDelete?: (e?: React.MouseEvent) => void;
}

const LeadCard: React.FC<LeadCardProps> = ({ lead, onEdit, onDelete }) => {
  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'No Name';
  const address = [lead.property_address, lead.property_city, lead.property_state, lead.property_postal_code]
    .filter(Boolean)
    .join(', ');

  const statusColors: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-800',
    CONTACTED: 'bg-purple-100 text-purple-800',
    'CONTRACT SENT': 'bg-indigo-100 text-indigo-800',
    'CONTRACT SIGNED': 'bg-green-100 text-green-800',
    'NEEDS DISPO': 'bg-yellow-100 text-yellow-800',
    ASSIGNED: 'bg-teal-100 text-teal-800',
    CLOSED: 'bg-gray-100 text-gray-800',
    DEAD: 'bg-red-100 text-red-800',
    // Keep old statuses for backward compatibility
    QUALIFIED: 'bg-green-100 text-green-800',
    UNQUALIFIED: 'bg-red-100 text-red-800',
  };

  const statusText: Record<string, string> = {
    NEW: 'New',
    CONTACTED: 'Contacted',
    'CONTRACT-SENT': 'Contract Sent',
    'CONTRACT-SIGNED': 'Contract Signed',
    'NEEDS-DISPO': 'Needs Disposition',
    ASSIGNED: 'Assigned',
    CLOSED: 'Closed',
    DEAD: 'Dead',
    // Keep old statuses for backward compatibility
    QUALIFIED: 'Qualified',
    UNQUALIFIED: 'Unqualified',
  };

  const statusClass = statusColors[lead.status || 'NEW'] || 'bg-gray-100 text-gray-800';
  const statusLabel = statusText[lead.status || 'NEW'] || lead.status || 'New';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-200">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-medium text-gray-900">{fullName}</h3>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onEdit}
            className="text-gray-500 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50"
            aria-label="Edit lead"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button 
            onClick={onDelete}
            className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-red-50"
            aria-label="Delete lead"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="px-4 pt-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      {/* Contact Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-start">
          <Mail className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600">{lead.email || 'No email provided'}</div>
        </div>
        
        <div className="flex items-start">
          <Phone className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600">{lead.phone || 'No phone provided'}</div>
        </div>
        
        <div className="flex items-start">
          <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600">
            {address || 'No address provided'}
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center">
            <Home className="h-4 w-4 text-gray-400 mr-2" />
            <div>
              <div className="text-xs text-gray-500">Property</div>
              <div className="font-medium">{lead.mls_curr_status || 'N/A'}</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 text-gray-400 mr-2" />
            <div>
              <div className="text-xs text-gray-500">Value</div>
              <div className="font-medium">
                {lead.assessed_total ? `$${Number(lead.assessed_total).toLocaleString()}` : 'N/A'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center">
            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
            <div>
              <div className="text-xs text-gray-500">Days on Market</div>
              <div className="font-medium">{lead.mls_curr_days_on_market || 'N/A'}</div>
            </div>
          </div>
          
          <div className="flex items-center">
            <Tag className="h-4 w-4 text-gray-400 mr-2" />
            <div>
              <div className="text-xs text-gray-500">Market</div>
              <div className="font-medium">{lead.market_region || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-white border-t border-gray-200 flex justify-between items-center">
        <div className="text-xs text-gray-500">
          Last updated: {new Date().toLocaleDateString()}
        </div>
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
          View Details <ArrowRight className="h-4 w-4 ml-1" />
        </button>
      </div>
    </div>
  );
};

export default LeadCard;
