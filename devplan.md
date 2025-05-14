# CRMPro Development Plan

## Tech Stack
- Frontend: Next.js (React), DaisyUI 5, Tailwind CSS 4
- Backend: Node.js (Express), Supabase

## Features
- DaisyUI 5 and Tailwind CSS 4 setup (frontend)
- Next.js app scaffolded
- Node.js backend scaffolded
- Supabase ready for integration

## Completed UI Features (Mock Data)
- **Dashboard View:** 
  - [x] Revamped with enhanced mock data structures.
  - [x] Implemented general statistics cards (Total Leads, Active Campaigns, Avg. Open Rate, Deals Closed).
  - [x] Added `recharts` bar chart for Campaign Performance (Sent, Opened, Clicked).
  - [x] Add i.pravatar.cc to next/image domains for external avatars.
  - [x] Added `recharts` bar chart for Lead Conversion Funnel.
  - [x] Implemented User KPI Leaderboard table (Rank, Avatar, Name, Role, Leads, Deals, Revenue, Activity Score).
  - [x] Updated Recent Activity log with more relevant mock entries.
  - [ ] Image optimization: Address `<img>` tag warning in `DashboardView.tsx` (line 223).
- **Leads View:** Basic table structure with mock data for leads, including filtering.
  - [x] Functional "Create New Lead" button (placeholder for modal).
  - [x] Filters and search functionality for leads.
- **Campaigns View:** Table display for email campaigns with status, metrics, and mock data.
  - [x] Functional "Create New Campaign" button opening a modal.
  - [x] Mock modal for creating new campaigns (name, subject, template selection).
  - [x] Fix Avatar error by only passing either 'src' or 'value', not both, in CampaignsView when clicking new campaign.
  - [x] Supabase integration for campaign creation (modal submission saves to DB, error handling, feedback, refreshes list).
  - [x] Fix TypeError in CampaignsView: Added null checks for user.name in AvatarGroup and Avatar components.
  - [x] Enhanced Sender Selection UI: 
    - Selected senders are filtered from the available list (appear to "move" to selected group).
    - Selected senders display horizontally with actual profile pictures (if available).
    - Implemented deselection by clicking a small 'x' icon that appears on hover over selected avatars.
    - [x] Synced Gmail profile pictures for senders and display them in the selection UI.
- **Templates View:** Card display for message templates (email/SMS) with filtering and mock data.
  - [x] Functional "Create New Template" button opening a modal.
  - [x] Mock modal for creating new templates (name, type, subject, category, body).
  - [ ] Image optimization: Address `<img>` tag warning in `TemplatesView.tsx` (line 187).
- **User Accounts View:** Table display for user management with roles, statuses, and mock data.
  - [x] Implement search and filter functionality.
  - [x] "Add New User" button (previously "Invite New User").
  - [ ] Image optimization: Address `<img>` tag warning in `UserAccountsView.tsx` (line 186).
- **Settings View:** Tabbed interface for various application settings (Profile, Appearance, Notifications, Security) with mock data and basic controls.
- **Sidebar Navigation:** Updated to use Next.js routing for all sections.

## Completed Features
### Market Region Feature Integration
- **Status:** Completed
- **Description:** Integrated a `market_region` field into the lead upload process. This involved:
    - Modifying SQL scripts (`setup_tables.sql`, `setup_functions.sql`, `setup_index.sql`, `cleanup.sql`) to add the `market_region` column to `normalized_leads`, update the `normalize_staged_leads` function to accept and process this new field, and remove old archiving logic.
    - Updating the frontend `LeadUploader.tsx` component to include an input field for `market_region` and send it with the lead data.
    - Modifying the backend API route `/api/leads/upload/route.ts` to receive the `market_region`, pass it to the updated Supabase normalization function, and update Supabase client initialization (removing deprecated `@supabase/auth-helpers-nextjs` and confirming correct usage of `@supabase/supabase-js` for service role client).
    - Increase max file size for CSV uploads to 50MB and enforce it in the API.
    - Lint the codebase after making the changes.
    - This change simplifies lead categorization and management by directly associating leads with a market region upon upload, replacing a more complex archiving system.

### API Endpoints for Document Templates
- **Status:** Completed
- **Description:** Created API endpoints for managing document templates.
    - Created `src/app/api/document-templates/route.ts`.
    - Implemented `GET` handler to fetch all active document templates.
    - Implemented `POST` handler to create a new document template with Zod validation.
    - Created `src/app/api/document-templates/[id]/route.ts` for individual template operations.
    - Implemented `GET` handler in `[id]/route.ts` to fetch a single template by ID.
    - Implemented `PUT` handler in `[id]/route.ts` to update a template.
    - Implemented `DELETE` handler in `[id]/route.ts` to deactivate/delete a template.

### Document Template Management UI
- **Status:** Completed
- **Description:** Developed the user interface for managing document templates.
  - [x] **List Templates:** Fetch and display all document templates from the API.
  - [x] **Create Template:** Implement a modal/form to create new templates (name, type, subject, content, placeholders).
  - [x] **Edit Template:** Implement functionality to edit existing templates.
  - [x] **Delete Template:** Implement functionality to soft-delete templates.
  - [ ] **Rich Text Editor:** Integrate a rich text editor for the `content` field.
  - [ ] **Filtering & Sorting:** Add options to filter templates (e.g., by type, active status) and sort them.
  - [ ] **UI/UX Enhancements:** Improve overall look, feel, and user experience (e.g., toast notifications, better loading/error states).

## Next Steps
- [x] Engine DB schema (users, templates, campaigns, allocations, jobs, tasks, logs)
- [x] Define TS engine types matching DB schema
- [x] Gmail, PDF, template & Supabase admin service modules
- [x] Campaign engine loop implementation
- [x] API routes: start/stop campaign
- [x] Daily quota reset via pg_cron
- Write unit tests for engine modules
- Integrate frontend controls to trigger engine start/stop

---
(Features will be logged here as implemented)
