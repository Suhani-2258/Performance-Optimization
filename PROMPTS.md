# PROMPTS.md — ENG-84718 Performance Optimization Dashboard

**Ticket:** ENG-84718 (part of the Core Infrastructure Overhaul epic)
**Purpose:** A responsive, accessible Performance Optimization dashboard for News Blog floor staff and managers: summary metrics, a searchable/filterable/sortable records table, and a validated form to add records. There is no backend; data lives in a clearly labelled local demo adapter (browser `localStorage`).

## Prompt provenance

Only the prompts listed below were available to the assistant with their exact wording. No other prompts are recorded here, and none have been reconstructed or paraphrased from memory. Anything not listed is **unavailable**.

| # | Prompt | Status |
|---|--------|--------|
| 1 | Initial implementation prompt | Exact text below. **It was received truncated**: the text ends mid-sentence at "Avoid arbitrary hex colors". Any text after that point is unavailable. |
| 2 | Audit and remediation prompt | Exact text below (complete as received). |
| 3 | UI enhancement prompt (navigation, interactive cards, theme toggle) | Exact text below (complete as received). |
| 3a | Follow-up message "Continue" | Exact text: `Continue`. It carried no requirements. |
| 4 | Advanced feature implementation (edit/delete, analytics, targets, activity, filters, pagination, export, themes) | Exact text below (complete as received). |
| 4a | Follow-up messages "Continue" (sent twice during this implementation) | Exact text: `Continue`. They carried no requirements. |
| — | Any other earlier or intermediate prompts | Unavailable. Not recorded. |

## Prompt 1 — Initial implementation (verbatim, as received, truncated)

~~~~text
# ENG-84718 — Performance Optimization Dashboard
## Role: Senior React Engineer + QA Engineer

You are working on ticket **ENG-84718**, part of the Core Infrastructure Overhaul epic. Your task is to build a complete, responsive, production-quality **Performance Optimization** web interface for News Blog's floor staff and managers.

Do not just provide explanations or snippets. Inspect the existing repository, implement the feature in the actual project files, run the tests, fix failures, and leave the application in a working state.

## 1. First: Inspect the Repository

Before changing anything:

1. Inspect the folder structure, package.json, existing React components, routing, styling system, and available tests.
2. Identify whether the project uses Vite, Next.js, or another React setup.
3. Reuse the existing architecture, dependencies, design tokens, and conventions wherever possible.
4. Do not overwrite unrelated files or replace the entire application unnecessarily.
5. If the repository is empty, initialize a minimal React application using Vite.
6. Report a short implementation plan before making changes.

## 2. Mandatory TDD Workflow

Follow test-driven development strictly.

### Phase A — Write tests first

Use the testing framework already installed. If none exists, use Vitest, React Testing Library, and jest-dom for a Vite application.

Write tests before implementing the new feature. Cover:

- Initial dashboard rendering.
- Accessible headings, form controls, buttons, and navigation.
- Empty states displaying "No data found".
- Loading indicators during asynchronous operations.
- Validation of required and malformed form inputs.
- Invalid fields being visibly highlighted and having accessible error messages.
- Successful form submission.
- Search and filtering behavior.
- Sorting and filtering of performance records, if implemented.
- Handling failed network requests and offline conditions.
- Safe rendering of malicious-looking text input.
- Keyboard navigation and accessible labels.
- Analytics logging after a successful primary action.
- Responsive layout behavior where practical.
- No crashes when data is missing, null, or an empty array.

Run the tests before implementation and confirm that the new feature tests fail for the expected reasons. Do not make the tests pass by weakening or deleting assertions.

### Phase B — Implement the feature

After the tests are written and their initial failures are confirmed, implement the minimum code required to pass them.

### Phase C — Verify

Run the complete test suite, production build, and available lint checks. Fix the actual causes of failures. Report the commands executed and their results honestly.

Do not claim a test, Lighthouse score, build, or deployment succeeded unless it was actually verified.

## 3. Functional Requirements

Build a usable Performance Optimization dashboard for News Blog's staff and managers.

Include the following features:

1. A clear dashboard header with the title "Performance Optimization".
2. Summary cards showing meaningful metrics such as total records, average performance, completed tasks, and pending tasks.
3. A searchable and filterable performance records table.
4. A form to add a performance record.
5. Validation for required fields and invalid numerical values.
6. Useful empty states when no records or search results exist.
7. Loading, success, error, and offline indicators.
8. A retry action when an asynchronous request fails.
9. A responsive layout that works on desktop, tablet, and mobile.
10. A clear visual hierarchy so floor staff can operate the interface quickly.

