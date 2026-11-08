AGENTS.md — NEW LABORATORY INFORMATION SYSTEM (LIS) MVP
1. Mission and priority
You are the lead full-stack engineer for a new Laboratory Information System (LIS). Build a small, coherent, professional MVP quickly, then improve it in small verified steps.

The product is an LIS, not a Learning Management System (LMS). It helps authorised laboratory staff register clients/patients, create laboratory orders, record tests, track the status of every test/section, complete and review results, and generate a printable PDF report bearing the laboratory's logo and report details.

Primary priority: a working end-to-end MVP. Avoid overengineering, broad abstractions, unrelated features, and elaborate functionality that does not help the main workflow.

The user uploaded a document titled “FULL BLOOD COUNT UNIT REFERENCE RANGES”. Use it as the initial source for the test catalogue and report layout. Preserve its terminology where practical. Do not silently invent missing test fields, units, reference intervals, or clinical rules.
2. MVP acceptance criteria
The first usable version must let an authorised user:
1. Sign in securely.
2. View a dashboard with useful counts and recent work based on actual stored records.
3. Create, find, view, and edit a client/patient record.
4. Create a laboratory order for a client and select one or more tests/panels from the test catalogue.
5. See an individual status for every ordered test and, where appropriate, the overall order/report status.
6. Enter results, units, reference information, notes, and required workflow information for each test, following configured fields.
7. Save work in progress without falsely marking it completed.
8. Review/complete the order through explicit status transitions.
9. Generate, preview, download, and print a well-formatted PDF report including the laboratory logo (once supplied), laboratory/report details, client details, ordered tests, results, units, reference intervals when configured, dates, and review/authorisation details supported by the app.
10. Find previous clients and orders without unnecessarily duplicating records.
Do not treat the MVP as finished until the essential path works end-to-end with persistent database storage. If the MongoDB URI has not yet been supplied, prepare the integration and environment documentation, but clearly label database-dependent behaviour as not yet connected. Do not pretend data is saved persistently when it is not.
3. Technology and project setup
- Use Next.js with the App Router, TypeScript, and a maintainable React UI.
- Use MongoDB for persistence. The user will provide the connection URI later.
- Store the connection string in MONGODB_URI; never hardcode it or commit it.
- Reuse the existing project structure if one exists. If the repository is new/empty, create a conventional Next.js application with App Router and TypeScript.
- Choose one MongoDB integration and use it consistently. The official MongoDB Node.js driver or Mongoose are acceptable. Do not add both without a clear reason. If Prisma has already been chosen, inspect its MongoDB compatibility before retaining it.
- Reuse existing styling/components if present. In a new app, choose a lightweight, consistent UI approach such as Tailwind CSS with accessible reusable components. Do not install overlapping UI libraries.
- Use a stable authentication solution compatible with the selected Next.js version and MongoDB approach. Hash passwords with an appropriate password-hashing algorithm; never store plaintext passwords.
- PDF generation must work in the actual app runtime. Choose a suitable maintained library or a properly tested print stylesheet/window workflow. Never create a fake PDF button.
- Check current documentation when library APIs are version-sensitive.
MongoDB URI is not available yet
- Create .env.example with safe placeholders for MONGODB_URI and required auth secrets. Never put real secrets in it.
- Ensure secret-bearing .env* files are ignored by Git, except a safe .env.example.
- Document where the user should put the real URI when supplied.
- Do not invent a cluster, credentials, URI, or database name.
- Do not crash the public sign-in screen solely because the URI is not set. For authenticated/data pages, show a clear developer configuration error instead of silently using fake persistent storage.
- Do not build a temporary storage system that must be rewritten later. If demo mode is specifically needed, isolate and label it clearly.
4. Authentication and access control
Implement real authentication, not just a decorative login screen.
- Provide a sign-in screen using email/username and password according to the chosen user model.
- Verify credentials securely; store only password hashes.
- Protect application routes and server actions. Unauthenticated users must not access clients, orders, results, or reports.
- Provide reliable sign-out and secure session handling using the chosen auth framework's recommended patterns.
- Validate forms and provide helpful but non-revealing errors. Do not expose raw exceptions or account-enumeration details.
- Do not add public self-registration unless requested.
- Provide a safe documented method to create the first administrator (e.g. a one-time CLI/bootstrap script reading credentials from environment variables or prompting securely). Never ship a hardcoded default admin password.
- Enforce role permissions on the server, not only by hiding buttons in the UI.
Start with roles only as needed: Administrator, Reception/Registration, Laboratory Staff, and Reviewer/Authorised Signatory. Keep permission rules simple and explicit. Do not imply clinical authorisation solely because a user can log in.
5. Core screens and workflow
Build these screens with shared layout, navigation, forms, tables, status indicators, responsive behaviour, loading states, and empty/error states.
A. Sign-in
- Professional, uncluttered screen with product name and space for the laboratory logo.
- Clear validation, loading, and error feedback.
- Never display secrets or raw server exceptions.
B. Dashboard
- Show actual counts such as clients, orders awaiting processing, tests in progress, and reports awaiting review only when backed by stored data.
- Include recent orders/work queue with client/order identifier, date, test summary, and status.
- Prefer a few useful cards over decorative charts or invented analytics.
C. Clients / Patients
- Searchable, paginated client list with a clear “New Client” action.
- Create/edit forms should ask only for fields required by the product.
- Practical fields may include a unique client/patient ID generated by the app, full name, date of birth or age as appropriate, sex where operationally required, contact details, optional address if required, and timestamps.
- Make required versus optional fields clear; avoid collecting unnecessary sensitive data.
- Prevent accidental duplicate submissions and use unique identifiers/indexes where appropriate.
- Show a client's previous laboratory orders if implemented.
D. Laboratory orders
- Allow an order to be started from a client profile or New Order flow.
- Generate a unique human-readable order/accession ID backed by a safe generation strategy and database uniqueness.
- Allow one or more configured tests/panels to be selected.
- Capture order date/time, referrer if required, specimen/sample details where relevant, priority if supported, and notes.
- Show every ordered test with its own status.
- Do not build billing, insurance, pharmacy, appointment, or inventory modules unless requested.
E. Test worklist and result entry
- Show ordered tests in a table or grouped sections. Each item should include test name, current status, result inputs suitable to the test type, unit, reference interval when configured, notes, and allowed actions.
- Track status per test, not only per order. Keep overall order status consistent with individual test statuses through explicit rules without erasing each test's status history.
- Allow a result to be saved as draft/in progress, then reviewed/completed through explicit actions.
- Display status text and optionally an icon alongside a colour badge. Never communicate status by colour alone.
- Enforce permissions on the server for result entry, review, and release.
- Never automatically mark all tests completed just because an order is opened or a result is typed.
- Record who changed a result/status and when, where supported.
Suggested initial status set, to be confirmed with the lab's workflow:
- Pending
- In Progress
- Awaiting Review
- Completed
- Cancelled (only if cancellation is actually supported)
Define allowed transitions in one place and reject invalid transitions. Do not add complicated queues until the core workflow works.
F. PDF report
Generate a real report for a completed/appropriately authorised order.

