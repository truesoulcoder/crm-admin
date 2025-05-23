import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import LeadsView, { Lead } from '../LeadsView'; 

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(), 
  },
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock console.error to catch act warnings or other errors
const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(jest.fn());
global.confirm = jest.fn(() => true);


const mockLeadsData: Lead[] = [
  {
    id: '1', contact_name: 'John Doe', contact_email: 'john.doe@example.com', contact_type: 'Owner', market_region: 'North',
    property_address: '123 Main St', property_city: 'Anytown', property_state: 'AS', property_postal_code: '12345',
    property_type: 'SFR', baths: '2', beds: '3', year_built: '2000', square_footage: '1500', lot_size_sqft: '5000',
    assessed_total: 100000, mls_curr_status: 'Active', mls_curr_days_on_market: '10', converted: false, status: 'New Lead',
    notes: 'Initial notes', email_sent: false, created_at: new Date(2023, 0, 15).toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: '2', contact_name: 'Jane Smith', contact_email: 'jane.smith@example.com', contact_type: 'Agent', market_region: 'South',
    property_address: '456 Oak Ave', property_city: 'Otherville', property_state: 'OS', property_postal_code: '67890',
    property_type: 'Condo', baths: '1', beds: '2', year_built: '1995', square_footage: '1000', lot_size_sqft: 'N/A',
    assessed_total: 75000, mls_curr_status: 'Pending', mls_curr_days_on_market: '5', converted: true, status: 'Contacted',
    notes: 'Follow up scheduled', email_sent: true, created_at: new Date(2023, 1, 20).toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: '3', contact_name: 'Alice Brown', contact_email: 'alice.brown@example.com', contact_type: 'Owner', market_region: 'North',
    property_address: '789 Pine Ln', property_city: 'Anytown', property_state: 'AS', property_postal_code: '12347',
    property_type: 'Townhouse', baths: '2.5', beds: '3', year_built: '2010', square_footage: '1800', lot_size_sqft: '3000',
    assessed_total: 120000, mls_curr_status: 'Sold', mls_curr_days_on_market: '90', converted: true, status: 'Converted',
    notes: 'Closed deal', email_sent: true, created_at: new Date(2022, 11, 10).toISOString(), updated_at: new Date().toISOString(),
  },
];

const mockMarketRegionsData = ['North', 'South', 'East', 'West'];
const { supabase } = require('@/lib/supabase/client');

let currentSortField: keyof Lead = 'created_at';
let currentSortDirection: 'asc' | 'desc' = 'desc';
let currentLeadsData: Lead[] = [...mockLeadsData];