Use sensible, clearly labeled fields such as task or process name, department, current performance, target performance, status, and notes. Keep the data model consistent throughout the UI.

Use realistic demo data if no backend exists. Do not invent a backend API or claim that data is saved remotely when it is only stored locally.

## 4. Connectivity and Data Persistence

The application must remain usable under poor network conditions.

- Show a visible loading indicator during asynchronous operations.
- Handle slow responses, request failures, and offline conditions without crashing.
- Provide meaningful retry and error messages.
- Preserve user-entered form data if a request fails.
- If there is no backend, use a clearly identified local demo-data adapter and localStorage for appropriate persistence.
- Handle localStorage being unavailable or throwing an exception.
- Do not imply that browser-local data is shared across employees or devices.
- If a backend already exists, integrate with its actual API contracts rather than replacing them.

Avoid indefinite loading states. Where applicable, implement request cancellation or stale-request protection.

## 5. Security Requirements

- Treat all user-entered text as untrusted.
- Use React's standard text rendering rather than dangerouslySetInnerHTML.
- Never execute user-provided HTML or JavaScript.
- Validate and normalize input before saving it.
- If rich HTML is genuinely required, use an established sanitizer; otherwise, render plain text.
- Do not store secrets, API keys, credentials, or sensitive personal information in source code.
- Do not treat basic input validation as a substitute for server-side validation.

## 6. React Performance Requirements

Use React hooks appropriately:

- useMemo for genuinely expensive derived data, filtering, sorting, and aggregate calculations.
- useCallback for callbacks that need stable identity, especially when passed to memoized child components.
- Avoid unnecessary state duplication and excessive effects.
- Keep components small and maintainable.
- Use stable keys for list items.
- Avoid premature optimization and do not add memoization indiscriminately.
- Ensure calculations handle empty arrays, missing values, and invalid numbers safely.

## 7. Accessibility Requirements

Target WCAG 2.2 AA practices and a Lighthouse accessibility score of 100.

Implement:

- Semantic HTML landmarks and heading hierarchy.
- Explicit labels for every form control.
- Accessible names for icon-only buttons.
- Keyboard-accessible navigation and controls.
- Visible focus indicators.
- Appropriate ARIA attributes where needed.
- Accessible validation errors connected to their inputs using aria-describedby.
- aria-invalid for invalid fields.
- A suitable live region for asynchronous status messages.
- Sufficient contrast using the existing monochromatic design tokens.
- Non-color-only indicators for errors and statuses.
- Responsive behavior at different viewport sizes.

Do not add redundant ARIA attributes where semantic HTML already provides the required accessibility.

Run Lighthouse if the environment supports it. If a 100 score cannot be verified, state the actual result and remaining issues.

## 8. Simulated Analytics

Log the following message whenever a primary action successfully completes:

console.info("[Analytics] User interacted with Performance Optimization");

A primary action may include successfully adding a record or applying a meaningful dashboard action.

Do not emit success analytics for invalid submissions or failed requests. Avoid duplicate events caused by re-renders.

## 9. Design Requirements

Create a clean, premium, monochromatic corporate dashboard.

- Use the existing design system and theme tokens.
- If no design system exists, establish consistent neutral tokens using CSS variables.
- Use consistent spacing based on 16px and 32px increments where practical.
- Use clear typography, restrained borders, subtle shadows, and consistent radii.
- Keep tables readable and provide a mobile-friendly alternative layout or horizontal scrolling.
- Include proper hover, active, disabled, focus, loading, and error states.
- Avoid arbitrary hex colors
~~~~

## Prompt 2 — Audit and remediation (verbatim, this session)

~~~~text
# ENG-84718 — Performance Optimization Dashboard: Audit and Remediation

Act as a senior React engineer and QA engineer. The existing project has already been implemented. Your task is to audit and improve the current codebase, not rebuild the application from scratch.

## 1. Inspect Before Modifying

Inspect the existing source code, package.json, package-lock.json, tests, and project configuration.

Important existing files include:
- src/App.jsx
- src/components/RecordForm.jsx
- src/components/RecordsTable.jsx
- src/components/SummaryCards.jsx
- src/lib/records.js
- src/lib/request.js
- src/lib/demoAdapter.js
- src/App.test.jsx
- src/lib/records.test.js
- src/lib/demoAdapter.test.js
- src/styles.css

Preserve the current architecture, UI, monochromatic design system, dependencies, and working functionality. Do not replace the application or remove existing tests.

## 2. Fix Incorrect Summary Calculations

Inspect computeSummary() in src/lib/records.js.

Currently, pending is calculated as total records minus completed records. This incorrectly counts In Progress records as pending.

