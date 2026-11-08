import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { Fragment } from "react";

import { getDatabase } from "@/lib/mongodb";
import type { LabOrder } from "@/lib/models";
import { displayPanelName, hasSourceReference } from "@/lib/catalogue";
import { ageFromDateOfBirth, splitPatientName } from "@/lib/presentation";
import { PrintButton } from "@/app/(workspace)/reports/[id]/print-button";
import { ReportSheetScaler } from "@/app/(workspace)/reports/[id]/report-sheet-scaler";
import { labBranding } from "@/lib/branding";

const BRAND = {
  navy: "#073F9F",
  red: "#0049B7",
  logo: labBranding.logo,
  name: labBranding.name,
  phones: labBranding.phones,
  address: labBranding.address,
  emails: labBranding.emails,
};

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) notFound();

  const database = await getDatabase();
  const storedOrder = await database
    .collection<LabOrder>("labOrders")
    .findOne({ _id: new ObjectId(id) });

  if (!storedOrder) notFound();

  // Always preview and print the order's current state, including the latest
  // released amendment when one exists.
  const order: LabOrder = storedOrder;

  const isFinal =
    order.status === "Completed" &&
    order.tests.length > 0 &&
    order.tests.every((test) => test.status === "Completed") &&
    Boolean(order.authorizedBy && order.authorizedByName && order.authorizedAt);



  const specimenTypes = [
    ...new Set(
      order.tests.flatMap((test) =>
        test.specimenType?.trim() ? [test.specimenType.trim()] : []
      )
    ),
  ];

  const reportPanelOrder = ["Fasting blood sugar", "EUCR", "LFT", "FLP", "Hormonal Assay", "Tumour Markers", "Glucose Tolerance Test", "Serology", "CSF Analysis", "Urinalysis", "Full Blood Count (FBC/CBC)", "Coagulation Tests", "Haemoglobin Genotype / Blood Group", "MCS Report", "Other Investigations", "Widal", "Malaria Parasite", "Microscopy/Bloodsmear(Malaria Parasite)"];
  const panels = [...new Set(order.tests.map((test) => test.panel || "Other tests"))].sort((a, b) => {
    const rankA = reportPanelOrder.indexOf(a);
    const rankB = reportPanelOrder.indexOf(b);
    return (rankA < 0 ? reportPanelOrder.length : rankA) - (rankB < 0 ? reportPanelOrder.length : rankB) || a.localeCompare(b);
  });
  // Final reports use the authorisation date so the printed date doesn't
  // change every time the page is opened. Drafts use "now".
  const localOrderDate = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Lagos",
  }).format(order.createdAt);
  const savedReportDetails = order.reportDetails ?? {
    surname: "",
    otherNames: order.clientSnapshot.fullName,
    laboratoryNo: order.accessionId,
    hospitalNo: "",
    age: "",
    ageUnit: "years" as const,
    sex: order.clientSnapshot.sex ?? "" as const,
    date: localOrderDate,
    requestedTest: [...new Set(order.tests.map((test) => displayPanelName(test.panel)))].join(", "),
    specimen: [...new Set(order.tests.flatMap((test) => test.specimenType?.trim() ? [test.specimenType.trim()] : []))].join(", "),
    generalComment: "",
    doctorComment: "",
    filmReport: "",
    filmRBCs: "",
    filmWBCs: "",
    filmPlatelets: "",
    filmMalaria: "",
    antibiogram: {},
  };
  const patientNameParts = splitPatientName(order.clientSnapshot.fullName);
  const patientAge = ageFromDateOfBirth(order.clientSnapshot.dateOfBirth, savedReportDetails.date);
  const reportDetails = {
    ...savedReportDetails,
    surname: savedReportDetails.surname || patientNameParts.surname,
    otherNames: !savedReportDetails.otherNames || savedReportDetails.otherNames === order.clientSnapshot.fullName
      ? patientNameParts.otherNames
      : savedReportDetails.otherNames,
    hospitalNo: savedReportDetails.hospitalNo || order.clientSnapshot.patientId,
    age: patientAge?.age ?? savedReportDetails.age,
    ageUnit: patientAge?.ageUnit ?? savedReportDetails.ageUnit,
    sex: order.clientSnapshot.sex ?? savedReportDetails.sex,
  };
  const displayDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeZone: "Africa/Lagos" })
    .format(new Date(`${reportDetails.date}T00:00:00.000Z`));
  return (
    <main className="report-page min-w-0 space-y-5 pb-8 text-slate-800">
      {/* Screen controls — hidden when printing */}
      <header className="report-actions mx-auto flex max-w-5xl flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">
            Reports / {order.accessionId}
          </p>
          <h1 className="gellix-heading text-2xl font-semibold tracking-tight text-[#073F9F]">
            Report preview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isFinal ? "Released report" : "Draft / unreleased report"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/orders/${id}`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={15} />
            Back to order
          </Link>
          <PrintButton
            orderId={id}
            patientEmail={order.clientSnapshot.email ?? ""}
            patientName={order.clientSnapshot.fullName}
            accessionId={order.accessionId}
            isFinal={isFinal}
          />
        </div>
      </header>

      {!isFinal && (
        <div className="report-actions mx-auto max-w-5xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Draft / unreleased report.</strong> This report must not be
          used as a final report until all ordered tests have been completed
          and reviewed.
        </div>
      )}

      {/* Keep one fixed A4 layout and scale the sheet down to fit small screens. */}
      <ReportSheetScaler>
      <article id="report-sheet" className="report-sheet">
        <header className="report-header">
          <div className="report-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="report-header-image" src={BRAND.logo} alt={`${BRAND.name} logo`} />
            <div className="report-brand-divider"><span /><span /></div>
            <h2>{BRAND.name}</h2>
            <p className="report-contact">{BRAND.address}</p>
            <p className="report-contact">{BRAND.phones.join(" · ")}</p>
            <p className="report-contact">{BRAND.emails.map((email, index) => <a key={email} href={`mailto:${email}`}>{index > 0 ? " · " : ""}{email}</a>)}</p>
          </div>
          <div className="report-header-meta">
            <h2 className="report-form-title">LABORATORY REPORT FORM</h2>
            <p className="report-contact"><strong>Laboratory No.:</strong> {reportDetails.laboratoryNo}</p>
            <p className="report-contact"><strong>Report status:</strong> {isFinal ? "Authorized" : "Draft"}</p>
          </div>
        </header>

        <section className="report-patient-details" aria-label="Patient information">
          <div className="report-patient-grid">
            <ReportField label="SURNAME" value={reportDetails.surname} />
            <ReportField label="OTHER NAMES" value={reportDetails.otherNames} />
            <ReportField label="LABORATORY NO." value={reportDetails.laboratoryNo} />
            <ReportField label="HOSPITAL NO." value={reportDetails.hospitalNo} />
            <ReportField label="AGE" value={reportDetails.age ? `${reportDetails.age} ${reportDetails.ageUnit}` : ""} />
            <ReportField label="SEX" value={reportDetails.sex} />
            <ReportField label="DATE" value={displayDate} />
            <ReportField label="SPECIMEN" value={reportDetails.specimen || specimenTypes.join(", ")} />
            <div className="report-test-request"><span className="report-field-label">REQUESTED TEST</span><span className="report-request-value">{[...new Set(order.tests.map((test) => displayPanelName(test.panel)))].join(", ")}</span></div>
          </div>
        </section>

        <section className="report-test-section">
          <header className="report-title-block"><h2>LABORATORY INVESTIGATION RESULTS</h2></header>
          <p className="report-mark-instruction">Results are listed below with units and reference ranges where available.</p>
          <div className="report-results"><table className="report-table">
            <colgroup><col style={{ width: "5%" }} /><col style={{ width: "35%" }} /><col style={{ width: "15%" }} /><col style={{ width: "18%" }} /><col style={{ width: "27%" }} /></colgroup>
            <thead><tr><th aria-label="Performed"></th><th>Test</th><th>Unit</th><th>Result</th><th>Reference range</th></tr></thead>
            <tbody>{panels.map((panel) => <Fragment key={panel}><tr><td colSpan={5} className="report-subsection-row">{displayPanelName(panel)}</td></tr><PanelRows tests={order.tests.filter((test) => test.panel === panel)} /></Fragment>)}</tbody>
          </table></div>
        </section>

        <section className="report-comments">
          <div><strong>DOCTOR'S COMMENT</strong><div className="report-doctor-comment">{reportDetails.doctorComment || ""}</div></div>
          <div><strong>LABORATORY COMMENT</strong><div className="report-general-comment">{reportDetails.generalComment || ""}</div></div>
        </section>

        <section className="report-signatures" aria-label="Signature spaces">
          <div><div className="report-signature-space" /><strong>LAB MANAGER SIGNATURE / DATE</strong></div>
          <div><div className="report-signature-space" /><strong>LABORATORY SCIENTIST SIGNATURE / DATE</strong></div>
        </section>

        <footer className="report-footer"><span>{order.clientSnapshot.fullName}</span><span>Accession {order.accessionId}</span><span>{isFinal ? "Authorized" : "Draft"}</span></footer>
      </article>
      </ReportSheetScaler>

      <style>{`
        .gellix-heading {
          font-family: "Gellix", Arial, sans-serif;
        }

        .report-page {
          width: 100%;
          overflow-x: hidden;
        }

        .report-sheet-viewport {
          position: relative;
          width: 100%;
          max-width: 210mm;
          margin-inline: auto;
          overflow: hidden;
        }

        .report-sheet {
          position: relative;
          isolation: isolate;
          box-sizing: border-box;
          width: 210mm;
          max-width: none;
          min-height: 297mm;
          padding: 10mm;
          border-top: 1.5px solid #202020;
          display: flex;
          flex-direction: column;
          transform-origin: top left;
          background: #fff;
          color: #1e293b;
          overflow-wrap: anywhere;
          text-transform: uppercase;
        }

        .report-watermark {
          position: absolute;
          z-index: 0;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 52mm;
          pointer-events: none;
        }

        .report-sheet > :not(.report-watermark) { position: relative; z-index: 1; }

        .report-header {
          display: grid !important;
          grid-template-columns: minmax(0, 1.55fr) minmax(62mm, 0.95fr);
          align-items: flex-start;
          gap: 8mm;
          padding-bottom: 5mm;
        }

        .report-brand,
        .report-header-meta { min-width: 0; }

        .report-brand h2 { margin: 1.5mm 0; font-size: 15px; line-height: 1.2; }

        .report-brand-divider { display: flex; height: 1.5mm; width: 100%; margin-top: 1mm; }
        .report-brand-divider span:nth-child(1) { flex: 0 0 78%; background: ${BRAND.navy}; }
        .report-brand-divider span:nth-child(2) { flex: 1; background: ${BRAND.red}; }
        .report-header-image { display: block; width: 100%; height: 27mm; max-height: 27mm; object-fit: contain; object-position: left center; }
        .report-form-title { margin: 0 0 2mm; padding: 2.5mm 3mm; background: ${BRAND.red}; color: #fff; font-size: 12px; line-height: 1.25; text-align: center; }
        .report-contact { color: ${BRAND.navy}; }
        .report-brand .report-contact { display: block; margin: 1mm 0 0; text-align: left; font-size: 8px; line-height: 1.3; overflow-wrap: anywhere; }
        .report-header-meta .report-contact { display: block; margin: 1mm 0; text-align: right; font-size: 9px; line-height: 1.3; overflow-wrap: anywhere; }

        .report-header > div {
          min-width: 0;
        }

        .report-patient-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 9mm;
          row-gap: 0;
          align-items: start;
        }

        .report-patient-details { border: 0; border-radius: 0; background: #fff; padding: 0; }
        .report-field-card { border: 1px solid #626b78; padding: 2mm; }

        .report-test-request { display: flex; grid-column: 1 / -1; align-items: flex-start; gap: 3mm; min-height: 7mm; min-width: 0; padding: 1mm 0; }

        .report-test-section { margin-top: 2mm; }
        .report-mark-instruction { margin: 1mm 0; color: #3e4652; font-size: 8px; }
        .report-title-block { break-after: avoid; page-break-after: avoid; text-align: center; padding: 3mm 0 2mm; color: #111827; }
        .report-title-block p { margin: 0; font-family: "Gellix", Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
        .report-title-block h2 { margin: 1mm 0 0; font-family: "Gellix", Arial, sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; }

        .report-field-card {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          align-items: center;
          column-gap: 3mm;
          min-width: 0;
          padding: 1.5mm 2mm;
          border: 1px solid #758091;
        }

        .report-field-label {
          color: ${BRAND.navy};
          font-family: "Gellix", Arial, sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1.4;
        }

        .report-field-value {
          color: #172033;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.45;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .report-results {
          width: 100%;
          min-width: 0;
          overflow: hidden;
          margin-top: 1mm;
        }

        .report-test-request .report-field-label { flex: 0 0 auto; white-space: nowrap; }
        .report-request-value { flex: 1 1 auto; min-width: 0; color: #172033; font-size: 10px; line-height: 1.45; overflow-wrap: anywhere; }

        .report-table {
          width: 100%;
          max-width: 100%;
          font-size: 10px;
          line-height: 1.35;
          border-collapse: collapse;
          table-layout: fixed;
          text-align: left;
        }

        .report-table th:nth-child(1), .report-table td:nth-child(1) { width: 5% !important; }
        .report-table th:nth-child(2), .report-table td:nth-child(2) { width: 35% !important; }
        .report-table th:nth-child(3), .report-table td:nth-child(3) { width: 15% !important; }
        .report-table th:nth-child(4), .report-table td:nth-child(4) { width: 18% !important; }
        .report-table th:nth-child(5), .report-table td:nth-child(5) { width: 27% !important; }

        .report-table th,
        .report-table td {
          box-sizing: border-box;
          border: 1px solid #000;
          padding: 1.4mm 2mm;
          color: #172033;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        .report-table th {
          background: ${BRAND.navy};
          color: #fff;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .025em;
        }

        .report-subsection-row { background: #edf3ff; color: ${BRAND.navy} !important; font-weight: 700; }
        .report-test-name-cell { padding-left: 3mm !important; }

        .report-chemistry-heading { font-size: 10px; line-height: 1.1; overflow-wrap: anywhere; }
        .report-chemistry-cell { min-width: 0; overflow-wrap: anywhere; word-break: normal; }

        .report-table td:first-child,
        .report-table th:first-child {
          padding-left: 3px;
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .report-table thead {
          display: table-header-group;
        }

        .report-table tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .report-checkbox-cell { text-align: center !important; padding: 1mm !important; }
        .report-checkbox-cell span { display: inline-block; width: 3mm; height: 3mm; border: 1px solid #252a32; }

        .report-footer { display: flex; justify-content: space-between; gap: 4mm; margin-top: 5mm; border-top: 1px solid ${BRAND.navy}; padding-top: 2mm; color: #475569; font-size: 8px; }
        .report-comments { display: grid; gap: 3mm; margin-top: 5mm; font-size: 9px; }
        .report-comments strong { color: ${BRAND.navy}; }
        .report-comments div { height: 5mm; border-bottom: 1px dotted #657080; }

        .report-doctor-comment { height: auto; min-height: 20mm; border: 1px solid #758091; padding: 2mm; white-space: pre-wrap; overflow-wrap: anywhere; text-transform: none; }
        .report-general-comment { height: auto; min-height: 10mm; border: 1px solid #758091; padding: 2mm; white-space: pre-wrap; overflow-wrap: anywhere; text-transform: none; }
        .report-signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12mm; margin-top: 7mm; font-size: 8px; color: ${BRAND.navy}; }
        .report-signatures > div { min-width: 0; }
        .report-signature-space { height: 20mm; border-bottom: 1px solid #475569; margin-bottom: 2mm; }
        .report-draft-note { margin-top: 6mm; color: #073F9F; font-size: 9px; font-weight: 700; }

        .report-header,
        .report-patient-details,
        .report-footer {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .app-shell,
          .workspace-main {
            display: block !important;
            min-height: 0 !important;
          }

          .sidebar,
          .mobile-menu-button,
          .mobile-scrim,
          .workspace-main > .topbar {
            display: none !important;
          }

          body * {
            visibility: hidden;
          }

          .report-sheet,
          .report-sheet * {
            visibility: visible;
          }

          .report-actions {
            display: none !important;
          }

          .report-page {
            position: static !important;
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .report-sheet-viewport {
            position: static !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          .report-sheet {
            position: static !important;
            isolation: isolate;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            overflow: visible !important;
            transform: none !important;
            margin-left: 0 !important;
            display: block !important;
          }

          .report-header {
            display: grid !important;
            grid-template-columns: minmax(0, 1.55fr) minmax(62mm, 0.95fr) !important;
            align-items: flex-start !important;
            gap: 8mm !important;
          }

          .report-brand,
          .report-header-meta { min-width: 0 !important; }

          .report-patient-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            row-gap: 2mm !important;
          }

          .report-title-block,
          .report-comments > div,
          .report-signatures,
          .report-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-table thead { display: table-header-group !important; }
          .report-table tr { break-inside: avoid !important; page-break-inside: avoid !important; }

          .report-results {
            overflow: visible !important;
          }

          .report-table,
          .report-table th,
          .report-table td,
          .report-table .report-chemistry-heading {
            font-size: 10px !important;
            line-height: 1.1 !important;
          }

          .report-table th,
          .report-table td {
            padding: 0.75px 2px !important;
          }

          .report-table th:first-child,
          .report-table td:first-child {
            padding-left: 3px !important;
          }

          .report-table th { background: ${BRAND.navy} !important; color: #fff !important; }

          a {
            color: inherit !important;
            text-decoration: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function ReportField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`report-field-card ${className}`}>
      <span className="report-field-label">{label}</span>
          <strong className="report-field-value">{value.trim()}</strong>
    </div>
  );
}

function PanelRows({ tests }: { tests: LabOrder["tests"] }) {
  const sections = new Map<string, LabOrder["tests"]>();
  for (const test of tests) {
    const section = test.subcategory ?? "";
    sections.set(section, [...(sections.get(section) ?? []), test]);
  }

  return (
    <>
      {[...sections.entries()].flatMap(([section, sectionTests]) => [
        ...(section ? [<tr key={section}><td colSpan={5} className="report-subsection-row">{section}</td></tr>] : []),
        ...sectionTests.map((test, index) => (
          <tr key={`${test.code}-${index}`}>
            <td className="report-checkbox-cell"><span className={test.result?.trim() || test.status === "Completed" ? "report-checked-box" : ""} aria-hidden="true" /></td>
            <td className="report-test-name-cell">
              <span className="block">{test.name?.trim()}</span>
            </td>
            <td>{test.unit?.trim()}</td>
            <td>{test.result?.trim()}</td>
            <td>{hasSourceReference(test.sourceReference) ? test.sourceReference.trim() : ""}</td>
          </tr>
        )),
      ])}
    </>
  );
}
