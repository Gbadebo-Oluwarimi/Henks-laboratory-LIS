import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, Ban, Beaker, Check, ClipboardCheck, PackageOpen, PencilLine, Trash2 } from "lucide-react";
import { ObjectId } from "mongodb";

import { getDatabase } from "@/lib/mongodb";
import { hasPermission, requirePermission } from "@/lib/session";
import { canUseLot, effectiveExpiryDate, fefoLot, lotEffectiveStatus } from "@/lib/reagents";
import { formatDate } from "@/lib/presentation";
import type { LabOrder, ReagentLotRecord, ReagentRecord, ReagentStockMovementRecord, ReagentStorageLocationRecord, ReagentVerificationRecord, TestReagentRequirementRecord } from "@/lib/models";
import { approveReagentLot, adjustReagentStock, disposeReagentLot, openReagentLot, recordLotVerification, recordReagentUsage, rejectReagentLot, transferReagentLot } from "@/app/(workspace)/reagents/actions";
import { ConfirmForm } from "@/app/(workspace)/reagents/confirm-form";
import { ReagentHeader, ReagentStatus, ReagentTabs, reagentButtonClass, reagentErrorMessage, reagentInputClass, reagentLabelClass, reagentSecondaryButtonClass } from "@/app/(workspace)/reagents/components";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