Correct the calculation so that:
- Total records counts all valid records.
- Average performance calculates the average of valid current-performance values.
- Completed tasks counts only records whose status is Completed.
- Pending tasks counts only records whose status is Pending.
- In Progress records are not included in either Completed or Pending counts.

Update src/lib/records.test.js accordingly.

Add tests for:
- A dataset containing all three statuses.
- Empty arrays, null and undefined.
- Invalid performance values.
- Records with missing or malformed fields.

Do not preserve incorrect expected values merely to keep existing tests passing.

## 3. Separate Network Errors From Empty States

Inspect the interaction between load state in src/App.jsx and rendering in src/components/RecordsTable.jsx.

Currently, a failed initial request may result in an error alert and a misleading "No data found" message simultaneously.

Fix the state handling:
- Loading: show a visible loading indicator.
- Successful request with zero records: show "No data found".
- Successful request with no search matches: show "No data found" and useful guidance.
- Failed request: show a clear error message and Retry action, not a false empty-data message.
- Successful retry: restore the records and remove the load error.
- Missing or malformed API data: handle it safely without crashing.

Pass the minimum necessary state into RecordsTable or adjust the rendering logic without unnecessarily restructuring the application.

Add regression tests in src/App.test.jsx for these scenarios.

## 4. Audit Form Validation and Retry Behavior

Verify that:
- Required fields cannot be submitted empty.
- Current and target performance accept only valid numbers from 0 through 100.
- Invalid fields use aria-invalid and accessible error descriptions.
- The first invalid field receives focus.
- Error messages clear appropriately when users correct fields.
- Failed submissions preserve entered data.
- Retry does not reset the form before success.
- Duplicate submissions are prevented while saving.
- Analytics is logged exactly once after a successful save and never after validation or request failure.

Check whether the Retry button behaves correctly when the form is invalid or the network is unavailable. Fix any issues without weakening validation.

## 5. Security and Data Integrity

Review all user input and record handling.

- Continue using safe React text rendering.
- Do not introduce dangerouslySetInnerHTML.
- Validate record fields and enforce valid department and status values.
- Normalize numerical values consistently.
- Handle null, undefined, malformed records, corrupted localStorage data, and unavailable browser storage safely.
- Preserve the existing demo adapter and explicitly communicate that its localStorage data is not shared between employees.
- Do not add a fake backend or hardcode credentials.

Add regression tests for any newly discovered issues.

## 6. Accessibility and Responsive UI

Audit the existing interface against the ticket's accessibility requirements.

Verify:
- Semantic landmarks and heading hierarchy.
- Labels for every form control.
- Keyboard navigation and visible focus indicators.
- Accessible sort buttons and correct aria-sort values.
- aria-invalid and aria-describedby on invalid fields.
- Screen-reader announcements for loading, errors, and successful actions.
- Error and status information that does not rely on color alone.
- Responsive layouts on desktop, tablet, and mobile.
- Reduced-motion preferences for animated indicators.

Use the existing monochromatic CSS variables. Do not introduce scattered arbitrary colors or redesign working components without a reason.

Run a Lighthouse accessibility audit if the browser tooling is available. Report the actual score and unresolved issues; do not claim 100% without verification.

## 7. Complete PROMPTS.md

The uploaded project currently has no root-level PROMPTS.md.

Create PROMPTS.md at the repository root. Include:
- Ticket ID ENG-84718 and project purpose.
- The actual initial implementation prompt, if available.
- The actual remediation prompt used in this session.
- Other prompts only when their exact wording is available.
- The fixes completed during this audit.
- Commands to install dependencies, run the application, run tests, lint, and build.
- Known limitations, including the absence of a shared backend if that remains the implementation.

Never fabricate a prompt history. Clearly label unavailable historical prompts instead of inventing them.

## 8. Test-Driven Remediation

Before changing behavior, inspect and update regression tests for the identified bugs. Add new assertions first, run the relevant tests to confirm that they expose the defects, and then implement the fixes.

After implementation:
1. Run the complete test suite.
2. Run ESLint.
3. Run the production build.
4. Fix actual failures rather than suppressing them.
5. Review all changes to ensure unrelated features remain intact.

If dependencies are missing, use the existing lockfile and the project's package manager. Do not delete the lockfile or upgrade dependencies unnecessarily.

## 9. Final Definition of Done

Verify all of the following:

- [ ] Pending counts exclude In Progress records.
- [ ] Empty states appear only when appropriate.
- [ ] Loading and failed-request states are distinct.
- [ ] Retry and form validation work correctly.
- [ ] Analytics only logs after successful primary actions.
- [ ] XSS-safe rendering is preserved.
- [ ] Keyboard accessibility and responsive behavior are checked.
- [ ] Existing and newly added tests pass.
- [ ] ESLint passes without warnings.
- [ ] Production build succeeds.
- [ ] Root-level PROMPTS.md exists.
- [ ] No secrets are introduced.
- [ ] No unrelated features are broken.