const setupSupabaseMocks = (leadsDataInput = mockLeadsData, regionsData = mockMarketRegionsData) => {
    currentLeadsData = [...leadsDataInput]; // Use a copy
    currentSortField = 'created_at'; // Reset sort for each setup
    currentSortDirection = 'desc';

    supabase.from.mockImplementation((tableName) => {
      // console.log(`Supabase from: ${tableName}`);
      return supabase; // Return chainable mock
    });
    
    supabase.select.mockImplementation((selectArgs) => {
        // Market regions count
        if (typeof selectArgs === 'string' && selectArgs.includes('market_region') && selectArgs.includes('exact')) {
            // console.log('Mocking market regions count');
            return Promise.resolve({ data: null, count: regionsData.length, error: null });
        }
        // Market regions distinct list
        if (typeof selectArgs === 'string' && selectArgs.includes('market_region')) {
            // console.log('Mocking market regions list');
            const uniqueRegions = Array.from(new Set(regionsData.map(r => ({ market_region: r })))).sort((a,b) => a.market_region.localeCompare(b.market_region));
            return Promise.resolve({ data: uniqueRegions, error: null });
        }
        // Default for fetching leads (select('*', { count: 'exact' }))
        // console.log('Mocking leads select, returning chainable object');
        return supabase; // Return chainable mock for .order().range() etc.
    });

    supabase.order.mockImplementation((field, options) => {
        // console.log(`Mock supabase.order: ${field}, asc: ${options?.ascending}`);
        currentSortField = field as keyof Lead;
        currentSortDirection = options?.ascending ? 'asc' : 'desc';
        return supabase; 
    });

    supabase.range.mockImplementation(async (from, to) => {
        // console.log(`Mock supabase.range from: ${from} to: ${to} | Sort: ${currentSortField} ${currentSortDirection}`);
        const sortedData = [...currentLeadsData].sort((a, b) => {
            const valA = a[currentSortField];
            const valB = b[currentSortField];

            if (valA === null || valA === undefined) return currentSortDirection === 'asc' ? -1 : 1;
            if (valB === null || valB === undefined) return currentSortDirection === 'asc' ? 1 : -1;

            if (typeof valA === 'number' && typeof valB === 'number') {
                return currentSortDirection === 'asc' ? valA - valB : valB - valA;
            }
            if (typeof valA === 'string' && typeof valB === 'string') {
                 // Special case for numeric strings like mls_curr_days_on_market
                if (currentSortField === 'mls_curr_days_on_market') {
                    const numA = parseInt(valA, 10);
                    const numB = parseInt(valB, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                         return currentSortDirection === 'asc' ? numA - numB : numB - numA;
                    }
                }
                // Date string comparison for created_at
                if (currentSortField === 'created_at' || currentSortField === 'updated_at') {
                    const dateA = new Date(valA).getTime();
                    const dateB = new Date(valB).getTime();
                    return currentSortDirection === 'asc' ? dateA - dateB : dateB - dateA;
                }
                return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return 0;
        });
        // console.log('Sorted data in range mock:', sortedData.map(s => s.contact_name));
        return Promise.resolve({ data: sortedData.slice(from, to + 1), count: sortedData.length, error: null });
    });

    supabase.update.mockResolvedValue({ data: [currentLeadsData[0]], error: null }); // Default successful update
    supabase.delete.mockResolvedValue({ error: null }); // Default successful delete
    supabase.eq.mockReturnThis();
    supabase.or.mockReturnThis();
    supabase.not.mockReturnThis();
};


describe('LeadsView Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupSupabaseMocks(); 

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 1, message: 'Successfully uploaded 1 leads.' }),
    });
    global.confirm = jest.fn(() => true);
    consoleErrorMock.mockClear();
  });

  // 1. Rendering Tests
  describe('Rendering', () => {
    it('renders without crashing', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('Lead Management')).toBeInTheDocument());
    });

    it('displays main elements', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('Lead Management')).toBeInTheDocument());
      expect(screen.getByText('Upload Leads CSV')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Contact Info')).toBeInTheDocument();
      expect(screen.getByText('Property Address')).toBeInTheDocument();
      expect(screen.getByText('Days on Market')).toBeInTheDocument(); // Check for added column
    });
  });

  // 2. Data Fetching and Display
  describe('Data Fetching and Display', () => {
    it('fetches and displays lead data correctly', async () => {
      // Default mockLeadsData has 3 leads.
      render(<LeadsView />);
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(1 + 3); // Header + 3 data rows
    });
  });

  // 3. Table Functionality
  describe('Table Functionality', () => {
    describe('Sorting', () => {
      it('sorts by "Contact Info" (contact_name) when header is clicked', async () => {
        render(<LeadsView />);
        await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument()); // Initial default sort (created_at desc)

        const contactInfoHeader = screen.getByText('Contact Info');
        
        // Click to sort Ascending by contact_name
        fireEvent.click(contactInfoHeader);
        await waitFor(() => {
          const rows = screen.getAllByRole('row');
          expect(rows[1].textContent).toContain('Alice Brown');
          expect(rows[2].textContent).toContain('Jane Smith');
          expect(rows[3].textContent).toContain('John Doe');
        });

        // Click to sort Descending by contact_name
        fireEvent.click(contactInfoHeader);
        await waitFor(() => {
          const rows = screen.getAllByRole('row');
          expect(rows[1].textContent).toContain('John Doe');
          expect(rows[2].textContent).toContain('Jane Smith');
          expect(rows[3].textContent).toContain('Alice Brown');
        });
      });

       it('sorts by "Days on Market" (mls_curr_days_on_market) numerically', async () => {
        render(<LeadsView />);
        await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

        const domHeader = screen.getByText('Days on Market');
        
        // Ascending
        fireEvent.click(domHeader);
        await waitFor(() => {
          const rows = screen.getAllByRole('row');
          expect(rows[1].textContent).toContain('Jane Smith'); // 5 days
          expect(rows[2].textContent).toContain('John Doe');   // 10 days
          expect(rows[3].textContent).toContain('Alice Brown'); // 90 days
        });

        // Descending
        fireEvent.click(domHeader);
        await waitFor(() => {
          const rows = screen.getAllByRole('row');
          expect(rows[1].textContent).toContain('Alice Brown'); // 90 days
          expect(rows[2].textContent).toContain('John Doe');   // 10 days
          expect(rows[3].textContent).toContain('Jane Smith'); // 5 days
        });
      });
    });

    describe('Pagination', () => {
        const paginatedLeads = Array.from({ length: 55 }, (_, i) => ({
            ...mockLeadsData[0], id: `pg-lead-${i}`, contact_name: `Pg User ${i}`,
            created_at: new Date(2023, 0, i + 1).toISOString(),
        }));

        beforeEach(() => {
            setupSupabaseMocks(paginatedLeads);
        });

        it('navigates to the next and previous pages', async () => {
            render(<LeadsView />);
            await waitFor(() => expect(screen.getByText('Pg User 0')).toBeInTheDocument());
            expect(screen.getByText('Page 1 of 3 (Total: 55 leads)')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Next »' }));
            await waitFor(() => expect(screen.getByText('Pg User 25')).toBeInTheDocument());
            expect(screen.getByText('Page 2 of 3 (Total: 55 leads)')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: '« Prev' }));
            await waitFor(() => expect(screen.getByText('Pg User 0')).toBeInTheDocument());
            expect(screen.getByText('Page 1 of 3 (Total: 55 leads)')).toBeInTheDocument();
        });

        it('changes rows per page', async () => {
            render(<LeadsView />);
            await waitFor(() => expect(screen.getByText('Pg User 0')).toBeInTheDocument());
            
            // Find the select element for rows per page. This assumes it's the only select other than region filter.
            const rowsPerPageSelect = screen.getAllByRole('combobox').find(
              (el) => (el as HTMLSelectElement).value === "25" && el.id !== "marketRegionFilter" // Assuming region filter has an ID
            ) as HTMLSelectElement; 
            expect(rowsPerPageSelect).toBeInTheDocument();

            fireEvent.change(rowsPerPageSelect!, { target: { value: '50' } });
            await waitFor(() => {
              expect(screen.getByText('Page 1 of 2 (Total: 55 leads)')).toBeInTheDocument();
              const rows = screen.getAllByRole('row');
              expect(rows.length).toBe(1 + 50); 
            });
        });
    });
  });

  // 4. Modal Functionality
  describe('Modal Functionality', () => {
    it('opens modal with correct data on row click and closes it', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

      fireEvent.click(screen.getByText('John Doe')); 
      
      await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());
      expect(screen.getByLabelText('Contact Name')).toHaveValue('John Doe');
      expect(screen.getByLabelText('Contact Email')).toHaveValue('john.doe@example.com');
      expect(screen.getByLabelText('Contact Type*')).toHaveValue('Owner');
      expect(screen.getByLabelText('Notes')).toHaveValue('Initial notes');
      expect(screen.getByLabelText('Converted')).not.toBeChecked();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('updates form data on input change in modal', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Jane Smith')); // Open for Jane (converted=true)
      await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());

      const contactNameInput = screen.getByLabelText('Contact Name');
      fireEvent.change(contactNameInput, { target: { value: 'Jane S. Updated' } });
      expect(contactNameInput).toHaveValue('Jane S. Updated');
      
      const convertedCheckbox = screen.getByLabelText('Converted');
      expect(convertedCheckbox).toBeChecked(); // Initially true for Jane
      fireEvent.click(convertedCheckbox); // Toggle it to false
      expect(convertedCheckbox).not.toBeChecked();
    });

    it('saves changes and closes modal', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
      fireEvent.click(screen.getByText('John Doe'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());

      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Updated notes via test.' } });
      fireEvent.click(screen.getByLabelText('Converted')); // Toggle to true

      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

      await waitFor(() => {
        expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({
          notes: 'Updated notes via test.',
          converted: true, 
        }));
        expect(supabase.eq).toHaveBeenCalledWith('id', mockLeadsData[0].id);
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('deletes lead and closes modal', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('Alice Brown')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Alice Brown'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeVisible());

      fireEvent.click(screen.getByRole('button', { name: /Delete Lead/i }));
      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this lead? This action cannot be undone.');
      
      await waitFor(() => {
        expect(supabase.delete).toHaveBeenCalledTimes(1);
        expect(supabase.eq).toHaveBeenCalledWith('id', mockLeadsData[2].id); // Alice Brown's ID
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
  
  // 5. CSV Upload (Client-Side Interaction)
  describe('CSV Upload Functionality', () => {
    // To make this test pass, add data-testid="csvFile-input" to the <input type="file" ... /> in LeadsView.tsx
    it('updates state on file select and market region input, then triggers API call', async () => {
      render(<LeadsView />);
      await waitFor(() => expect(screen.getByText('Lead Management')).toBeInTheDocument());

      const file = new File(['contact_name,contact_email\nTest User,test@example.com'], 'test.csv', { type: 'text/csv' });
      // This assumes you've added data-testid="csvFile-input" to your file input element
      const hiddenFileInput = screen.getByTestId('csvFile-input'); 
      
      Object.defineProperty(hiddenFileInput, 'files', { value: [file] });
      fireEvent.change(hiddenFileInput);
      
      await waitFor(() => expect(screen.getByText(file.name)).toBeInTheDocument());

      const marketRegionInput = screen.getByLabelText('Market Region for Uploaded Leads:');
      fireEvent.change(marketRegionInput, { target: { value: 'CSV Test Region' } });
      expect(marketRegionInput).toHaveValue('CSV Test Region');

      const uploadButton = screen.getByRole('button', { name: /Upload Leads/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/leads/upload', expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData), 
        }));
      });
      
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const formDataSent = fetchCall[1].body as FormData;
      expect(formDataSent.get('file')).toEqual(file);
      expect(formDataSent.get('market_region')).toBe('CSV Test Region');

      // Verify leads list refreshed
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('useful_leads');
        // This checks if the select call for leads was made again after upload
        // The number of times it's called depends on initial load + post-upload refresh
        expect(supabase.select).toHaveBeenCalledWith('*', { count: 'exact' });
      });
    });
  });
});