Include:
- Laboratory name and logo. Use a clearly marked placeholder until the user provides the real logo.
- Address/contact details only once supplied.
- Report title and unique order/report identifier.
- Client/patient name and identifier; other demographics only if captured and needed.
- Relevant collection/received/report dates when stored.
- Test name, result, unit, configured reference interval, and approved comments where applicable.
- Clear grouping by panel/category.
- Report status and reviewer/authorisation metadata only when supported.
- Page numbers and generation timestamp where practical.
- Readable typography, clean tables, print margins, and no clipped columns or overlapping text.
PDF rules:
- Provide Preview and Download/Print actions that actually work.
- The report must use persisted data, not data existing only in an unsubmitted browser form.
- Do not present a report as final if required tests remain incomplete or review/release is required but has not occurred.
- Clearly distinguish draft/unreleased reports from final reports.
- Keep report access authenticated and authorised; do not expose guessable public PDF URLs with private health data.
- Test long names, many tests, multipage reports, missing optional fields, and page breaks.
- Do not invent laboratory branding, signatory, contact details, or legal text. Keep these configurable for when the user supplies them.
6. Initial test catalogue from the uploaded document
Use the user's uploaded “FULL BLOOD COUNT UNIT REFERENCE RANGES” document as the initial test catalogue source. Model tests/panels as configurable data, not as a separate hardcoded screen for each test.