export default async function ReagentLotDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }> }) {
  const user = await requirePermission("reagents:view");
  const [{ id }, search, database] = await Promise.all([params, searchParams, getDatabase()]);
  if (!ObjectId.isValid(id)) notFound();
  const lotId = new ObjectId(id);
  const [lot, locations, movements, verifications, orders] = await Promise.all([
    database.collection<ReagentLotRecord>("reagentLots").findOne({ _id: lotId }),
    database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").find({ active: true }).sort({ code: 1 }).toArray(),
    database.collection<ReagentStockMovementRecord>("reagentStockMovements").find({ lotId }).sort({ performedAt: -1 }).limit(100).toArray(),
    database.collection<ReagentVerificationRecord>("reagentVerifications").find({ lotId }).sort({ performedAt: -1 }).toArray(),
    database.collection<LabOrder>("labOrders").find().sort({ createdAt: -1 }).limit(50).toArray(),
  ]);
  if (!lot) notFound();
  const [reagent, location, requirements, users] = await Promise.all([
    database.collection<ReagentRecord>("reagents").findOne({ _id: lot.reagentId }),
    database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").findOne({ _id: lot.storageLocationId }),
    database.collection<TestReagentRequirementRecord>("testReagentRequirements").find({ reagentId: lot.reagentId }).toArray(),
    database.collection<{ _id: ObjectId; name: string }>("users").find({}, { projection: { name: 1 } }).toArray(),
  ]);
  if (!reagent) notFound();
  const allCandidateLots = await database.collection<ReagentLotRecord>("reagentLots").find({ reagentId: lot.reagentId, status: { $in: ["APPROVED", "IN_USE"] } }).toArray();
  const recommendedLot = fefoLot(allCandidateLots);
  const requirementCodes = new Set(requirements.map((item) => item.testCode));
  const tests = await database.collection<{ code: string; name: string; panel: string }>("testDefinitions").find({ code: { $in: [...requirementCodes] } }).toArray();
  const testByCode = new Map(tests.map((test) => [test.code, test]));
  const userNames = new Map(users.map((item) => [item._id.toHexString(), item.name]));
  const effectiveStatus = lotEffectiveStatus(lot);
  const usable = canUseLot(lot);
  const isRecommended = recommendedLot?._id.equals(lot._id) === true;
  const paramsSearch = search;
  const errorCode = Array.isArray(paramsSearch.error) ? paramsSearch.error[0] : paramsSearch.error;
  const noticeCode = Array.isArray(paramsSearch.notice) ? paramsSearch.notice[0] : paramsSearch.notice;
  const notices: Record<string, string> = {
    received: "Lot received and placed in quarantine.", "verification-recorded": "Verification record saved; lot is pending authorized review.", approved: "Lot approved for laboratory use.", rejected: "Lot rejected and blocked from use.", opened: "Lot opened and moved to in-use status.", "stock-adjusted": "Stock adjustment recorded.", "usage-recorded": "Reagent usage recorded against the lot.", transferred: "Storage transfer recorded.", disposed: "Lot disposed and remaining quantity removed from stock.",
  };
  const error = reagentErrorMessage(errorCode);
  const canReceive = hasPermission(user, "reagents:receive");
  const canVerify = hasPermission(user, "reagents:verify");
  const canApprove = hasPermission(user, "reagents:approve");
  const canUse = hasPermission(user, "reagents:use");
  const canAdjust = hasPermission(user, "reagents:adjust");
  const canDispose = hasPermission(user, "reagents:dispose");
  const canRecordVerification = canVerify && lot.status === "QUARANTINED";
  const canReviewVerification = canApprove && lot.status === "PENDING_VERIFICATION";
  const canOpen = canUse && usable && lot.status === "APPROVED";
  const canAdjustLot = canAdjust && usable;
  const canDisposeLot = canDispose && ["APPROVED", "IN_USE", "EXPIRED"].includes(effectiveStatus);

  return (
    <main className="min-w-0 space-y-5 pb-8 text-slate-800">
      {noticeCode && notices[noticeCode] && <ToastNotification message={notices[noticeCode]} />}
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <Link href="/reagents/lots" className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-[#073F9F]"><ArrowLeft size={14} /> Back to lots</Link>
      <ReagentHeader title={reagent.name} description={`${reagent.code} · Lot ${lot.lotNumber}${lot.batchNumber ? ` · Batch ${lot.batchNumber}` : ""}`} action={<div className="flex items-center gap-2"><ReagentStatus status={effectiveStatus} />{isRecommended && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-800">Recommended FEFO lot</span>}</div>} />
      <ReagentTabs active="Lots & stock" />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Current quantity</p><p className="mt-2 text-xl font-semibold text-[#073F9F]">{lot.currentQuantity} <span className="text-xs">{lot.unit}</span></p><p className="mt-1 text-[10px] text-slate-500">Received {lot.quantityReceived} {lot.unit}</p></article>
            <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Manufacturer expiry</p><p className="mt-2 text-sm font-semibold text-[#073F9F]">{formatDate(lot.expiryDate)}</p></article>
            <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Effective expiry</p><p className="mt-2 text-sm font-semibold text-[#073F9F]">{formatDate(effectiveExpiryDate(lot))}</p><p className="mt-1 text-[10px] text-slate-500">Earlier of manufacturer and in-use date</p></article>
            <article className="border border-slate-200 bg-white p-4"><p className="text-[10px] uppercase tracking-wide text-slate-400">Storage location</p><p className="mt-2 text-sm font-semibold text-[#073F9F]">{location?.name ?? "Location missing"}</p><p className="mt-1 text-[10px] text-slate-500">{location?.code ?? ""}</p></article>
          </section>

          <section className="grid gap-4 border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div><h2 className="text-sm font-semibold text-[#073F9F]">Lot information</h2><dl className="mt-3 grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-xs"><dt className="text-slate-500">Manufacturer</dt><dd className="m-0 text-slate-800">{lot.manufacturer ?? reagent.manufacturer ?? "—"}</dd><dt className="text-slate-500">Catalogue number</dt><dd className="m-0 text-slate-800">{lot.catalogueNumber ?? reagent.catalogueNumber ?? "—"}</dd><dt className="text-slate-500">Supplier</dt><dd className="m-0 text-slate-800">{lot.supplier ?? "—"}</dd><dt className="text-slate-500">Date received</dt><dd className="m-0 text-slate-800">{formatDate(lot.dateReceived)}</dd><dt className="text-slate-500">Received by</dt><dd className="m-0 text-slate-800">{userNames.get(lot.receivedBy) ?? lot.receivedBy}</dd><dt className="text-slate-500">Condition on receipt</dt><dd className="m-0 text-slate-800">{lot.conditionOnReceipt ?? "—"}</dd></dl></div>
            <div><h2 className="text-sm font-semibold text-[#073F9F]">Lifecycle</h2><dl className="mt-3 grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-xs"><dt className="text-slate-500">Status</dt><dd className="m-0"><ReagentStatus status={effectiveStatus} /></dd><dt className="text-slate-500">Opened at</dt><dd className="m-0 text-slate-800">{lot.openedAt ? formatDate(lot.openedAt) : "Not opened"}</dd><dt className="text-slate-500">Opened by</dt><dd className="m-0 text-slate-800">{lot.openedBy ? userNames.get(lot.openedBy) ?? lot.openedBy : "—"}</dd><dt className="text-slate-500">In-use expiry</dt><dd className="m-0 text-slate-800">{lot.inUseExpiryDate ? formatDate(lot.inUseExpiryDate) : "Not configured"}</dd><dt className="text-slate-500">Verified by</dt><dd className="m-0 text-slate-800">{lot.verifiedBy ? userNames.get(lot.verifiedBy) ?? lot.verifiedBy : "—"}</dd><dt className="text-slate-500">Approved by</dt><dd className="m-0 text-slate-800">{lot.approvedBy ? userNames.get(lot.approvedBy) ?? lot.approvedBy : "—"}</dd><dt className="text-slate-500">Rejected by</dt><dd className="m-0 text-slate-800">{lot.rejectedBy ? userNames.get(lot.rejectedBy) ?? lot.rejectedBy : "—"}</dd><dt className="text-slate-500">Rejection reason</dt><dd className="m-0 text-slate-800">{lot.rejectionReason ?? "—"}</dd></dl></div>
          </section>

          <section className="overflow-hidden border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Verification history</h2><p className="mt-1 text-xs text-slate-500">Verification is a recorded laboratory decision; this system does not create QC acceptance criteria.</p></div>{verifications.length ? <div className="divide-y divide-slate-100">{verifications.map((record) => <article key={record._id.toHexString()} className="px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{record.verificationMethod}</p><span className="text-[10px] text-slate-500">{formatDate(record.performedAt)} · {userNames.get(record.performedBy) ?? record.performedBy}</span></div><p className="mt-1 text-xs text-slate-700">Recorded result: {record.result}</p>{record.verificationNotes && <p className="mt-1 text-xs text-slate-500">{record.verificationNotes}</p>}{record.decision && <p className="mt-2 text-[10px] font-semibold text-slate-600">{record.decision} by {userNames.get(record.reviewedBy ?? "") ?? record.reviewedBy} · {record.reviewedAt ? formatDate(record.reviewedAt) : ""}{record.rejectionReason ? ` · ${record.rejectionReason}` : ""}</p>}</article>)}</div> : <p className="px-4 py-8 text-center text-sm text-slate-500">No verification has been recorded.</p>}</section>

          <section className="overflow-hidden border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Stock movement ledger</h2><p className="mt-1 text-xs text-slate-500">Quantity changes are recorded with previous and resulting stock.</p></div>{movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Movement</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Reason / reference</th><th className="px-4 py-3">Performed by</th></tr></thead><tbody className="divide-y divide-slate-100">{movements.map((movement) => <tr key={movement._id.toHexString()}><td className="px-4 py-3 text-slate-500">{formatDate(movement.performedAt)}</td><td className="px-4 py-3 font-semibold text-slate-700">{movement.type.replaceAll("_", " ")}</td><td className="px-4 py-3">{movement.quantity > 0 ? "+" : ""}{movement.quantity} {movement.unit}</td><td className="px-4 py-3">{movement.previousQuantity} → {movement.newQuantity}</td><td className="px-4 py-3 text-slate-600">{movement.reason}{movement.referenceType === "labOrderTest" && movement.referenceId ? <span> · <Link className="font-semibold text-blue-700 underline" href={`/orders/${movement.referenceId}`}>{movement.testCode} (view order)</Link></span> : null}{movement.fromLocationId && movement.toLocationId ? ` · Transfer ${movement.fromLocationId.toHexString().slice(-6)} → ${movement.toLocationId.toHexString().slice(-6)}` : ""}</td><td className="px-4 py-3 text-slate-500">{userNames.get(movement.performedBy) ?? movement.performedBy}</td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-slate-500">No stock movements recorded.</p>}</section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-[#073F9F]">Available actions</h2>
            {!usable && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">This lot cannot be used until it has been approved, has quantity available, and is within its effective expiry date.</p>}
            {canRecordVerification && <form action={recordLotVerification} className="space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="lotId" value={id} /><p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ClipboardCheck size={14} /> Record verification</p><label className={reagentLabelClass}>Verification method<input className={reagentInputClass} name="verificationMethod" required maxLength={120} placeholder="Method or procedure used" /></label><label className={reagentLabelClass}>Observed result<input className={reagentInputClass} name="result" required maxLength={500} placeholder="Record the laboratory observation" /></label><label className={reagentLabelClass}>Notes<textarea className="mt-1 block min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500" name="verificationNotes" maxLength={1000} /></label><button className={reagentButtonClass} type="submit">Submit for approval</button></form>}
            {canReviewVerification && <div className="space-y-2 border-t border-slate-100 pt-3"><p className="text-xs font-semibold text-slate-700">Approve or reject</p><form action={approveReagentLot}><input type="hidden" name="lotId" value={id} /><button className={reagentButtonClass} type="submit"><Check size={14} /> Approve lot</button></form><ConfirmForm action={rejectReagentLot} message="Reject this reagent lot? Rejected lots remain in history and cannot be used." className="space-y-2"><input type="hidden" name="lotId" value={id} /><label className={reagentLabelClass}>Rejection reason<input className={reagentInputClass} name="rejectionReason" required minLength={3} maxLength={500} /></label><button className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50" type="submit"><Ban size={14} /> Reject lot</button></ConfirmForm></div>}
            {canOpen && <form action={openReagentLot} className="border-t border-slate-100 pt-3"><input type="hidden" name="lotId" value={id} /><button className={reagentButtonClass} type="submit"><PackageOpen size={14} /> Open lot</button><p className="mt-2 text-[10px] leading-4 text-slate-500">In-use stability is applied only when configured on the reagent definition.</p></form>}
            {canUse && usable && <form action={recordReagentUsage} className="space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="lotId" value={id} /><p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Beaker size={14} /> Record actual use</p><label className={reagentLabelClass}>Quantity used<input className={reagentInputClass} name="quantity" type="number" min="0.000001" max={lot.currentQuantity} step="any" required /></label><label className={reagentLabelClass}>Reason<input className={reagentInputClass} name="reason" required maxLength={300} placeholder="Actual use or issue reason" /></label><label className={reagentLabelClass}>Linked order (optional)<select className={reagentInputClass} name="orderId" defaultValue=""><option value="">No order link</option>{orders.map((order) => <option key={order._id.toHexString()} value={order._id.toHexString()}>{order.accessionId} · {order.clientSnapshot.fullName}</option>)}</select></label><label className={reagentLabelClass}>Associated catalogue test (required with order)<select className={reagentInputClass} name="testCode" defaultValue=""><option value="">No test link</option>{requirements.map((requirement) => <option key={requirement.testCode} value={requirement.testCode}>{testByCode.get(requirement.testCode)?.name ?? requirement.testCode}</option>)}</select></label><button className={reagentButtonClass} type="submit">Record consumption</button><p className="text-[10px] leading-4 text-slate-500">Enter the observed quantity; the system never estimates per-test consumption.</p></form>}
            {canAdjustLot && <ConfirmForm action={adjustReagentStock} message="Save this stock adjustment to the permanent lot ledger?" className="space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="lotId" value={id} /><p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><PencilLine size={14} /> Adjust stock</p><label className={reagentLabelClass}>Adjustment<select className={reagentInputClass} name="direction"><option value="IN">Adjustment in</option><option value="OUT">Adjustment out</option></select></label><label className={reagentLabelClass}>Quantity<input className={reagentInputClass} name="quantity" type="number" min="0.000001" step="any" required /></label><label className={reagentLabelClass}>Reason<input className={reagentInputClass} name="reason" required minLength={3} maxLength={300} placeholder="Damage, count correction, spillage…" /></label><button className={reagentSecondaryButtonClass} type="submit">Save adjustment</button></ConfirmForm>}
            {canReceive && lot.status !== "DISPOSED" && lot.status !== "REJECTED" && lot.status !== "EXHAUSTED" && locations.length > 1 && <form action={transferReagentLot} className="space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="lotId" value={id} /><p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ArrowRightLeft size={14} /> Transfer storage</p><label className={reagentLabelClass}>Destination<select className={reagentInputClass} name="storageLocationId" required defaultValue=""><option value="" disabled>Select location</option>{locations.filter((item) => !item._id.equals(lot.storageLocationId)).map((item) => <option key={item._id.toHexString()} value={item._id.toHexString()}>{item.code} · {item.name}</option>)}</select></label><label className={reagentLabelClass}>Reason<input className={reagentInputClass} name="reason" required maxLength={300} /></label><button className={reagentSecondaryButtonClass} type="submit">Record transfer</button></form>}
            {canDisposeLot && <ConfirmForm action={disposeReagentLot} message="Dispose of this lot and remove all remaining quantity from available stock? This action is audited." className="space-y-2 border-t border-slate-100 pt-3"><input type="hidden" name="lotId" value={id} /><p className="flex items-center gap-2 text-xs font-semibold text-red-700"><Trash2 size={14} /> Dispose lot</p><label className={reagentLabelClass}>Disposal reason<input className={reagentInputClass} name="reason" required minLength={3} maxLength={300} placeholder="Expired, damaged, or other reason" /></label><button className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50" type="submit">Dispose remaining stock</button></ConfirmForm>}
          </section>
          <section className="border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-[#073F9F]">Lot policy</h2><p className="mt-2 text-xs leading-5 text-slate-600">Usable stock is approved or in use, non-expired, and has positive quantity. FEFO recommends the available lot with the earliest effective expiry.</p>{isRecommended && <p className="mt-3 rounded-md bg-blue-50 p-2 text-xs text-blue-900">This lot is currently recommended by FEFO for {reagent.name}.</p>}</section>
        </aside>
      </section>
    </main>
  );
}
