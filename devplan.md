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

### 2. Email Sender Management
    -   [ ] To be defined.

### 3. Template Management
    -   [ ] To be defined.

### 4. Campaign Management
    -   [ ] To be defined.

### 5. Dashboard & Monitoring
    -   [ ] To be defined.
    - [ ] Fix `no-misused-promises` for async event handler around line 380.
    - [ ] Fix `no-misused-promises` for async event handler around line 402.


## Objective: Resolve ESLint Errors in viewStore.ts

- [ ] **File:** `src/stores/viewStore.ts`
    - [x] Fix `import/order` at line 2 (add empty line between import groups).
    - [ ] Configure ESLint (`.eslintrc.json`) to use `eslint-import-resolver-typescript` for path alias resolution.
        - [x] Add `settings.import/resolver.typescript` to `.eslintrc.json`.
        - [ ] **USER ACTION:** Install `eslint-import-resolver-typescript` dev dependency (`npm install --save-dev eslint-import-resolver-typescript`).
    - [ ] Fix `import/named` at line 3 (`CrmView` not found in `@/types`) - *should be resolved by ESLint resolver update*.
    - [ ] Fix `@typescript-eslint/no-unsafe-assignment` at line 12 - *should be resolved by ESLint resolver update*.

## Objective: Resolve ESLint Errors in gmailService.ts

- [ ] **File:** `src/services/gmailService.ts`
    - [x] Fix `import/first` at line 3 (reorder import to top).
    - [x] Fix `prefer-template` at line 43 (use template literal for string concatenation).
    - [x] Fix `prefer-const` at line 44 (change 'let message' to 'const message').

## Objective: Resolve ESLint Errors in Background.tsx

- [ ] **File:** `src/once-ui/components/Background.tsx`
    - [x] Fix multiple `import/order` violations (lines 3, 4, 5, 6, 7) by adding empty lines and reordering.
    - [x] Fix `import/order` for `./Background.module.scss` to be before `./Flex` (around line 9).
    - [x] Fix `import/order` for `classnames` to be before `react` (around line 3).
    - [x] Fix `import/no-named-as-default-member` for `React.ComponentProps`, `React.CSSProperties`, and `React.ReactNode` by using named imports.
    - [x] Fix `no-restricted-imports` for `../types` on line 4 (used `@/once-ui/types`).
    - [x] Fix `no-restricted-imports` for `../interfaces` on line 6 (used `@/once-ui/interfaces`).
    - [x] Fix `prefer-template` (unexpected string concatenation) at line 89.

## Objective: Resolve ESLint Errors in pdfService.ts

- [ ] **File:** `src/services/pdfService.ts`
    - [x] Fix `import/no-named-as-default-member` for `puppeteer.launch` (line 8).
    - [x] Fix TypeScript error: Convert `Uint8Array` from `page.pdf()` to `Buffer` (line 18).

## Objective: Resolve ESLint Errors in campaignEngine.ts

- [ ] **File:** `src/services/campaignEngine.ts`
    - [x] Update import paths in `campaignEngine.ts` as types from `engine.ts` were merged. `Campaign`, `User`, `CampaignJob`, `NormalizedLead` resolved.
    - [ ] **TODO:** Determine source/definition for `EmailTask` and `CampaignUserAllocation` (currently commented out/placeholders).
    - [ ] Re-evaluate and fix `import/order` errors (e.g., empty lines, order of aliased vs. local).
    - [ ] Fix `@typescript-eslint/no-unused-vars` for `Campaign`.
    - [ ] Address remaining `@typescript-eslint/no-unsafe-*` warnings after type resolution.
        - [x] Fix `no-restricted-imports` for `../services/supabaseAdminService` (line 1) to use `@/services/supabaseAdminService`.
        - [x] Fix `import/order` for missing empty line after `../services/supabaseAdminService` import (line 1).
        - [x] Address `import/no-useless-path-segments` warning for `../services/supabaseAdminService` (line 1) - *alias fix should cover this*.
        - [x] Fix `import/order` for `./pdfService` and `./templateService` (line 4).
        - [x] Fix `import/order` for missing empty line (line 5).
        - [ ] Re-evaluate and fix `import/order` issues after main type resolution.
        - [x] Fix `no-restricted-imports` for `../types/engine` (line 6) to use `@/types/engine`.
        - [x] Fix `import/order` for `../types/engine` and `./logService` (line 6).

