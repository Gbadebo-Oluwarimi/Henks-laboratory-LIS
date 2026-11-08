import Link from"next/link";
import { notFound } from"next/navigation";
import {
  ArrowLeft,
  Beaker,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Send,
  ShieldCheck,
  UserRound,
} from"lucide-react";

import { updateOrderTests, updateReportDetails } from"@/app/actions";
import { getDatabase } from"@/lib/mongodb";
import type { LabOrder, ReagentLotRecord, ReagentRecord, ReagentStockMovementRecord, SpecimenRecord } from"@/lib/models";
import { displayPanelName, hasSourceReference } from"@/lib/catalogue";
import { ageFromDateOfBirth, formatDate, pageError, splitPatientName, statusClass } from"@/lib/presentation";
import { canAuthorizeReports, getCurrentUser } from"@/lib/session";
import { ToastNotification } from"@/app/(workspace)/toast-notification";
import { DeleteOrderButton } from "@/app/(workspace)/orders/delete-order-button";
import { DeleteApprovedTestButton } from "@/app/(workspace)/orders/delete-approved-test-button";
import { beginReportAmendment } from "@/app/(workspace)/orders/amendment-actions";

export default async function OrderDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { ObjectId } = await import("mongodb");
  if (!ObjectId.isValid(id)) notFound();

  const database = await getDatabase();
  const [order, user] = await Promise.all([
    database.collection<LabOrder>("labOrders").findOne({ _id: new ObjectId(id) }),
    getCurrentUser(),
  ]);
  if (!order) notFound();

  const linkedSpecimens = order.specimenIds?.length
    ? await database.collection<SpecimenRecord>("specimens").find({ _id: { $in: order.specimenIds } }).sort({ createdAt: 1 }).toArray()
    : [];
  const rejectedTestCodes = new Set(linkedSpecimens.filter((specimen) => specimen.status === "REJECTED").flatMap((specimen) => specimen.testCodes));

  const reagentMovements = await database.collection<ReagentStockMovementRecord>("reagentStockMovements")
    .find({ referenceType: "labOrderTest", referenceId: id })
    .sort({ performedAt: -1 })
    .toArray();
  const reagentLotIds = [...new Map(reagentMovements.map((movement) => [movement.lotId.toHexString(), movement.lotId])).values()];
  const [reagentLots, reagentProducts] = await Promise.all([
    reagentLotIds.length ? database.collection<ReagentLotRecord>("reagentLots").find({ _id: { $in: reagentLotIds } }).toArray() : [],
    reagentMovements.length ? database.collection<ReagentRecord>("reagents").find({ _id: { $in: [...new Map(reagentMovements.map((movement) => [movement.reagentId.toHexString(), movement.reagentId])).values()] } }).toArray() : [],
  ]);
  const reagentLotById = new Map(reagentLots.map((lot) => [lot._id.toHexString(), lot]));
  const reagentById = new Map(reagentProducts.map((reagent) => [reagent._id.toHexString(), reagent]));

  const error = pageError(Array.isArray(query.error) ? query.error[0] : query.error);
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const noticeMessage = notice ==="created"
    ? `Lab order ${order.accessionId} created successfully.`
    : notice ==="submitAll"
      ?"All eligible results were sent for review."
      : notice ==="completeAll"
        ?"All results awaiting review have been approved."
        : notice ==="saveAll"
          ?"Draft results saved."
          : notice === "test-deleted"
            ? "Approved test removed from this order."
          : notice === "amendment-started"
            ? "Amendment started. Submit the corrected result for review and authorization."
          : notice
            ?"Test action saved successfully."
            : null;
  const groups = new Map<string, LabOrder["tests"]>();
  for (const test of order.tests) groups.set(test.panel, [...(groups.get(test.panel) ?? []), test]);

  const canEnterResults = user?.role ==="Administrator" || user?.role ==="Laboratory Staff";
  const canReview = canAuthorizeReports(user);
  const canDeleteApprovedTests = user?.role === "Administrator" && !order.authorizedAt && !order.specimenIds?.length;
  const totalTests = order.tests.length;
  const completedTests = order.tests.filter((test) => test.status ==="Completed").length;
  const awaitingReview = order.tests.filter((test) => test.status ==="Awaiting Review").length;
  const enteredTests = order.tests.filter((test) => Boolean(test.result?.trim())).length;
  const editableTests = order.tests.filter((test) => test.status ==="Pending" || test.status ==="In Progress");
  const savedReportDetails = order.reportDetails ?? {
    surname: "",
    otherNames: order.clientSnapshot.fullName,
    laboratoryNo: order.accessionId,
    hospitalNo: "",
    age: "",
    ageUnit: "years" as const,
    sex: order.clientSnapshot.sex ?? "" as const,
    date: new Date(order.createdAt).toISOString().slice(0, 10),
    requestedTest: [...new Set(order.tests.map((test) => displayPanelName(test.panel)))].join(", "),
    specimen: [...new Set(order.tests.map((test) => test.specimenType).filter(Boolean))].join(", "),
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
  const canEditReportDetails = !order.authorizedAt && ["Administrator", "Reception", "Laboratory Staff"].includes(user?.role ?? "");

  return (
    <main className="lis-workspace">
      <div className="lis-back-row">
        <Link href="/orders" className="lis-back-link"><ArrowLeft size={15} />Back to orders</Link>
      </div>

      <header className="lis-page-heading">
        <div className="lis-heading-copy">
          <div className="lis-eyebrow"><FlaskConical size={15} />LABORATORY WORKSPACE<span>/</span>{order.accessionId}</div>
          <h1>Order details</h1>
          <p>Enter, verify and review laboratory test results.</p>
        </div>
        <div className="lis-heading-actions">
          <span className={statusClass(order.status)}>{order.status}</span>
          <Link href={`/reports/${id}`} className="lis-button lis-button-secondary"><FileText size={15} />Report preview</Link>
          {user?.role === "Administrator" && <DeleteOrderButton orderId={id} accessionId={order.accessionId} patientName={order.clientSnapshot.fullName} />}
        </div>
      </header>

      {error && <div className="lis-alert lis-alert-error" role="alert"><span>{error}</span></div>}
      {noticeMessage && <ToastNotification message={noticeMessage} />}

      <section className="lis-patient-card">
        <div className="lis-patient-identity">
          <div className="lis-patient-avatar"><UserRound size={23} /></div>
          <div><span className="lis-field-label">PATIENT NAME</span><h2>{order.clientSnapshot.fullName}</h2><p>Patient ID: {order.clientSnapshot.patientId}</p></div>
        </div>
        <div className="lis-patient-meta">
          <div><span className="lis-field-label">ACCESSION NUMBER</span><strong>{order.accessionId}</strong></div>
          <div><span className="lis-field-label">DATE CREATED</span><strong>{formatDate(order.createdAt)}</strong></div>
        </div>
        <div className="lis-patient-security"><ShieldCheck size={16} />Authorized laboratory workspace</div>
      </section>

      {order.priceSnapshots && order.priceSnapshots.length > 0 && <section className="lis-patient-card" aria-label="Order price snapshot">
        <div className="min-w-0 flex-1"><span className="lis-field-label">ORDER PRICE SNAPSHOT</span>
          <div className="mt-2 space-y-1">{order.priceSnapshots.map((price) => <p className="text-sm text-slate-700" key={price.panel}>{price.panel}: {price.amountMinor === undefined ? <span className="text-amber-700">Price not configured when ordered</span> : new Intl.NumberFormat("en-NG", { style: "currency", currency: price.currency }).format(price.amountMinor / 100)}</p>)}</div>
          {order.priceSnapshots.every((price) => price.amountMinor !== undefined) && <p className="mt-2 text-sm font-semibold text-[#073F9F]">Total: {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(order.priceSnapshots.reduce((sum, price) => sum + (price.amountMinor ?? 0), 0) / 100)}</p>}
        </div>
      </section>}

      {linkedSpecimens.length > 0 && <section className="lis-patient-card" aria-label="Order specimens"><div className="min-w-0 flex-1"><span className="lis-field-label">SPECIMENS</span>{rejectedTestCodes.size > 0 && <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">Tests linked to a rejected specimen cannot be completed.</p>}<div className="mt-2 grid gap-2 sm:grid-cols-2">{linkedSpecimens.map((specimen) => <div key={specimen._id.toHexString()} className="border border-slate-200 bg-white p-3"><p className="font-mono text-xs font-semibold text-slate-800">{specimen.specimenId} · {specimen.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-600">{specimen.specimenType} · {specimen.testCodes.length} linked tests</p><Link href={`/specimens/${specimen._id.toHexString()}/label`} className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline">Print specimen label</Link></div>)}</div></div></section>}

      <section className="lis-panel-card" aria-labelledby="report-patient-fields-title">
        <div className="lis-panel-heading"><div><h3 id="report-patient-fields-title">Laboratory report form details</h3><p>These saved fields appear in the matching positions on the printed report.</p></div></div>
        {canEditReportDetails ? <form action={updateReportDetails} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="orderId" value={id} />
          {[
            ["Surname", "surname", reportDetails.surname],
            ["Other names", "otherNames", reportDetails.otherNames],
            ["Laboratory No.", "laboratoryNo", reportDetails.laboratoryNo],
            ["Hospital No.", "hospitalNo", reportDetails.hospitalNo],
          ].map(([label, name, value]) => <label key={name} className="grid gap-1 text-xs font-medium text-slate-600">{label}<input name={name} maxLength={120} required={name === "laboratoryNo"} defaultValue={value} className="h-9 min-w-0 border border-slate-200 px-2 text-sm text-slate-800" /></label>)}
          <label className="grid gap-1 text-xs font-medium text-slate-600">Age<input name="age" type="number" min="0" max="999" step="any" defaultValue={reportDetails.age} className="h-9 min-w-0 border border-slate-200 px-2 text-sm text-slate-800" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Age unit<select name="ageUnit" defaultValue={reportDetails.ageUnit} className="h-9 border border-slate-200 px-2 text-sm text-slate-800"><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Sex<select name="sex" defaultValue={reportDetails.sex} className="h-9 border border-slate-200 px-2 text-sm text-slate-800"><option value="">Not recorded</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option></select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Date<input name="reportDate" type="date" required defaultValue={reportDetails.date} className="h-9 border border-slate-200 px-2 text-sm text-slate-800" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">Requested test<input readOnly value={[...new Set(order.tests.map((test) => displayPanelName(test.panel)))].join(", ")} className="h-9 min-w-0 border border-slate-200 bg-slate-50 px-2 text-sm text-slate-600" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">Specimen<input name="reportSpecimen" maxLength={160} defaultValue={reportDetails.specimen} className="h-9 min-w-0 border border-slate-200 px-2 text-sm text-slate-800" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">General comment<textarea name="generalComment" maxLength={2000} rows={3} defaultValue={reportDetails.generalComment} className="min-w-0 border border-slate-200 p-2 text-sm text-slate-800" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">Doctor's comment<textarea name="doctorComment" maxLength={2000} rows={3} defaultValue={reportDetails.doctorComment || ""} className="min-w-0 border border-slate-200 p-2 text-sm text-slate-800" /></label>
          <div className="sm:col-span-2 lg:col-span-4"><button type="submit" className="lis-button lis-button-submit">Save report details</button></div>
        </form> : <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs"><p><b>Surname:</b> {reportDetails.surname || "—"}</p><p><b>Other names:</b> {reportDetails.otherNames || "—"}</p><p><b>Laboratory No.:</b> {reportDetails.laboratoryNo}</p><p><b>Hospital No.:</b> {reportDetails.hospitalNo || "—"}</p><p><b>Age:</b> {reportDetails.age ? `${reportDetails.age} ${reportDetails.ageUnit}` : "—"}</p><p><b>Sex:</b> {reportDetails.sex || "—"}</p><p><b>Date:</b> {reportDetails.date}</p><p><b>Requested test:</b> {reportDetails.requestedTest}</p><p className="sm:col-span-2"><b>Specimen:</b> {reportDetails.specimen || "—"}</p></div>}
      </section>

      {order.reportVersions && order.reportVersions.length > 0 && <section className="lis-panel-card" style={{ marginTop: 20, padding: 20 }}>
        <div className="lis-panel-heading"><div><h3>Report release history</h3><p>The report preview and PDF show the latest order changes.</p></div></div>
        <ol className="mt-3 space-y-2">{[...order.reportVersions].reverse().map((release) => <li key={`${release.version}-${release.releasedAt.toISOString()}`} className="border-t border-slate-100 py-2 text-xs">Released {formatDate(release.releasedAt)} by {release.releasedByName}{release.amendmentReason ? ` · Amendment: ${release.amendmentReason}` : ""}</li>)}</ol>
        {order.pendingAmendment && <p className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Amendment in progress: {order.pendingAmendment.reason}. The report preview shows the current amended results as a draft until they are reviewed.</p>}
      </section>}

      <section className="lis-stats-grid" aria-label="Order summary">
        <article className="lis-stat-card"><span className="lis-stat-icon"><FlaskConical size={18} /></span><div><span className="lis-field-label">TOTAL TESTS</span><strong>{totalTests}</strong></div></article>
        <article className="lis-stat-card"><span className="lis-stat-icon lis-stat-icon-blue"><FileText size={18} /></span><div><span className="lis-field-label">RESULTS ENTERED</span><strong>{enteredTests}</strong></div></article>
        <article className="lis-stat-card"><span className="lis-stat-icon lis-stat-icon-amber"><ClipboardCheck size={18} /></span><div><span className="lis-field-label">AWAITING REVIEW</span><strong>{awaitingReview}</strong></div></article>
        <article className="lis-stat-card"><span className="lis-stat-icon lis-stat-icon-green"><ShieldCheck size={18} /></span><div><span className="lis-field-label">COMPLETED</span><strong>{completedTests}</strong></div></article>
      </section>

      <div className="lis-section-heading">
        <div><h2>Ordered investigations</h2><p>Enter results in the matching report fields. Blank result cells remain blank on the printed form.</p></div>
        <span className="lis-test-count">{totalTests} {totalTests === 1 ?"test" :"tests"}</span>
      </div>

      {canEnterResults && (
        <>
          <form id="order-results-form" action={updateOrderTests}>
            <input type="hidden" name="orderId" value={id} />
          </form>
          {[...groups.entries()].map(([panel, tests]) => {
            const sections = new Map<string, typeof tests>();
            for (const test of tests) {
              const section = test.subcategory ?? "";
              sections.set(section, [...(sections.get(section) ?? []), test]);
            }
            const rows = [...sections.entries()].flatMap(([section, sectionTests]) => [
              ...(section ? [<tr key={`section-${section}`}><th colSpan={canDeleteApprovedTests ? 8 : 7} className="bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600">{section}</th></tr>] : []),
              ...sectionTests.map((test) => {
                const editable = test.status === "Pending" || test.status === "In Progress";
                return <tr key={test.code}>
                  <td><input type="checkbox" checked disabled aria-label={`${test.name} selected for this report`} /></td>
                  <td><div className="lis-test-name">{test.name}</div><span className="lis-test-code">{test.code}</span></td>
                  <td>{editable ?
                    <textarea className="lis-result-input" form="order-results-form" name={`result_${test.code}`} defaultValue={test.result} rows={test.kind === "narrative" ? 3 : 1} maxLength={3000} aria-label={`${test.name} result`} /> :
                    <span className="lis-result-value">{test.result || "Not entered"}</span>}</td>
                  <td>{test.specimenType || "—"}{editable && <input form="order-results-form" type="hidden" name={`specimen_${test.code}`} value={test.specimenType ?? ""} />}</td>
                  <td>{editable ? <input className="lis-result-input w-24" form="order-results-form" name={`unit_${test.code}`} defaultValue={test.unit} maxLength={60} aria-label={`${test.name} unit`} /> : (test.unit || "—")}</td>
                  <td>{editable ? <textarea className="lis-result-input min-w-36" form="order-results-form" name={`reference_${test.code}`} defaultValue={test.sourceReference} rows={2} maxLength={240} aria-label={`${test.name} reference range`} /> : (hasSourceReference(test.sourceReference) ? test.sourceReference.trim() : "Not configured")}</td>
                  <td><span className={statusClass(test.status)}>{test.status}</span></td>
                  {canDeleteApprovedTests && <td>{test.status === "Completed" ? <DeleteApprovedTestButton orderId={id} testCode={test.code} testName={test.name} /> : <span className="text-slate-300">—</span>}</td>}
                </tr>;
              }),
            ]);
            return <section className="lis-panel-card" key={panel}>
              <div className="lis-panel-heading"><div><h3>{displayPanelName(panel)}</h3><p>{tests.length} result {tests.length === 1 ? "field" : "fields"}</p>{tests[0]?.departmentName && <p className="text-[10px] font-medium text-blue-700">Performing department · {tests[0].departmentName}</p>}</div></div>
              {panel === "Widal" ? <div className="lis-table-wrap"><table className="lis-results-table">
                <thead><tr><th colSpan={2}>ANTIGEN</th><th colSpan={2}>ANTIGEN</th></tr></thead>
                <tbody>{[
                  ["S. typhi O", "S. typhi H"],
                  ["S. paratyphi A O (AO)", "S. paratyphi A H (AH)"],
                  ["S. paratyphi B O (BO)", "S. paratyphi B H (BH)"],
                  ["S. paratyphi C O (CO)", "S. paratyphi C H (CH)"],
                ].map((pair) => <tr key={pair[0]}>{pair.map((name) => {
                  const test = tests.find((item) => item.name === name || (name === "S. paratyphi A H (AH)" && item.name === "S. paratyphi A (AH)") || (name === "S. paratyphi B H (BH)" && item.name === "S. paratyphi B (BH)"));
                  return [
                    <th key={`${name}-label`} scope="row" className="whitespace-nowrap">{name}</th>,
                    <td key={`${name}-result`}>{test && (test.status === "Pending" || test.status === "In Progress") ?
                      <textarea className="lis-result-input min-w-20" form="order-results-form" name={`result_${test.code}`} defaultValue={test.result} rows={1} maxLength={3000} aria-label={`${test.name} result`} /> :
                      <span className="lis-result-value">{test?.result || "Not entered"}</span>}
                    </td>,
                  ];
                })}</tr>)}</tbody>
              </table></div> : <div className="lis-table-wrap"><table className="lis-results-table">
                <thead><tr><th>SELECT</th><th>TEST</th><th>RESULT</th><th>SPECIMEN</th><th>UNIT</th><th>REFERENCE RANGE</th><th>STATUS</th>{canDeleteApprovedTests && <th>ACTION</th>}</tr></thead>
                <tbody>{rows}</tbody>
              </table></div>}
            </section>;
          })}
          {editableTests.length > 0 && <div className="lis-heading-actions" style={{ marginTop: 16, flexWrap:"wrap" }}>
            <button className="lis-button lis-button-submit" form="order-results-form" type="submit" name="action" value="submitAll" title="Send all eligible results for review"><Send size={15} />Send All for Review</button>
          </div>}
        </>
      )}

      {!canEnterResults && [...groups.entries()].map(([panel, tests]) => (
        <section className="lis-panel-card" key={panel}>
        <div className="lis-panel-heading"><div><h3>{displayPanelName(panel)}</h3><p>{tests.length} result {tests.length === 1 ? "field" : "fields"}</p>{tests[0]?.departmentName && <p className="text-[10px] font-medium text-blue-700">Performing department · {tests[0].departmentName}</p>}</div></div>
          <div className="lis-table-wrap"><table className="lis-results-table">
            <thead><tr><th>SELECT</th><th>TEST</th><th>RESULT</th><th>SPECIMEN</th><th>UNIT</th><th>REFERENCE RANGE</th><th>STATUS</th></tr></thead>
            <tbody>{tests.map((test) => <tr key={test.code}>
              <td><input type="checkbox" checked disabled aria-label={`${test.name} selected for this report`} /></td>
              <td><div className="lis-test-name">{test.name}</div><span className="lis-test-code">{test.code}</span></td>
              <td><span className="lis-result-value">{test.result ||"Not entered"}</span></td><td>{test.specimenType ||"—"}</td><td>{test.unit ||"—"}</td>
              <td>{hasSourceReference(test.sourceReference) ? test.sourceReference.trim() : "-"}</td><td><span className={statusClass(test.status)}>{test.status}</span></td>
            </tr>)}</tbody>
          </table></div>
        </section>
      ))}

      {canReview && order.authorizedAt && order.tests.some((test) => test.status === "Completed") && <section className="lis-panel-card" style={{ marginTop: 20, padding: 20 }}>
        <div className="lis-panel-heading"><div><h3>Amend a released result</h3><p>Enter the correction and a reason. This reopens review; the latest report is updated after reauthorization.</p></div></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{order.tests.filter((test) => test.status === "Completed").map((test) => <form action={beginReportAmendment} key={test.code} className="space-y-2 border border-slate-200 p-3">
          <input type="hidden" name="orderId" value={id} /><input type="hidden" name="testCode" value={test.code} />
          <p className="text-xs font-semibold text-slate-800">{test.name} · {test.code}</p>
          <textarea name="result" defaultValue={test.result} required maxLength={3000} rows={2} className="w-full border border-slate-200 px-2 py-2 text-xs" aria-label={`Corrected ${test.name} result`} />
          <input name="reason" required minLength={3} maxLength={500} placeholder="Reason for amendment" className="h-9 w-full border border-slate-200 px-2 text-xs" />
          <button type="submit" className="h-8 border border-amber-600 bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700">Start amendment</button>
        </form>)}</div>
      </section>}

      <section className="lis-panel-card" style={{ marginTop: 20 }}>
        <div className="lis-panel-heading"><div><h3 className="flex items-center gap-2"><Beaker size={16} /> Reagent lot traceability</h3><p>Actual reagent usage recorded against this order and test.</p></div></div>
        {reagentMovements.length ? <div className="lis-table-wrap"><table className="lis-results-table"><thead><tr><th>TEST</th><th>REAGENT</th><th>LOT</th><th>QUANTITY USED</th><th>DATE</th><th>REASON</th></tr></thead><tbody>{reagentMovements.map((movement) => {
          const lot = reagentLotById.get(movement.lotId.toHexString());
          const reagent = reagentById.get(movement.reagentId.toHexString());
          const orderedTest = order.tests.find((test) => test.code === movement.testCode);
          return <tr key={movement._id.toHexString()}><td>{orderedTest?.name ?? movement.testCode}</td><td>{reagent?.name ?? "Reagent"}</td><td>{lot ? <Link href={`/reagents/lots/${lot._id.toHexString()}`} className="font-semibold text-blue-700 underline">{lot.lotNumber}</Link> : "Lot unavailable"}</td><td>{Math.abs(movement.quantity)} {movement.unit}</td><td>{formatDate(movement.performedAt)}</td><td>{movement.reason}</td></tr>;
        })}</tbody></table></div> : <p className="px-5 py-6 text-sm text-slate-500">No reagent lot usage has been linked to this order yet. Record usage from the relevant reagent lot page.</p>}
      </section>

      {canReview && awaitingReview > 0 && (
        <form action={updateOrderTests} className="lis-panel-card" style={{ marginTop: 20, padding: 20 }}>
          <input type="hidden" name="orderId" value={id} />
          <input type="hidden" name="action" value="completeAll" />
          <div className="lis-section-heading"><div><h2>Review submitted results</h2><p>{awaitingReview} {awaitingReview === 1 ?"test is" :"tests are"} awaiting review. Review the results above before approving them.</p></div>
            <button className="lis-button lis-button-review disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={rejectedTestCodes.size > 0} title={rejectedTestCodes.size > 0 ? "Resolve the rejected specimen before completing this order" : undefined}><ClipboardCheck size={15} />Review &amp; Approve All</button>
          </div>
        </form>
      )}

      <footer className="lis-page-footer"><ShieldCheck size={15} /><span>Verify results and reference ranges before final report release.</span></footer>
    </main>
  );
}