At completion, provide a concise audit report listing the files changed, bugs fixed, exact commands executed and their actual results, Lighthouse results if available, and any remaining limitations.

Do not claim successful tests, builds, Lighthouse audits, GitHub pushes, or deployments unless they have actually been verified.

Begin with repository inspection, then implement and verify the necessary fixes directly in the existing project.
~~~~

## Prompt 3 — Dashboard UI enhancement (verbatim, this session)

~~~~text
# ENG-84718 — Dashboard UI Enhancement: Navigation, Interactive Cards & Theme Toggle

Act as a senior React developer and UI/UX engineer. Enhance the existing Performance Optimization dashboard in the current repository.

IMPORTANT: The application already runs at localhost:5173. Do not rebuild it from scratch. Inspect the current source code and modify the existing implementation.

## 1. Make Dashboard Navigation Functional

The top navigation currently contains:
- Summary
- Records
- Add record

Make every navigation item fully clickable and functional.

Requirements:
- Summary opens the dashboard overview.
- Records opens the complete performance records view.
- Add record opens the record creation form.
- Use the existing routing approach. If there is no router, implement lightweight hash-based navigation compatible with the current project.
- Highlight the active navigation item.
- Support direct URLs and browser refresh on routes such as #summary, #records, and #add-record.
- Support browser Back and Forward navigation.
- Ensure every navigation link is keyboard accessible.
- Avoid duplicate sections and broken navigation states.
- After successfully adding a record, show a success message and update the relevant records and summary.

## 2. Make Summary Cards Interactive

The dashboard currently displays:
- Total records
- Average performance
- Completed tasks
- Pending tasks

Make each summary card clickable and keyboard accessible.

Expected behavior:
- Total records: navigate to Records and display all records.
- Average performance: navigate to Records and display the performance data used for the average.
- Completed tasks: navigate to Records with the Completed status filter selected.
- Pending tasks: navigate to Records with the Pending status filter selected.

Additional requirements:
- Show a pointer cursor and subtle hover/focus states.
- Use semantic buttons or links, not clickable div elements.
- Give every card an accessible name.
- Ensure filters and summary counts remain synchronized with the underlying data.
- Provide a clear way to reset filters and return to all records.
- Do not change the calculation logic incorrectly.

## 3. Add Dark Mode and Light Mode

Add a theme toggle to the top navigation area.

Requirements:
- Light mode should retain the existing white and neutral corporate design.
- Dark mode should use comfortable dark backgrounds, readable text, appropriate borders, accessible form controls, and clearly visible status indicators.
- All components must follow the selected theme: navigation, summary cards, records table, form, inputs, dropdowns, validation messages, loading indicators, alerts, and buttons.
- Use centralized CSS variables or theme tokens. Avoid scattering hardcoded colors across components.
- Add an accessible toggle button with an appropriate label such as "Switch to dark mode" or "Switch to light mode".
- Include a visible moon/sun icon if an existing icon library is available. Otherwise use simple inline SVG or text symbols.
- Persist the selected theme in localStorage.
- Restore the saved theme after refreshing the page.
- Handle localStorage failures gracefully.
- Respect the system color preference on the first visit when no saved preference exists.
- Prevent a flash of the wrong theme where practical.
- Maintain WCAG AA color contrast as a target in both themes.

## 4. Responsive Design

Ensure the enhanced dashboard works on:
- Desktop
- Tablet
- Mobile

On smaller screens:
- Navigation must remain accessible.
- Summary cards should rearrange into suitable columns.
- Forms should use the available width.
- Tables must remain readable through responsive layouts or horizontal scrolling.
- The theme toggle must remain easy to reach.

Do not break the current desktop layout unnecessarily.

## 5. Preserve Existing Functionality

Do not remove or break:
- Record creation and validation
- Search
- Status filters
- Table sorting
- Summary calculations
- Loading and error states
- Retry behavior
- Offline handling
- XSS-safe text rendering
- Analytics simulation

Ensure successful record creation updates the visible counts and records without requiring a manual page refresh.

## 6. Testing Requirements

Update the existing tests and add tests for:
- Clicking each navigation item.
- Direct navigation to each supported hash route.
- Browser Back and Forward behavior.
- Clicking each summary card.
- Completed and Pending card filters.
- Resetting filters.
- Switching between dark and light themes.
- Persisting the theme after reload.
- Keyboard access to navigation and summary cards.
- Record creation and summary updates.
- Empty states and existing error handling.