## Objective: Resolve ESLint Errors in Tooltip.tsx

- [ ] **File:** `src/once-ui/components/Tooltip.tsx`
    - [ ] Fix `import/order` for `classnames` and `react` (line 4).
    - [ ] Investigate and address `import/no-cycle` warning (line 6).
    - [ ] Fix `import/order` for missing empty line (line 6).
    - [ ] Fix `no-restricted-imports` for `../icons` (line 7) to use `@/once-ui/icons`.
    - [ ] Fix `import/order` for `../icons` and `.` (line 7).

## Objective: Resolve ESLint Errors in Text.tsx

- [ ] **File:** `src/once-ui/components/Text.tsx`
    - [ ] Fix `import/order` for `classnames` and `react` (line 4).
    - [ ] Fix `no-restricted-imports` for `../interfaces` (line 6) to use `@/once-ui/interfaces`.
    - [ ] Fix `import/named` for `TextProps` (line 6) - *may depend on eslint-import-resolver-typescript setup*.
    - [ ] Fix `no-restricted-imports` for `../types` (line 7) to use `@/once-ui/types`.

## Objective: Resolve ESLint Errors in StatusIndicator.tsx

- [ ] **File:** `src/once-ui/components/StatusIndicator.tsx`
    - [ ] Fix `import/order` for missing empty line (line 4).
    - [ ] Fix `import/order` for `classnames` and `react` (line 4).
    - [ ] Fix `import/order` for `./Flex` and `./StatusIndicator.module.scss` (line 6).
    - [ ] Fix `import/no-named-as-default-member` for `React.ComponentProps` (line 8).

## Objective: Resolve ESLint Errors in SmartImage.tsx

- [ ] **File:** `src/once-ui/components/SmartImage.tsx`
    - [ ] Fix `import/order` for `next/image` and `react` (line 4).
    - [ ] Investigate and address `import/no-cycle` warning (line 6).
    - [ ] Fix `import/no-named-as-default-member` for `React.ComponentProps` (line 8).
    - [ ] Fix `@typescript-eslint/no-unused-vars` for `event` (line 56) by renaming to `_event` or removing.
    - [ ] Fix `no-useless-escape` for `\/` (line 105).
    - [ ] Fix `no-useless-escape` for `\/` (line 111).
    - [ ] Fix `object-shorthand` (line 152).
    - [ ] Fix `object-shorthand` (line 165).
    - [ ] Fix `object-shorthand` (line 178).

## Objective: Resolve ESLint Errors in Skeleton.tsx

- [ ] **File:** `src/once-ui/components/Skeleton.tsx`
    - [ ] Fix `import/order` for `classnames` and `react` (line 4).
    - [ ] Fix `import/order` for `./Flex` and `./Skeleton.module.scss` (line 7).
    - [ ] Fix `import/no-named-as-default-member` for `React.ComponentProps` (line 9).

## Objective: Resolve ESLint Errors in LetterFx.tsx

- [ ] **File:** `src/once-ui/components/LetterFx.tsx`
    - [ ] Fix `import/order` for `classnames` and `react` (line 4).
    - [ ] Fix `@typescript-eslint/no-floating-promises` (line 103).

## Objective: Resolve ESLint Errors in Icon.tsx

