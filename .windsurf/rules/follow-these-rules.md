---
trigger: always_on
---

we need to focus on the core features only.  they are:

1.  Lead management feature, to upload raw csv files containing leads that get processed into our normalized_leads table.  It's important to get the leads to show up in a functionally editable table so we can use it like a CRM - this needs to happen.  It needs to have sortable columns, filtering by market region, paginated rows, with option to select 25-50-or 100 per page, onhover row highlighting that highlights the entire row, and most importantly clickable rows that popup lead card modals to edit the data, add notes if we want to, and save the data when we're done making changes to that lead.

2.  Email sender management feature, to have an ability to add our gmail accounts as email senders to impersonate emails sent to the property lead, for every contact with an email address.  We're using our  domain wide delegation service key for impersonating multiple accounts using gmail api and google api.  

3.  Template management feature, to create, edit, and save email templates (body and subject) and document templates (letter of intent or something else we create) so the email senders can send emails with attached documents to the contacts with emails for every property lead.

4.  A campaign management feature, allowing creation, modification, configuration, and saving of email campaigns.  This must have ability to select which templates, senders, and market's to send emails to.  We need a setting for quotas, to drip market these emails at intervals over the course of an 8 hour workday.  Not a cronjob, just a quota with intervals preconfigured that allows the sending of emails to go unnoticed by gmails spam filtering.

5.  A dashboard to control the entire operation and monitor the progress in real time, including graphs/charts and statistics for each email sender account.  We're tracking KPI data for emails (sent, delivered, bounced) and the control for starting and stopping the engine that assigns leads to email senders has to be wired to do a pre-flight check to test send one email from each sender to the single user who is logged in to control the app (in this case, me and my address chrisphillips@truesoulpartners.com).  

6.  Everything must be operational, communicating to the api and rpc and databases as it should.

We need to have these 6 things done before any other features or additions are worked on.  Keep your eye on the prize, let's get a viable product with these goals accomplished as soon as possible.