Use the test framework already configured in the project. Do not remove assertions or weaken existing tests to make them pass.

## 7. Documentation and Verification

Update PROMPTS.md with this exact enhancement prompt and any additional prompts actually used.

After implementation:
1. Run the complete test suite.
2. Run ESLint.
3. Run the production build.
4. Fix genuine errors.
5. Report the exact results of each command.

Do not claim browser testing or accessibility scores unless actually verified.

## Definition of Done

- All navigation links work.
- All four summary cards navigate to the correct records and filters.
- Dark and light themes work across the entire application.
- Theme preference persists across refreshes.
- Mobile and desktop layouts remain usable.
- Existing features still work.
- Tests pass.
- Lint and production build pass.
- PROMPTS.md is updated.

Implement these enhancements directly in the existing repository. Do not stop after proposing a plan; complete the implementation and verification.
~~~~

## Prompt 4 — Advanced feature implementation (verbatim, this session)

~~~~text
# ENG-84718 — Performance Optimization Dashboard: Advanced Feature Implementation

Act as a Senior React Engineer, UI/UX Designer, and QA Engineer.

You are working on an existing React application named **Performance Optimization**, built for News Blog staff and managers.

Your task is to upgrade the existing application with useful enterprise-level features while preserving the current design, architecture, and working functionality.

IMPORTANT: Do not rebuild the project from scratch. Inspect the repository and modify the existing code directly.

## PHASE 1 — Repository Inspection

Before making changes:

1. Inspect package.json, existing components, routing, CSS, data utilities, test files, and PROMPTS.md.
2. Identify the current record schema and persistence mechanism.
3. Check whether CSV/JSON export and dark/light mode have already been implemented.
4. Identify existing tests and missing functionality.
5. Reuse existing components, dependencies, CSS variables, and conventions.
6. Do not duplicate features that already work.

Create a short implementation plan and proceed with the following features in order.

## PHASE 2 — Edit and Delete Records

Implement complete record management.

### Edit
- Add an Edit action to every performance record.
- Open an accessible form prefilled with the selected record's existing values.
- Reuse the existing validation rules.
- Allow updates to task name, department, current performance, target performance, status, and notes.
- Save changes to the existing persistence layer.
- Update the table and summary cards immediately after a successful save.

### Delete
- Add a Delete action for each record.
- Show an accessible confirmation dialog before deletion.
- Provide Cancel and Confirm actions.
- Update the records list and summary metrics after successful deletion.
- Handle failed operations without losing user-entered data.

Prevent accidental duplicate submissions and preserve existing record identifiers.

## PHASE 3 — Performance Analytics Dashboard

Add an Analytics section accessible through the existing navigation.

Include:
- Total performance records.
- Average current performance.
- Completed, Pending, and In Progress task counts.
- Percentage of records meeting or exceeding their targets.
- Current-versus-target performance comparison.
- Department-wise average performance.
- Task status distribution.

Use the chart library already installed. If no suitable chart library exists, use lightweight accessible CSS-based visualizations or propose a minimal dependency.

All chart values must be calculated from actual records. Do not hardcode chart data or fabricate historical trends.

Handle empty datasets, missing values, invalid numbers, and zero denominators safely.

## PHASE 4 — Target Achievement Indicators

For each record, calculate the difference between current performance and target performance.

Display:
- Current performance.
- Target performance.
- Difference in percentage points.
- A clear indicator showing whether the target has been achieved.
- A warning when performance is below the target.

Use consistent status indicators in both light and dark themes. Never rely on color alone to convey meaning.

Do not confuse percentage-point differences with relative percentage changes.

## PHASE 5 — Activity History

Add a Recent Activity section that records:
- Record created.
- Record updated.
- Record deleted.
- Action timestamp.
- Relevant record name or identifier.

Use the existing local persistence approach where appropriate.

Clearly identify this as browser-local demo activity history. Do not claim that it is a secure, centralized, multi-user audit log.

Do not record passwords, credentials, or unnecessary sensitive information.

## PHASE 6 — Advanced Filters and Pagination

Extend the existing records table with:
- Department filter.
- Status filter.
- Current-performance range filter.
- Target-performance range filter.
- Configurable page size, such as 5, 10, or 20 records.
- Previous and Next pagination controls.
- Current page and total page indicators.
- A clear Reset Filters action.

Ensure search, filters, and sorting work together correctly.

Reset pagination when filter changes make the current page invalid. Handle zero results without crashing. Export functionality, if already present, must export the filtered and sorted dataset rather than just the current visible page.

## PHASE 7 — CSV and JSON Export

