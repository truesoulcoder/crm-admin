# Development Plan

## Objective: Fix Supabase Environment Variables and Build Issues

- [x] Rename `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_SERVICE_ROLE_KEY` for security.
- [x] Update API routes to use `SUPABASE_SERVICE_ROLE_KEY`:
    - [x] `src/app/api/normalized-leads/route.ts`
    - [x] `src/app/api/leads/upload/route.ts`
    - [x] `src/app/api/email-senders/route.ts`
    - [x] `src/app/api/email-senders/[id]/route.ts`
    - [x] `src/app/api/admin/sync-gmail-avatars/route.ts`
- [x] Update error messages in relevant files to reflect the new variable name.
- [x] Fix `__dirname` issue in `eslint.config.js` for ES module scope.
- [x] Resolve "Argument expression expected" lint error in `src/app/api/normalized-leads/route.ts`.
- [x] Ensure `npm run build` completes successfully.
- [ ] Verify all necessary environment variables are correctly set in `.env.local`, especially `SUPABASE_SERVICE_ROLE_KEY`. (User to verify)

## Next Steps
- Awaiting next USER objective.
