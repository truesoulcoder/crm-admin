# Development Plan

## Phase 1: Core CRM Features

### 1. Lead Management
    -   **Task 1.1: Data Integration & Filtering**
        -   [/] Integrate real data from `normalized_leads` table. (New component fetches data)
        -   [/] Implement filtering by user-created market regions. (New component includes dropdown filter)
    -   **Task 1.2: Table Interactivity - Basic**
        -   [/] Implement on-hover row highlighting. (New component includes hover styling)
        -   [/] Implement clickable rows that popup lead card modals. (New component implements this)
    -   **Task 1.3: Lead Card Modal**
        -   [/] Create a modal for viewing and editing lead details. (New component implements this)
        -   [/] Implement data editing and saving functionality in the modal. (New component includes save logic)
        -   [/] Implement note-adding functionality in the modal. (New component includes notes field in modal)
    -   **Task 1.4: Table Interactivity - Advanced**
        -   [/] Implement sortable columns in the leads table. (New component implements sortable columns)
        -   [/] Implement pagination with options for 25, 50, or 100 rows per page. (New component implements pagination)
    -   **Task 1.5: CSV Upload & Processing**
        -   [/] Implement functionality to upload raw CSV files. (New component implements CSV upload UI and logic)
        -   [/] Process uploaded CSVs into the `normalized_leads` table. (New component calls `/api/leads/upload` for processing)
    -   **Task 1.6: General Refinements, Bug Fixes, and Authentication**
        -   [x] Corrected JSX structural errors (e.g., mismatched/extra closing tags) in `CrmView.tsx`.
        -   [x] Replaced custom UI components (Input, Select, Button, Badge, Table, etc.) with standard HTML elements styled with DaisyUI in `CrmView.tsx`.
        -   [x] Addressed ESLint 'Promise-returning function' error in `CrmView.tsx`.
        -   [x] Added explicit types for improved type safety in `CrmView.tsx`.
        -   [x] Resolve "Auth session missing!" errors and redirect loops (Implemented robust session handling in `auth.ts`, `page.tsx`, and `RequireAuth.tsx` including `onAuthStateChange`).
        -   [x] Implement robust OAuth login flow on the home page (`page.tsx` updated with loading states, error handling, and correct use of new auth library functions).
        -   [x] Enhance `RequireAuth` component for reliable session checking and redirection (Updated `RequireAuth.tsx` to use `getSupabaseSession` and added `onAuthStateChange` listener for dynamic updates).

### 2. Email Sender Management
    -   [ ] To be defined.

### 3. Template Management
    -   [ ] To be defined.

### 4. Campaign Management
    -   [ ] To be defined.

### 5. Dashboard & Monitoring
    -   [ ] To be defined.