Inspect the existing export implementation first. Reuse and fix it rather than adding duplicate export buttons.

If export is missing, implement:
- Export as CSV.
- Export as JSON.
- Meaningful filenames with the current date.
- Correct escaping of commas, quotes, and newlines.
- Protection against spreadsheet formula injection in text fields.
- Correct handling of empty results.
- Export of all records matching current filters and sorting.

Preserve numeric performance values correctly.

## PHASE 8 — Dark and Light Themes

Inspect the existing theme toggle before changing anything.

Ensure:
- All components support both themes.
- The selected theme persists across refreshes.
- System preference is respected on the first visit when no preference has been saved.
- Unavailable localStorage does not crash the app.
- Forms, dialogs, charts, alerts, tables, dropdowns, and status badges are readable in both themes.
- Theme controls have accessible names and visible focus indicators.

Do not create a second theme implementation if a working one already exists.

## PHASE 9 — Security and Reliability

Preserve and strengthen the existing requirements:

- Safely render user-provided text.
- Do not use dangerouslySetInnerHTML for user data.
- Validate and normalize data before saving.
- Handle corrupted localStorage, missing fields, null values, and invalid records.
- Provide clear loading, error, retry, empty, and success states.
- Preserve form data after failed requests.
- Prevent duplicate submissions.
- Ensure summary metrics remain consistent after create, edit, and delete operations.
- Do not introduce API keys or secrets.

If persistence remains localStorage-based, clearly explain that records are not automatically shared between employees or devices.

## PHASE 10 — UI/UX Requirements

Maintain a clean, premium, monochromatic corporate design.

- Preserve the existing navigation and dashboard structure.
- Make the interface responsive on desktop, tablet, and mobile.
- Use consistent spacing, typography, borders, and existing theme tokens.
- Ensure all buttons and interactive elements have hover, focus, active, and disabled states.
- Use semantic HTML and accessible dialogs.
- Support keyboard navigation.
- Use accessible labels and validation messages.
- Keep data tables readable at small viewport widths.
- Avoid unnecessary animations and excessive dependencies.

Do not introduce arbitrary colors that conflict with the existing design system.

## PHASE 11 — Test-Driven Development

Before implementing each new behavior:

1. Inspect the current tests.
2. Add tests for the expected behavior.
3. Run the relevant tests and verify that new tests expose missing functionality where applicable.
4. Implement the feature.
5. Run the tests again and fix genuine failures.

Cover:
- Editing and deleting records.
- Confirmation and cancellation.
- Summary recalculation.
- Target achievement calculations.
- Department and performance analytics.
- Activity history.
- Search, sorting, filters, and pagination.
- CSV and JSON export.
- Empty and malformed datasets.
- Keyboard accessibility.
- Dark/light theme persistence.
- Existing loading, error, retry, and validation behavior.

Never remove or weaken existing tests just to make them pass.

## PHASE 12 — PROMPTS.md

Update the existing root-level PROMPTS.md.

Document:
- The actual prompt used for this implementation.
- Any additional prompts actually used.
- Features added or modified.
- Commands to install dependencies, run the application, run tests, lint, and build.
- Known limitations and remaining work.

Do not fabricate historical prompts or claim commands were run when they were not.

## PHASE 13 — Final Verification

Run the available commands from the existing package.json:

- Complete test suite.
- ESLint.
- Production build.

Fix genuine failures and inspect the final changes.

Run Lighthouse accessibility checks if browser tooling is available. Report the actual score rather than promising a 100% score without verification.

Do not claim GitHub pushes, deployment, or successful browser tests unless they actually occurred.

## Definition of Done

- [ ] Existing dashboard functionality remains intact.
- [ ] Records can be edited and deleted safely.
- [ ] Analytics are derived from actual records.
- [ ] Target achievement calculations are correct.
- [ ] Activity history works within the documented persistence limitations.
- [ ] Advanced filters and pagination work together.
- [ ] CSV/JSON export respects current filters and sorting.
- [ ] Light/dark themes remain consistent.
- [ ] Accessibility and responsive behavior are verified as far as tooling permits.
- [ ] Tests pass.
- [ ] Lint passes.
- [ ] Production build succeeds.
- [ ] PROMPTS.md is updated.

Begin by inspecting the existing repository. Then implement the features incrementally in the specified order. Do not stop after writing a plan, and do not rewrite the whole application.
~~~~

## Fixes completed in the ENG-84718 audit

