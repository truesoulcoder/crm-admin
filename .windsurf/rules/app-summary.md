---
trigger: always_on
---

CRM Admin App Codebase Summary

Purpose: This is a modern CRM admin application focused on lead management, campaign management, sender (email account) management, template management, and dashboard analytics. It is designed for real estate or property lead workflows, supporting both admin and lower-level employee roles.

Core Features:

1. Lead Management: Upload, normalize, and manage leads from CSV files. Leads are displayed in an editable, sortable, filterable, and paginated table. Each row can be clicked to open a modal for editing lead details and adding notes.
2. CRM View: Similar to lead management but for individual lead handling by employees. Allows adding/editing leads one at a time with the same table features.
3. Email Sender Management: Manage Gmail accounts used for sending emails, supporting domain-wide delegation and impersonation. Senders can be added, edited, or bulk-uploaded via CSV.
4. Template Management: Create, edit, and save email and document templates (e.g., LOIs). Templates support placeholders for dynamic content and are used in campaigns.
5. Campaign Management: Create and manage email campaigns, selecting templates, senders, and market regions. Campaigns support quota-based, interval-driven sending to avoid spam filters.
6. Dashboard: Real-time monitoring of operations, KPIs, and campaign performance. Displays stats, charts, and activity logs for admin oversight.

Tech Stack:
1. Frontend: Next.js (React), DaisyUI, Once UI, Lucide icons, Tiptap (for rich text editing in templates).
2. Backend/Services: Supabase (database and auth), custom API endpoints, integration with Gmail API for sender impersonation.
3. Other: TypeScript throughout, modular component structure, modern state management, and strong type safety.

Key Architectural Notes:
1. Uses modular views for each major feature: LeadsView, CrmView, DashboardView, CampaignsView, EmailSendersView, TemplatesView.
2. Auth is enforced for all main pages.
3. Data fetching and mutations are handled via Supabase and REST endpoints.
4. UI is designed for usability: sortable/filterable tables, modals for editing, and real-time feedback.

Intended User Roles:
1. Admins: Full access to lead uploads, campaign management, sender and template configuration, and dashboard analytics.
2. Employees: Work assigned leads individually in a CRM-like interface.

In summary:

This app is a full-featured, modern CRM admin panel for real estate lead management and outreach automation, with strong emphasis on usability, real-time analytics, and operational control.