The document lists these groups:
1. Full Blood Count (FBC/CBC): WBC, Lymphs %, Mixed %, Neut %, RBC, Haemoglobin, Haematocrit, MCV, MCH, MCHC, Plt, Lymphs (Absolute), MID (Absolute), GRAN (Absolute), RDW-CV, RDW-SD, PWD, PCT, P-LCR.
2. Other tests listed near FBC: C-Reactive protein (CRP), MP (Malaria Parasite; Microscopy and RDT), HBsAg, HIV, HCV.
3. ESR: male and female reference ranges appear in the source.
4. Uric Acid (UA): male and female reference ranges appear in the source.
5. Calcium (Ca+).
6. EUCR / electrolytes, urea and creatinine: Sodium (Na), Potassium (K), Chloride (Cl), Urea (U), Creatinine, Bicarbonate.
7. FLP / lipid profile: Cholesterol, Triglyceride, HDL, LDL, VLDL.
8. LFT / liver function tests: Total Bilirubin, Direct Bilirubin, Alkaline Phosphatase (ALP), AST, ALT, Albumin (ALB), Total protein, GGT.
9. Fasting blood sugar.
10. HVS (High Vaginal Swab): Pus cell, Epithelial cells, Yeast cells, Bacterial cells, Schistosoma Haematobium, RBC, Trichomonas Vaginalis, Culture Report.
11. Eye Swab MCS: test and culture report.
12. Urine MCS: Appearance, Pus cell, Epithelial cells, RBC, Yeast cell, Bacterial cells, Crystal oxalate, Calcium oxalate, Cast, Schistosoma Haematobium, Trichomonas Vaginalis, Culture report.
13. Sputum MCS: Appearance, Microscopy, Culture report.
14. Thyroid Function Test: TSH / Thyroid Stimulating Hormone, T4 (the source also labels the panel TSH, FT3, FT4), T3.
15. VDRL (Syphilis).
16. HSV1 (Herpes Simplex Virus): IgG and IgM.
17. HSV2 (Herpes Simplex Virus): IgG and IgM.
18. General MCS report: Sample type, Macroscopy, Microscopy, Culture, Sensitivity.
Source limitations — important
- Some entries have blank reference ranges, unclear units, inconsistent unit notation, or labels that may need clarification. For example, GGT has no range shown and several labels/units appear ambiguous.
- Keep test names, units, and reference intervals configurable. Do not silently “fix” labels, guess missing ranges, or claim the data is medically validated.
- The document is a transcription aid, not proof that each interval is appropriate for all populations, methods, analysers, ages, or sexes.
- Before enabling automated normal/abnormal flags or production reports with reference intervals, make it possible for qualified laboratory personnel to verify and approve them.
- Where an interval is unknown/unapproved, show “Not configured” or omit it; do not invent a value.
- Narrative tests such as microscopy, culture, and sensitivity should support structured text and/or organism/antibiotic rows once reporting requirements are confirmed, not only numeric inputs.
- Keep the catalogue flexible for additional test documents and later corrections.
7. Minimal data model guidance
Choose a simple MongoDB model with suitable indexes. Possible collections/entities:
- User: identifier, display name, email/username, password hash or auth-provider reference, role, active flag, timestamps.
- Client/Patient: unique internal ID, necessary demographics/contact fields, timestamps.
- TestDefinition: unique code, name, panel/category, input type (numeric, text, qualitative, microscopy, culture/sensitivity, or structured), confirmed default unit, reference metadata only when approved, enabled flag.
- LabOrder: unique order/accession ID, client reference, creator, dates, overall status, notes, timestamps.
- OrderedTest / TestResult: order reference, test definition snapshot/reference, individual status, suitable result payload, recorded unit, appropriate reference metadata snapshot, notes, created/updated/reviewed/released metadata.
- AuditEvent (or equivalent append-only audit record): user, action, record type/identifier, timestamp, minimal change metadata without unnecessary duplication of sensitive content.
- LabSettings: display name, logo reference, address/contact details, report footer, numbering settings, and necessary configuration.
These are suggestions, not a demand for a large enterprise architecture. Use a model that meets the MVP and indexes required fields. Preserve historical report meaning: updating a test catalogue entry later must not silently rewrite an old report. Do not implement every possible collection if a smaller reliable model is sufficient.
8. UI design direction — follow the user's network-monitoring dashboard as inspiration
The user supplied screenshots of their own network-monitoring application (Picomon). This is the preferred visual reference for the LIS UI. The user likes it because it is simple, uncluttered, easy to scan, and easy to operate. Borrow its visual language and usability principles; do not copy the network-monitoring product or reproduce its screens literally. Translate the same design quality into laboratory workflows.
8.1 Overall visual character
- Build a calm, modern, understated, professional web application for busy laboratory staff.
- Prefer a clean, light interface with soft neutral page backgrounds, white content surfaces, fine light-grey borders, restrained shadows, and generous but purposeful spacing.
- Use a muted green/sage accent inspired by the reference screenshots for primary actions, active navigation, selected tabs, and small highlights only if it fits the user's supplied brand colours. The user's actual brand palette takes priority. If no brand palette is known yet, keep provisional colours centralised in theme tokens so they can be replaced globally later.
- Avoid visual noise: no oversized gradients, glassmorphism, strong drop shadows, colourful background illustrations, giant hero sections, or unnecessary animation.
- Make clinical/laboratory information the focus. UI decoration must never compete with test names, client identity, results, and statuses.
- The finished product should feel like a thoughtfully designed business dashboard, not an admin template with its logo swapped.
8.2 Application shell and navigation
- Use a persistent left sidebar on desktop, roughly 210–230px wide as a starting point, with a subtle right border and a very light neutral surface.
- Place the laboratory wordmark/logo at the upper-left, with a small icon or mark and compact product name. Until the user supplies a logo, use a restrained text-based placeholder; do not invent an official brand mark.
- Include a compact search/control area only if useful. Do not build a fake global search that does nothing.
- Group sidebar items under small uppercase or letter-spaced section captions where it improves scanning.
- Use simple line icons from one installed icon library. Keep icon size and stroke weight consistent.
- The active navigation item should have a pale tint using the brand accent, a clear label, and a subtle shape/radius. Do not use a large saturated block.
- Use LIS-relevant destinations that exist in the app, for example Overview, Clients, Lab Orders, Test Worklist, Test Catalogue, Reports, and Settings. Only show routes that actually exist and are permitted for the current role.
- At the bottom, place the signed-in user's name/role and a working account menu or sign-out control if supported.
- On mobile, collapse the sidebar into an accessible drawer or compact navigation pattern; do not let it consume the whole screen.
8.3 Top bar and page heading
- Use a slim top bar with breadcrumbs (for example Workspace / Clients), and small utilities only when implemented (system status, theme toggle, notifications, user avatar).
- Keep the page itself visually distinct from the top bar with a subtle divider, as in the reference screenshot.
- Use a clear page title at approximately 24–28px on desktop, a short supporting sentence when useful, and a clear primary action aligned to the right (for example New client or Create order).
- Add a small section eyebrow/kicker only when it helps context; keep it low contrast and compact.
- Avoid giant headings, long introductions, and repeated page-title text.
- On smaller screens, wrap actions cleanly below the title rather than allowing clipping or horizontal overflow.
8.4 Dashboard and summary cards
- Use one clear title/description area and a compact row of summary cards near the top when useful.
- Cards should be white or near-white with a thin border, small radius, and little or no shadow. Use consistent padding and alignment.
- A summary card should contain a short label, a prominent but not oversized value, optional tiny contextual text, and optionally a small icon in a lightly tinted square.
- Use the same card height and internal spacing across a row. Avoid oversized, colourful metric tiles.
- Possible LIS metrics include clients registered, orders awaiting processing, tests in progress, and reports awaiting review—but render only metrics backed by actual data.
- Below metrics, prioritise the actionable work queue/recent orders table instead of decorative charts. Add charts only when a real data question makes them useful and the data exists.
- Use concise status indicators near the top only where they report a real application/system state. Do not claim “all systems operational” unless a real health check supports it.
8.5 Tables and worklists — a major visual priority
The reference dashboard's table is a key design inspiration. Use its compact, easy-to-scan structure for clients, orders, tests, and reports.
- Place the table inside a white bordered panel with a clean panel title, optional count badge, and brief helper text if useful.
- Place search and relevant filters in a separate control row above the column headers. Keep controls compact and aligned.
- Table headings should use small uppercase or restrained semibold text with letter spacing; use high-enough contrast to remain readable.
- Use comfortable row height, consistent column alignment, subtle horizontal borders, and no excessive zebra striping.
- Make the primary identifier/name easy to find, with secondary detail below it only when that genuinely helps.
- Use compact neutral or softly tinted status pills with a small dot/icon and a readable status label. Never rely on colour alone.
- Keep row actions in a predictable far-right position. Prefer a compact overflow menu for secondary actions; do not crowd every row with many buttons.
- Provide clear empty, loading, error, and pagination states. Display row counts only when they are real.
- Use horizontal scrolling or a responsive alternate presentation on narrow viewports; do not make the whole page overflow horizontally.
- For clinical results, make result, unit, and approved reference interval easy to compare. Preserve units and displayed precision according to the configured test definition. Do not change result values for visual formatting.
- Provide obvious but not visually loud distinctions for abnormal/critical states only when the underlying result has been properly interpreted under approved rules. Never invent clinical flags.
8.6 Buttons and form controls
- Use a consistent button hierarchy: one filled primary action using the brand colour; secondary actions with a white/neutral surface and light border; destructive actions visually distinct and confirmation-protected where appropriate.
- Buttons should be compact, aligned, and easy to scan—not oversized pill buttons throughout the app.
- Use consistent form-control heights, thin borders, understated radii, readable placeholder text, and visible keyboard focus.
- Form labels belong above their fields and must remain visible after entry; do not rely on placeholders as labels.
- Group longer forms into logical sections with restrained section headings and dividers only where useful.
- Use inline validation next to the field and concise error summaries for longer forms.
- Keep Cancel/Back actions secondary and Save/Continue actions clearly primary.
- Show disabled/loading states while a real submission is in progress. Never show a success notification until the operation succeeds.
8.7 Modal and drawer style
The user's second screenshot shows a centred, focused “Add a device” modal over a dimmed existing screen. Adapt that pattern to short LIS tasks such as adding a client, choosing tests, or confirming an action when a modal is the best fit.
- Use a calm translucent/dim backdrop that leaves the context recognisable while clearly focusing attention on the modal.
- Use a white surface, moderate width, restrained radius, subtle shadow, and generous internal padding.
- Add a concise title, one-line description if helpful, close control in the top-right, form labels, and a footer separated subtly from the body when useful.
- Keep fields in a deliberate grid on desktop and stack them on mobile. Ensure modal height stays within the viewport and content can scroll.
- Align Cancel and primary action buttons consistently in the footer.
- Do not place long, multi-stage laboratory result entry workflows in a cramped modal. Use a dedicated page for complex tasks and a modal for short focused actions.
- Confirm destructive actions explicitly and describe the consequence. A decorative modal with nonfunctional buttons is not acceptable.
8.8 Colour, typography, borders, and spacing
- Use the supplied brand colours from the project or user. Centralise all colours in existing theme variables/CSS custom properties/Tailwind theme configuration.
- If no palette has been supplied, use the screenshot only as provisional inspiration: off-white/light grey app background, white surfaces, dark charcoal text, muted secondary text, pale neutral borders, and a quiet sage/green accent. Keep this palette easy to replace.
- Use green, amber/orange, red, and blue informational states only semantically and with readable text; do not make every area colourful.
- Use a clean sans-serif already present in the project. Establish a consistent hierarchy for page title, panel title, body, muted helper text, labels, and table headers.
- Use a deliberate, repeatable spacing scale. Align cards, filters, tables, and page headings across routes.
- Prefer thin 1px borders and shadows only where they clarify elevation. Avoid heavy card outlines or nested cards inside cards without a reason.
- Make contrast and font sizes comfortable for long laboratory shifts and common desktop screens.
8.9 LIS-specific workflows should retain the same visual language
- Clients: a searchable clean table and a simple, structured registration form.
- Orders: a clear order header, client identity, selected panels/tests, and overall status without clutter.
- Worklist/results: a compact table or grouped panel layout where every test has its own visible status and result fields. Use section headings to organise panels from the uploaded test document.
- Test entry: structure numeric results, qualitative results, microscopy, culture, and sensitivity according to the configured test type. Do not force every test into the same numeric input shape.
- Reports: a clear report details page with a prominent preview/download/print action. Keep report presentation calm and professional; use a print-specific layout that does not include the sidebar or application navigation.
- Settings: simple forms and clear sections rather than a crowded card grid.
8.10 Responsive behaviour
- Desktop: fixed/persistent sidebar, slim top bar, page title/action row, full-width panels and tables within a consistent content margin.
- Tablet: reduce content padding and allow navigation to collapse when needed.
- Mobile: drawer/collapsible navigation, stacked page title/actions, single-column forms, touch-friendly controls, and horizontal table scrolling or another usable list layout.
- Ensure modals fit the viewport, buttons do not overlap, long names wrap sensibly, and controls remain usable at 320px width.
- Verify a desktop and mobile viewport before considering the UI task complete, where practical.
8.11 Reference interpretation rules
- Use the screenshots to infer simplicity, subtle green accents, navigation hierarchy, table quality, and modal craftsmanship.
- Do not copy the network dashboard's labels, sites/devices/alerts concepts, table columns, sample values, or exact component arrangement.
- Do not use its fictitious device data in the LIS.
- Do not sacrifice clarity of client identity, test name, result, unit, or status in order to resemble the screenshot.
- The goal is “the same simplicity and polish, designed for a laboratory”, not an exact clone.
8.12 UI implementation guardrails
- Keep the backend, database schema, authentication, server actions, API routes, business rules, permissions, and clinical logic unchanged when making visual changes. The overall MVP still needs these features, but UI redesign must not casually rewrite them.
- Reuse existing working controls and handlers. Improve their appearance without disconnecting functionality.
- Do not add fake buttons, nonfunctional search fields, fake counts, or sample records presented as real.
- Make changes in focused steps: establish the shared shell/design tokens, then dashboard, then client/order/worklist/report screens. Avoid rewriting every screen simultaneously.
- When a style choice conflicts with accessibility or a laboratory workflow, prioritise accessibility and correct workflow.
9. Security, privacy, and clinical responsibility
- Treat client/patient demographics, orders, test results, and reports as sensitive data.
- Enforce server-side authentication and authorisation for all data reads and mutations.
- Validate inputs at the server boundary as well as in the UI.
- Never expose MongoDB credentials or auth secrets in source control or browser code.
- Avoid logging patient details or test results unnecessarily.
- Use safe errors; do not expose raw server exceptions.
- Configure secure session/cookie behaviour as recommended by the selected auth system.
- Avoid insecure sequential public identifiers for private-record URLs.
- Keep an audit trail for clinically meaningful result/status changes.
- Do not invent diagnoses, clinical advice, reference ranges, critical flags, or regulatory-compliance claims.
- Never interpret an incomplete result as normal by default.
- Document backup, access, retention, and deployment considerations before real patient data is used.
10. Testing and quality checks
Verify that:
- Valid credentials can sign in and invalid credentials fail safely.
- Protected pages/actions reject unauthenticated users.
- An authorised user can create, search, view, and update clients.
- Orders link to the correct client.
- Each ordered test has its own status and result; completing one test does not complete its siblings accidentally.
- Invalid transitions and unauthorised edits are rejected.
- Records persist in MongoDB once the URI is configured.
- PDF generation uses persisted data and respects report status/permissions.
- Reports do not expose another client's data and print cleanly across multiple pages.
- Forms have loading, validation, success, empty, and error states.
- Core screens remain usable at desktop and mobile widths.
Run the available lint, type-check, tests, and build. Report failures truthfully. Never claim a check passed unless it actually ran.
11. Fast implementation sequence
1. Inspect the repository and determine whether a Next.js app already exists.
2. Give a short MVP plan, then proceed with implementation.
3. Establish Next.js/TypeScript, styling, shared layout, .env.example, and MongoDB connection module.
4. Implement authentication, protected routes, and safe administrator bootstrap.
5. Implement client registration, search, detail, and edit.
6. Build the initial test catalogue from the uploaded document, keeping questionable values configurable/unapproved.
7. Implement lab orders, individual test statuses, result entry, and a minimal review/completion flow.
8. Implement PDF preview/download/print with a configurable logo placeholder and persisted data.
9. Add simple dashboard counts and worklists backed by stored data.
10. Test the full workflow and document setup, including how the user will add the MongoDB URI later.
Prefer one working end-to-end slice over many empty screens. Do not build billing, insurance, pharmacy, appointments, advanced analytics, multi-branch management, external analyser integration, or elaborate inventory unless explicitly requested.

When the user provides the MongoDB URI, logo, company details, further test documents, or approved reference ranges, integrate them through configuration and the appropriate data model. Do not invent those values in advance.
12. Completion report
At each milestone report:
- What is implemented.
- Files and main areas changed.
- Checks actually run and their results.
- Whether MongoDB is connected or awaiting the user's URI.
- Missing logo/company details, unapproved reference intervals, or workflow decisions.
- The exact next step needed.
Final directive
Build a professional, secure, small LIS MVP quickly. Prioritise authentication, client creation, laboratory orders, per-test status/results, and printable PDF reports. Use the uploaded laboratory test document as the initial catalogue source, keep uncertain values configurable and unapproved, and leave space for the MongoDB URI and logo to be supplied later. Keep the code maintainable and the limitations honest. Do not pretend unfinished integrations work.