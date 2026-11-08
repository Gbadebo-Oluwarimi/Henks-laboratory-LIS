# Laboratory Workspace

A small LIS workspace for patient registration, laboratory orders, individual test results, review, and printable reports.

## Local setup

1. Install Node.js 24.x and npm (the project pins this version in `.nvmrc`).
2. Copy `.env.example` to `.env.local`.
3. Set `MONGODB_URI` to the URI supplied by your MongoDB administrator. The URI may name the database; this project does not invent a cluster, account, or database name.
4. Generate a private `AUTH_SECRET` with at least 32 characters, for example with `openssl rand -base64 48`.
5. Start the app with `npm run dev`, open <http://localhost:3000/sign-up>, and create the first administrator. The account is active immediately after creation.

The real URI and secrets belong only in `.env.local`, which is ignored by Git. Never put secrets in browser code or commit them. If `MONGODB_URI` is missing, sign-in remains available and protected workspace routes explain the missing connection; no temporary or in-memory storage is used. First-administrator sign-up is one-time and is disabled once any account has been created.

## Deploy to Vercel

1. Push the repository to a Git provider and import it into Vercel. Vercel detects the Next.js framework and uses the existing `npm run build` script (`next build --webpack`); no `vercel.json` override is needed.
2. Add `MONGODB_URI`, `AUTH_SECRET`, and `RESEND_API_KEY` in Vercel's Production Environment Variables. Set `RESEND_FROM_EMAIL` to a Henks sender address whose domain is verified in Resend. Use a separate database and secret for Preview deployments; never point previews at live patient data. Redeploy after changing variables.
3. The initial administrator signs up at `/sign-up` and can sign in immediately after account creation. First-administrator registration closes after the first account is created.
4. Configure MongoDB network access so the deployed application can connect from Vercel, using the outbound networking controls available to the Vercel project. Keep database credentials restricted and do not open the database to unrestricted public access.
5. Deploy and verify administrator sign-up, sign-in, patient creation, order creation, result review, report printing, and sending an authorized report PDF by email in the deployed environment before using real patient records.

The application requires a Node.js runtime and a reachable MongoDB database. Its authenticated workspace is dynamic and is not suitable for static export. Environment variables added or changed in Vercel apply to new deployments.

## Workflow

- The first administrator can register with a name, email, and password. The account is active immediately, and this bootstrap registration closes after the first account; subsequent staff accounts are created by an administrator.
- Roles are Administrator, Reception, and Laboratory Staff. Any signed-in user can register patients. Administrators can grant report approval to individual users; administrators always retain approval authority. Server actions enforce role checks for other restricted actions and approval checks for report release.
- Patient records capture name, date of birth, phone, email, and house address. Patient selection during order creation supports typing by name or patient ID.
- Each ordered test includes its specimen type and moves through Pending, In Progress, Awaiting Review, and Completed. Results can be edited; edits reopen completed/reviewed tests and are written to the staff audit log.
- Reports are based on persisted order data. An order is final only when all of its tests have been reviewed and completed. Print / Save PDF opens the browser print dialog; Email PDF sends an authorized report copy to the email on the patient record through Resend.
- Final reports show the approving user's signature from `public/signature/<name-slug>-signature.png` (for example, `ada-okafor-signature.png`). The existing `admin-signature.png` remains the fallback for Administrators. The authorizer's name and date are printed; their email is not.
- The reports directory groups reports by patient; selecting a patient opens all of that patient's reports.
- Patient, order, test-definition, and audit-event records are stored in MongoDB. Administrators can add, edit, disable, and restore test definitions; disabled tests are omitted from new orders. Recent activity shows staff actions from the previous hour. Existing order snapshots do not change when a definition is later edited.
- Advanced LIS modules appear in navigation as locked entries until their workflows are implemented and configured.
- Catalogue prices are versioned by panel and effective date, recorded in NGN minor units, and snapshotted onto new orders. No prices are preloaded; an unpriced panel remains usable by the existing MVP workflow and is explicitly marked as unconfigured.
- Orders create separate specimen records for their configured specimen types. Specimen collection, receipt, acceptance, rejection, processing, completion, and recollection are audited independently from result status. Labels include a human-readable specimen ID and Code 39 barcode.
- Numeric QC runs use acceptance limits and lot expiry explicitly entered by an administrator. Only configurations marked as release-gating block authorization, and the latest run for every active required control must pass. The system supplies no clinical limits or QC rules.
- New report releases save an immutable result and patient snapshot as a numbered version. Corrections start a reasoned amendment, reopen result review, and create a new report version only after authorization; earlier versions remain available.

## Test catalogue and clinical review

The initial catalogue is transcribed from the supplied “FULL BLOOD COUNT UNIT REFERENCE RANGES” document. Complete source range text and units are preserved and shown in reports; blank or incomplete values remain unconfigured. Source text is not marked clinically approved, and the app does not calculate normal/abnormal flags. Qualified laboratory personnel must independently validate intervals, populations, methods, and workflow before clinical use. Henks branding and report contact details are used in the report; reviewer attribution appears only when recorded.

## Checks

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Before real patient data

Configure MongoDB backups, access restrictions, network controls, TLS, deployment secrets, monitoring, retention, and a documented recovery process with the laboratory's responsible administrator. Validate the workflow, report layout, catalogue, approved references, staff permissions, and legal/regulatory requirements in the intended environment before production use. This MVP does not claim regulatory compliance.