- [ ] **File:** `src/once-ui/components/Icon.tsx`
    - [ ] Fix `import/order` for `react` and `classnames` (line 3).
    - [ ] Fix `import/order` for missing empty line (line 5).
    - [ ] Fix `no-restricted-imports` for `../icons` (line 6) to use `@/once-ui/icons`.
    - [ ] Fix `no-restricted-imports` for `../types` (line 7) to use `@/once-ui/types`.
    - [ ] Fix `import/order` for missing empty line (line 7).
    - [ ] Investigate and address `import/no-cycle` warning (line 8).
    - [ ] Fix `import/order` for missing empty line (line 8).
    - [ ] Fix `import/order` for `.` and `./IconButton.module.scss` (line 8).

## Objective: Resolve ESLint Errors in ElementType.tsx

- [ ] **File:** `src/once-ui/components/ElementType.tsx`
    - [ ] Fix `import/no-named-as-default-member` for `React.HTMLAttributes` (line 4).
    - [ ] Fix `@typescript-eslint/no-explicit-any` (line 25).

## Objective: Resolve ESLint Errors in Card.tsx

- [ ] **File:** `src/once-ui/components/Card.tsx`
    - [ ] Fix `import/order` for missing empty line (line 3).
    - [ ] Investigate and address `import/no-cycle` warning (line 4).
    - [ ] Fix `import/order` for missing empty line (line 4).
    - [ ] Fix `import/order` for `./Card.module.scss` and `.` (line 5).
    - [ ] Fix `import/order` for missing empty line (line 6).
    - [ ] Fix `import/order` for `./ElementType` and `.` (line 6).
    - [ ] Fix `import/order` for `classnames` and `react` (line 7).
    - [ ] Fix `import/no-named-as-default-member` for `React.ComponentProps` (line 9).

## Objective: Resolve ESLint Errors in AvatarGroup.tsx

- [ ] **File:** `src/once-ui/components/AvatarGroup.tsx`
    - [ ] Investigate and address `import/no-cycle` warning (line 5).
    - [ ] Fix `import/order` for missing empty line (line 5).
    - [ ] Fix `import/order` for missing empty line (line 6).
    - [ ] Fix `import/order` for `./AvatarGroup.module.scss` and `.` (line 6).
    - [ ] Fix `import/order` for `classnames` and `react` (line 7).
    - [ ] Fix `import/no-named-as-default-member` for `React.ComponentProps` (line 9).

## Objective: Resolve ESLint Errors in Avatar.tsx

- [ ] **File:** `src/once-ui/components/Avatar.tsx`
    - [ ] Investigate and address `import/no-cycle` warning (line 5).
    - [ ] Fix `import/order` for missing empty line (line 5).
    - [ ] Fix `import/order` for `./Avatar.module.scss` and `.` (line 6).
    - [ ] Fix `import/no-named-as-default-member` for `React.ComponentProps` (line 8).

## Objective: Resolve ESLint Errors in useGsap.ts

- [ ] **File:** `src/lib/useGsap.ts`
    - [ ] Fix `import/order` for `gsap` and `react` (line 3).

## Objective: Resolve ESLint Errors in supabase/server.ts

- [ ] **File:** `src/lib/supabase/server.ts`
    - [ ] Fix `import/order` for missing empty line (line 2).
    - [ ] Fix `import/order` for missing empty line (line 3).
    - [ ] Fix `import/order` for `next/headers` and `@/types/supabase` (line 4).

## Objective: Resolve ESLint Errors in auth.ts

- [ ] **File:** `src/lib/auth.ts`
    - [ ] Fix `import/first` for import in body of module (line 8).
    - [ ] Fix `@typescript-eslint/no-non-null-assertion` (line 11).

## Objective: Resolve ESLint Errors in SettingsView.tsx

- [ ] **File:** `src/components/views/SettingsView.tsx`
    - [ ] Fix `import/order` for `lucide-react` and `react` (line 4).

## Next Steps
- Verify build completes successfully after Tiptap Link import fix.
- Awaiting next USER objective.