1. **Pending count** (`computeSummary`): previously `total − completed`, which counted In Progress as pending. Now Pending counts only `status === 'Pending'`; In Progress is in neither bucket.
2. **Average performance**: now averages only valid values (finite numbers or numeric strings in 0–100). Previously blank/whitespace strings (read as 0), booleans, and out-of-range numbers were counted. Array/string/number entries are no longer treated as records.
3. **False empty state**: a failed load showed the error alert and "No data found" together, and summary cards displayed misleading zeros. The table now takes a `status` (`loading` | `error` | `ready`); errors show only the alert and Retry, and the cards show "–" until data has loaded.
4. **Empty-state guidance**: zero records → "Add a record to get started."; no search/filter matches → "Try a different search term or clear the filters."
5. **Duplicate submissions**: a synchronous `useRef` guard now blocks a second submit fired in the same tick (the `saving` state was stale within a tick).
6. **Stale save-error alert**: a leftover "Could not save" alert is cleared when a fresh submit/Retry fails validation.
7. **Department allow-list**: `validateRecord` now enforces the department list, and tolerates `null`/`undefined` input.
8. **Stored-data integrity**: new `sanitizeRecord(s)`; the demo adapter drops malformed stored records, falls back to seed data for non-array JSON, validates and normalizes on `add`, and rejects invalid records.
9. **Responsive layout bug** (found in headless Chromium): on mobile and tablet the page overflowed horizontally because single-column grids lacked `minmax(0, 1fr)`; the table now scrolls inside its own region.
10. **Design tokens**: removed a literal `rgb()` shadow colour; raw hex values now appear only on `--gray-*` token lines (guarded by a test).
11. **Tests**: 43 → 95 tests. One pre-existing expectation (Pending = 2 for a dataset containing an In Progress record) was incorrect and was corrected to 1, not preserved.

## UI enhancement changes (Prompt 3)

1. **Hash routing** (`src/lib/hashRoute.js`): `#summary`, `#records`, `#add-record`; unknown or empty hashes fall back to Summary. Each route renders exactly one view (no duplicated sections). The active item uses `aria-current="page"`, focus moves to the new view's heading, Back/Forward and direct URLs/refresh work, and clicking the active link adds no duplicate history entry. The skip link no longer touches the hash.
2. **Filters live in the URL**: `#records?status=Completed|Pending` and `#records?focus=average`, so Back/Forward restore them. Invalid values are ignored. A **Reset filters** button clears status, search and the average focus. The Records nav item always opens the complete list.
3. **Interactive summary cards** (`SummaryCards.jsx`): real `<button>`s inside a list; names come from visible text; pointer cursor, hover/focus/disabled states. Disabled and showing "Unavailable" while loading or after a failed load. Total opens all records; Average opens the records that have a valid current value (the exact set the average is computed from, via the shared `averageSource`), highest first; Completed and Pending open the matching filter. A "Showing N of M records" line keeps counts and rows visibly in sync. `computeSummary` results are unchanged.
4. **Add record**: the form draft is now owned by `App`, so typed or failed-save data survives navigating away and back; it is cleared after a successful save. The success message is shown in the live region and disappears when leaving the view; summary and records update immediately.
5. **Dark/light theme** (`ThemeToggle.jsx`, `src/lib/theme.js`, `styles.css`): palette tokens plus semantic tokens, with every component using semantic tokens only. The toggle sits in the header with an inline sun/moon SVG and a "Switch to dark/light mode" label. The saved choice is stored in `localStorage` (failures tolerated), the system preference is used on first visit without saving it, and an inline script in `index.html` sets the theme before first paint. `color-scheme` is set so native controls follow the theme.
6. **Responsive**: cards use 2/4 columns on phone/tablet; the header wraps; below 600px the toggle shows only its icon (the accessible name is unchanged); the table scrolls inside its own region.
7. **Tests**: 95 -> 189. Existing App tests were moved onto the view they exercise (e.g. they open `#records` or `#add-record` first) because the single page is now split into views. Their assertions were kept. Two assertions changed because the design changed: the page now has one `h2` per view rather than three, and the success/summary checks navigate between views. The CSS guard dropped the removed `.layout` selector and now allows `--dark-*` palette tokens.

## Advanced features (Prompt 4)

Inspection found: no CSV/JSON export, no chart library, no edit/delete/activity; the theme toggle already existed and was reused (only an `--overlay` token was added for the dialog backdrop). Persistence is the `localStorage` demo adapter with the schema `id, name, department, current, target, status, notes`.

