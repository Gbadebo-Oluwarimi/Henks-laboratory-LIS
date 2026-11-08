import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";

import { getDatabase } from "@/lib/mongodb";
import type { LabOrder, UserRecord } from "@/lib/models";
import { displayPanelName, hasSourceReference } from "@/lib/catalogue";
import { formatDate } from "@/lib/presentation";
import { getAuthorizerSignature } from "@/lib/signature";
import { PrintButton } from "@/app/(workspace)/reports/[id]/print-button";
import { ReportSheetScaler } from "@/app/(workspace)/reports/[id]/report-sheet-scaler";
import { labBranding } from "@/lib/branding";

const BRAND = {
  navy: "#073F9F",
  red: "#FE1625",
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

  const authorizer = !order.authorizedByRole && order.authorizedBy && ObjectId.isValid(order.authorizedBy)
    ? (await database.collection<UserRecord>("users").findOne(
        { _id: new ObjectId(order.authorizedBy) },
        { projection: { role: 1 } },
      ))
    : null;
  const authorizerRole = order.authorizedByRole ?? authorizer?.role;
  const isFinal =
    order.status === "Completed" &&
    order.tests.length > 0 &&
    order.tests.every((test) => test.status === "Completed") &&
    Boolean(order.authorizedBy && order.authorizedByName && order.authorizedAt);

  const authorizerSignature = isFinal
    ? getAuthorizerSignature(order.authorizedByName ?? "", authorizerRole)
    : null;

  const specimenTypes = [
    ...new Set(
      order.tests.flatMap((test) =>
        test.specimenType?.trim() ? [test.specimenType.trim()] : []
      )
    ),
  ];

  const panels = [
    ...new Set(order.tests.map((test) => test.panel || "Other tests")),
  ];
  // Final reports use the authorisation date so the printed date doesn't
  // change every time the page is opened. Drafts use "now".
  const localOrderDate = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Lagos",
  }).format(order.createdAt);
  const reportDetails = order.reportDetails ?? {
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
    filmReport: "",
    filmRBCs: "",
    filmWBCs: "",
    filmPlatelets: "",
    filmMalaria: "",
  };
  const displayDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeZone: "Africa/Lagos" })
    .format(new Date(`${reportDetails.date}T00:00:00.000Z`));
  const pageTwoPanel = (panel: string) => /full blood|fbc|mcs|widal|malaria|coagulation|tumou?r marker|blood group|genotype|swab|sputum|stool|semen|other investigations/i.test(panel);
  const pageOnePanels = panels.filter((panel) => !pageTwoPanel(panel));
  const pageOneSidePanels = pageOnePanels.filter((panel) => /glucose tolerance|serology|urinalysis|csf|hbs|hcv|hiv|pregnancy|hsv|vdrl/i.test(panel));
  const pageOneMainPanels = pageOnePanels.filter((panel) => !pageOneSidePanels.includes(panel));
  const pageTwoPanels = panels.filter(pageTwoPanel);
  const renderPanel = (panel: string) => {
    const panelTests = order.tests.filter((test) => (test.panel || "Other tests") === panel);
    const panelDepartments = [...new Set(
      panelTests.map((test) => test.departmentName?.trim()).filter((department): department is string => Boolean(department)),
    )];
    return <section className="report-test-section" key={panel}>
      <header className="report-title-block" aria-label={`${panel} report title`}>
        <p>{panelDepartments.join(" · ") || "Laboratory"}</p>
          <h2>{displayPanelName(panel)}</h2>
      </header>
      <p className="report-mark-instruction">Please mark the box beside each investigation performed.</p>
      <div className="report-results"><table className="report-table">
        <colgroup><col style={{ width: "5%" }} /><col style={{ width: "31%" }} /><col style={{ width: "21%" }} /><col style={{ width: "16%" }} /><col style={{ width: "27%" }} /></colgroup>
        <thead><tr><th aria-label="Selected"></th><th className="gellix-heading">Tests</th><th className="gellix-heading">Result</th><th className="gellix-heading">Unit</th><th className="gellix-heading">Reference range</th></tr></thead>
        <tbody><PanelRows tests={panelTests} /></tbody>
      </table></div>
    </section>;
  };

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
        <section className="report-paper-page report-page-one">
          <header className="report-official-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="report-seal-logo" src="/henks-report-seal.png" alt="Henks laboratory seal" />
            <div className="report-official-copy">
              <h1>{BRAND.name}</h1>
              <p>{BRAND.address}</p>
              <p>{BRAND.phones.join(" · ")}</p>
              <p>{BRAND.emails.map((email) => <a key={email} href={`mailto:${email}`}>{email}</a>)}</p>
              <h2>LABORATORY REPORT FORM</h2>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="report-emblem-logo" src="/henks-report-emblem.png" alt="Henks laboratory emblem" />
          </header>

          <section className="report-patient-details" aria-label="Patient information">
            <div className="report-patient-grid">
              <ReportField label="SURNAME:" value={reportDetails.surname} className="report-field-surname" />
              <ReportField label="LABORATORY NO.:" value={reportDetails.laboratoryNo} className="report-field-lab-number" />
              <ReportField label="DATE:" value={displayDate} className="report-field-date" />
              <ReportField label="HOSPITAL NO.:" value={reportDetails.hospitalNo} className="report-field-hospital" />
              <ReportField label="OTHER NAMES:" value={reportDetails.otherNames} className="report-field-other-names" />
              <ReportField label="AGE:" value={reportDetails.age ? `${reportDetails.age} ${reportDetails.ageUnit}` : ""} className="report-field-age" />
              <ReportField label="SEX:" value={reportDetails.sex} className="report-field-sex" />
              <ReportField label="REQUESTED TEST:" value={[...new Set(order.tests.map((test) => displayPanelName(test.panel)))].join(", ")} className="report-field-requested" />
              <ReportField label="SPECIMEN:" value={reportDetails.specimen || specimenTypes.join(", ")} className="report-field-specimen" />
            </div>
          </section>

          <div className="report-page-one-content">
            <div className="report-main-investigations">{pageOneMainPanels.map(renderPanel)}</div>
            <aside className="report-side-investigations" aria-label="Additional investigations">
              {pageOneSidePanels.length ? pageOneSidePanels.map(renderPanel) : <>
                <h2>GLUCOSE TOLERANCE TEST</h2>
                <table className="report-grid-table"><thead><tr><th>TIME (MINS)</th><th>0</th><th>30</th><th>60</th><th>120</th></tr></thead><tbody><tr><th>Blood (mmol/L)</th><td /><td /><td /><td /></tr><tr><th>Urine</th><td /><td /><td /><td /></tr></tbody></table>
                <h2>SEROLOGY</h2><ul className="report-check-list">{["Pregnancy Test", "HBs Ag", "HBc Ag", "HBe Ag", "HCV", "Others"].map((label) => <li key={label}><span className="report-empty-check" />{label}<span className="report-fill-line" /></li>)}</ul>
                <h2>URINALYSIS</h2><div className="report-urinalysis-grid">{["Appearance", "Glucose", "Protein", "Ketones", "Nitrites", "Bilirubin", "Urobilinogen", "Blood", "Ascorbic acid", "Leucocytes", "pH", "Sp. gravity"].map((label) => <div key={label}>{label}</div>)}</div>
              </>}
              <h2>COMMENT</h2><div className="report-comment-lines">{reportDetails.generalComment || ""}</div>
            </aside>
          </div>
          <footer className="report-footer"><span>{order.clientSnapshot.fullName}</span><span>Laboratory No. {reportDetails.laboratoryNo}</span><span>Page 1 of 2</span></footer>
        </section>

        <section className="report-paper-page report-page-two">
          <div className="report-page-two-ident"><strong>{reportDetails.surname} {reportDetails.otherNames}</strong><span>Laboratory No. {reportDetails.laboratoryNo}</span></div>
          <div className="report-page-two-grid">
            <div className="report-page-two-main">
              {pageTwoPanels.map(renderPanel)}
              <section className="report-page-two-extra">
                <h2>GENERAL COMMENT</h2><div className="report-general-comment">{reportDetails.generalComment}</div>
              </section>
            </div>
            <aside className="report-film-column">
              <h2>FILM REPORT &amp; COMMENT</h2>
              <div className="report-film-content">
                {[['RBCs', reportDetails.filmRBCs], ['WBCs', reportDetails.filmWBCs], ['PLATELETS', reportDetails.filmPlatelets], ['MALARIA', reportDetails.filmMalaria]].map(([label, result]) => <section className="report-film-finding" key={label}><strong>{label}</strong><p>{result || ""}</p></section>)}
                {reportDetails.filmReport && <p className="report-film-comment">{reportDetails.filmReport}</p>}
              </div>
              {isFinal ? <section className="report-authorisation">
                <p>MEDICAL LABORATORY SCIENTIST SIGN / DATE</p>
                {authorizerSignature && <img src={authorizerSignature} alt={`${order.authorizedByName}'s signature`} />}
                <div className="report-signature-line" />
                <strong>{order.authorizedByName}</strong>
                <span>{order.authorizedAt ? formatDate(order.authorizedAt) : ""}</span>
              </section> : <div className="report-draft-note">DRAFT — NOT AUTHORIZED FOR RELEASE</div>}
            </aside>
          </div>
          <footer className="report-footer"><span>{order.clientSnapshot.fullName}</span><span>Accession {order.accessionId}</span><span>Page 2 of 2 · {isFinal ? "Authorized" : "Draft"}</span></footer>
        </section>
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
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 5mm;
        }

        .report-brand { flex: 1 1 58%; min-width: 0; }
        .report-header > div:last-child { flex: 0 0 40%; min-width: 0; }

        .report-brand h2 { font-size: 20px; }

        .report-brand-divider { display: flex; height: 2mm; width: 100%; }
        .report-brand-divider span:nth-child(1) { flex: 0 0 78%; background: ${BRAND.navy}; }
        .report-brand-divider span:nth-child(2) { flex: 1; background: ${BRAND.red}; }
        .report-header-image { display: block; width: 100%; max-height: 38mm; object-fit: contain; object-position: left center; }
        .report-form-title { background: ${BRAND.red}; color: #fff; }
        .report-contact { color: ${BRAND.navy}; }

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
        .report-table th:nth-child(2), .report-table td:nth-child(2) { width: 31% !important; }
        .report-table th:nth-child(3), .report-table td:nth-child(3) { width: 21% !important; }
        .report-table th:nth-child(4), .report-table td:nth-child(4) { width: 16% !important; }
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

        .report-signature-line {
          width: 70mm;
          max-width: 70mm;
        }

        .report-authorisation { margin-top: auto !important; padding-top: 10mm; }
        .report-authorisation > p:first-child { margin: 0 0 1mm; }
        .report-footer { display: flex; justify-content: space-between; gap: 4mm; margin-top: 5mm; border-top: 1px solid ${BRAND.navy}; padding-top: 2mm; color: #475569; font-size: 8px; }
        .report-comments { display: grid; gap: 3mm; margin-top: 5mm; font-size: 9px; }
        .report-comments strong { color: ${BRAND.navy}; }
        .report-comments div { height: 5mm; border-bottom: 1px dotted #657080; }

        .report-sheet { display: block; min-height: 0; padding: 0; overflow: visible; text-transform: none; }
        .report-paper-page { box-sizing: border-box; position: relative; width: 210mm; min-height: 297mm; padding: 8mm 9mm 10mm; margin: 0; background: #fff; color: #111; overflow: visible; font: 8px Arial, Helvetica, sans-serif; text-transform: none; }
        .report-paper-page + .report-paper-page { border-top: 1px solid #c4c9d0; }
        .report-official-header { display: grid; grid-template-columns: 26mm minmax(0, 1fr) 26mm; align-items: center; gap: 3mm; padding-bottom: 3mm; border-bottom: 2px solid #26364d; text-align: center; }
        .report-seal-logo, .report-emblem-logo { display: block; width: 25mm; height: 25mm; object-fit: contain; }
        .report-official-copy h1 { margin: 0; color: #7e353d; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 800; letter-spacing: .025em; }
        .report-official-copy p { margin: 1mm 0 0; color: #3d4758; font-size: 8px; line-height: 1.35; }
        .report-official-copy p a { margin-inline: 1mm; }
        .report-official-copy h2 { display: inline-block; margin: 2mm 0 0; color: #7e353d; font-size: 13px; font-weight: 800; }
        .report-patient-details { margin-top: 3mm; border: 0; padding: 0; }
        .report-patient-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0; border-left: 1px solid #657080; border-top: 1px solid #657080; }
        .report-field-card { min-height: 8mm; display: flex; align-items: center; gap: 2mm; border: 0; border-right: 1px solid #657080; border-bottom: 1px solid #657080; padding: 1mm 1.5mm; }
        .report-field-label { flex: 0 0 auto; color: #4b5563; font: 700 7.5px Arial, sans-serif; }
        .report-field-value { color: #171717; font: 600 8px Arial, sans-serif; }
        .report-field-surname { grid-column: span 6; }
        .report-field-lab-number { grid-column: span 3; }
        .report-field-date { grid-column: span 3; }
        .report-field-hospital { grid-column: span 3; }
        .report-field-other-names { grid-column: span 5; }
        .report-field-age { grid-column: span 2; }
        .report-field-sex { grid-column: span 2; }
        .report-field-requested { grid-column: span 9; }
        .report-field-specimen { grid-column: span 3; }
        .report-page-one-content { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(55mm, 1fr); gap: 4mm; margin-top: 2mm; align-items: start; }
        .report-main-investigations, .report-side-investigations, .report-page-two-main, .report-film-column { min-width: 0; }
        .report-side-investigations { border: 1px solid #7b8492; padding: 2mm; }
        .report-side-investigations > h2, .report-page-two-extra > h2, .report-film-column > h2 { margin: 1mm 0 2mm; color: #3e4652; font-size: 9px; font-weight: 700; text-align: center; }
        .report-side-investigations > p { margin: 1.5mm 0; font-size: 7.5px; }
        .report-title-block { margin: 1mm 0 0; padding: 1mm 0; text-align: center; color: #222; }
        .report-title-block p { margin: 0; font-size: 7px; font-weight: 700; text-transform: uppercase; }
        .report-title-block h2 { margin: .5mm 0 0; font-size: 8px; font-weight: 700; text-transform: uppercase; }
        .report-mark-instruction { margin: 0 0 1mm; color: #454b55; font-size: 6.5px; }
        .report-results { width: 100%; margin: 0; overflow: visible; }
        .report-table { width: 100%; min-width: 0; max-width: 100%; border-collapse: collapse; table-layout: fixed; font: 7px Arial, sans-serif; line-height: 1.15; }
        .report-table th, .report-table td { border: 1px solid #4c5563; padding: .9mm 1mm; color: #171717; background: #fff; vertical-align: top; overflow-wrap: anywhere; }
        .report-table th { background: #626a76; color: #fff; font-size: 7px; font-weight: 700; text-transform: uppercase; }
        .report-table th:nth-child(1), .report-table td:nth-child(1) { width: 5% !important; }
        .report-table th:nth-child(2), .report-table td:nth-child(2) { width: 31% !important; }
        .report-table th:nth-child(3), .report-table td:nth-child(3) { width: 21% !important; }
        .report-table th:nth-child(4), .report-table td:nth-child(4) { width: 16% !important; }
        .report-table th:nth-child(5), .report-table td:nth-child(5) { width: 27% !important; }
        .report-subsection-row { background: #f1f3f5 !important; color: #222 !important; font-weight: 700; }
        .report-checkbox-cell { padding: .6mm !important; text-align: center !important; }
        .report-checkbox-cell span, .report-empty-check { display: inline-block; width: 2.8mm; height: 2.8mm; border: 1px solid #333; vertical-align: middle; }
        .report-checkbox-cell span::after { content: '✓'; position: relative; top: -1px; color: #111; font-size: 8px; font-weight: 700; }
        .report-grid-table { width: 100%; border-collapse: collapse; font-size: 6.5px; }
        .report-grid-table th, .report-grid-table td { height: 6mm; border: 1px solid #657080; padding: .7mm; }
        .report-grid-table th { text-align: left; }
        .report-check-list { margin: 0 0 2mm; padding: 0; list-style: none; }
        .report-check-list li { display: flex; align-items: center; gap: 1.5mm; min-height: 5mm; font-size: 7px; }
        .report-fill-line { flex: 1; height: 3mm; border-bottom: 1px dotted #737b87; }
        .report-urinalysis-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #69717c; border-left: 1px solid #69717c; }
        .report-urinalysis-grid div { min-height: 12mm; border-right: 1px solid #69717c; border-bottom: 1px solid #69717c; padding: 1mm; font-size: 6px; }
        .report-comment-lines, .report-general-comment { min-height: 12mm; border-bottom: 1px dotted #657080; padding: 1mm; white-space: pre-wrap; overflow-wrap: anywhere; }
        .report-page-two-ident { display: flex; justify-content: space-between; border-bottom: 1px solid #657080; margin-bottom: 2mm; padding-bottom: 1mm; font-size: 8px; }
        .report-page-two-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(50mm, 1fr); gap: 4mm; align-items: stretch; }
        .report-page-two-extra { margin-top: 2mm; }
        .report-page-two-extra .report-table th, .report-page-two-extra .report-table td { width: auto !important; }
        .report-investigation-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 2mm; }
        .report-investigation-list > div { display: flex; align-items: center; gap: 1.2mm; min-height: 4mm; font-size: 6px; }
        .report-investigation-list .report-empty-check { flex: 0 0 2.5mm; width: 2.5mm; height: 2.5mm; }
        .report-film-column { min-height: 218mm; display: flex; flex-direction: column; border: 1px solid #657080; padding: 2mm; }
        .report-film-content { flex: 1; min-height: 135mm; padding: 2mm; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 8px; }
        .report-authorisation { display: grid; justify-items: start; gap: 1.5mm; margin-top: auto !important; padding: 2mm 0 0; font-size: 7px; }
        .report-authorisation > p { margin: 0; color: #323b49; font-size: 7px; font-weight: 700; }
        .report-authorisation img { width: 48mm; height: 22mm; object-fit: contain; object-position: left; }
        .report-signature-line { width: 55mm; height: 5mm; border-bottom: 1px solid #333; }
        .report-draft-note { margin-top: auto; border: 1px solid #8a6b41; padding: 2mm; color: #6b4b1f; font-size: 7px; }
        .report-footer { display: flex; justify-content: space-between; gap: 2mm; margin-top: auto; border-top: 1px solid #657080; padding-top: 1.5mm; color: #555; font-size: 6px; }
        .report-paper-page { display: flex; flex-direction: column; }
        .report-paper-page + .report-paper-page { margin-top: 0; }

        @media print {
          .report-paper-page { min-height: 297mm; height: 297mm; page-break-after: always; break-after: page; margin: 0; overflow: hidden; }
          .report-paper-page + .report-paper-page { border-top: 0; margin-top: 0; }
          .report-page-one-content { grid-template-columns: minmax(0, 1.75fr) minmax(55mm, 1fr); }
          .report-page-two-grid { grid-template-columns: minmax(0, 1.55fr) minmax(50mm, 1fr); }
        }

        .report-header,
        .report-patient-details,
        .report-authorisation,
        .report-footer {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide the app shell (sidebar, nav, etc.) but show the sheet */
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
            width: 210mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .report-sheet-viewport {
            width: auto !important;
            max-width: none !important;
            height: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          /* Taking the sheet out of flow stops the hidden app shell from
             pushing it down and creating blank pages */
          .report-sheet {
            position: absolute !important;
            isolation: isolate;
            top: 0;
            left: 0;
            width: 210mm !important;
            max-width: none !important;
            min-height: 297mm;
            margin: 0 !important;
            padding: 10mm !important;
            border: none !important;
            border-top: 1.5px solid #202020 !important;
            box-shadow: none !important;
            background: #fff !important;
            overflow: visible !important;
            transform: none !important;
            margin-left: 0 !important;
          }

          .report-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
          }

          .report-brand { flex: 1 1 58% !important; min-width: 0 !important; }
          .report-header > div:last-child { flex: 0 0 40% !important; min-width: 0 !important; }

          .report-patient-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            row-gap: 6px !important;
          }

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
          <strong className="report-field-value">{value.trim() || "-"}</strong>
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
            <td className="report-checkbox-cell"><span aria-hidden="true" /></td>
            <td className="report-test-name-cell">
              <span className="block">{test.name?.trim() || "-"}</span>
            </td>
            <td>{test.result?.trim() || "-"}</td>
            <td>{test.unit?.trim() || "-"}</td>
            <td>{hasSourceReference(test.sourceReference) ? test.sourceReference.trim() : "-"}</td>
          </tr>
        )),
      ])}
    </>
  );
}