1. **Edit** (`EditRecord.jsx`, reusing `RecordForm`): an Edit link on every row opens `#edit-record?id=…` prefilled; same validation as Add; saves through the adapter's new `update`, which validates, preserves the record id and rejects unknown ids. The table, summary cards and analytics update immediately. A missing id shows "Record not found" (never while loading).
2. **Delete** (`ConfirmDialog.jsx`): modal `alertdialog` with Cancel and Confirm. Focus starts on Cancel, Tab is trapped, Escape cancels, the page behind is `inert`, and focus returns to the trigger (cancel) or the records heading (deleted). Failures keep the dialog open with an error and allow a retry. Adapter `remove` rejects unknown ids.
3. **Duplicate-submit and offline guards** for add, edit and delete use synchronous refs (state is stale within a tick). Failed saves keep the form data.
4. **Analytics** (`#analytics`, `src/lib/analytics.js`, `AnalyticsView.jsx`): totals, average current, Completed/Pending/In Progress counts, % of records meeting or exceeding target, current-vs-target averages, department averages, status distribution. All computed from the records; zero denominators give "–", never NaN. No chart library was added: bars are decorative `aria-hidden` CSS and every value is also text; the target bar is hatched so it differs by pattern, not only shade.
5. **Target indicators**: a Difference column (current minus target, in percentage points) with "✔ Target met" (solid outline) or "⚠ Below target" (dashed outline), "Not available" for unusable values; sortable. A note states the difference is not a relative change.
6. **Activity** (`#activity`, `src/lib/activityLog.js`): created/updated/deleted, newest first, with record name/id and an ISO timestamp, in `localStorage` (memory fallback), capped at 50, tolerant of corrupted data, storing only `id, type, recordId, recordName, at`. Labelled as browser-local demo history, not a secure, centralized or multi-user audit log.
7. **Filters and pagination**: department filter, status filter (existing), current and target min/max range filters (invalid or inverted bounds are flagged accessibly and ignored), rows per page 5/10/20, Previous/Next with "Page X of Y" and a row range, and Reset filters. Search, filters and sort combine; any filter change returns to page 1 and an out-of-range page is clamped (for example after a delete).
8. **Export** (`src/lib/exportData.js`): Export CSV and Export JSON export every record matching the filters and current sort (not just the visible page), with a dated filename, RFC 4180 escaping, spreadsheet-formula neutralization (leading `'` for `=`, `+`, `-`, `@`, tab, CR) in CSV text fields, numbers kept numeric, a UTF-8 BOM on CSV so Excel reads accents, and header-only CSV / `[]` for empty results.
9. **Analytics simulation** now also logs `[Analytics] User interacted with Performance Optimization` after a successful update and delete, in addition to add; it is not logged for validation failures, failed requests, cancelled dialogs or exports.
10. **Tests**: 189 -> 352, written before the implementation (119 failed first, plus suites that could not import the missing modules). A CSS guard test was added after a browser screenshot showed bar tracks of unequal length (fixed with fixed label/value columns).

## Commands

```bash
npm install          # install dependencies from package-lock.json
npm run dev          # start the dev server
npm test             # run the full test suite once (Vitest)
npm run lint         # ESLint (use: npx eslint src --max-warnings 0 for zero-warning check)
npm run build        # production build into dist/
npm run preview      # serve the production build locally
```

## Known limitations

- **No shared backend.** Records are stored only in this browser's `localStorage` (or in memory if storage is unavailable). Data is **not** shared between employees or devices, and is not saved remotely. The UI says so.
- Validation is client-side only and is not a substitute for server-side validation if a backend is added later.
- Responsive layout, theming, routing and accessibility were verified in headless Chromium (375/390, 768 and 1280 px; both themes), not on physical devices, in other browsers, or with a screen reader. Lighthouse's automated checks do not replace manual assistive-technology testing. The browser/Lighthouse scripts were run outside the repository and are not part of it.
- The router is a small custom hash router, not a library. Only status/average focus and the edited record id are in the URL. Search text, department, ranges, rows per page, page and sort are in-memory, so they are not restored by a refresh, and they persist across direct URL changes (nav clicks and Reset filters clear them). Rows per page is not cleared by Reset filters.
- Activity history is capped at 50 entries and is local to one browser; clearing site data erases it. It is recorded by the front end, so it can be edited by anyone using that browser.
- The edit draft is not kept if you navigate away from the edit form (the add form's draft is kept).
- Export runs in the browser from the data in this browser. JSON is exported as-is (formula neutralization applies to CSV only).
- Remaining work: a real shared backend with server-side validation and a tamper-evident audit log, live-updating system theme, and storing more filters in the URL.
- On narrow phones the theme toggle wraps onto its own row below the navigation.
- The theme follows the system setting only on first visit; it does not live-update if the system setting changes later while no choice is saved.
- `npm audit` reports a moderate advisory in a Vitest 2.x dev dependency (dev-only, not in the production bundle). Fixing it requires a breaking Vitest upgrade, which was deliberately not made.
