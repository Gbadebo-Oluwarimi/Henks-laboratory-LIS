import Link from "next/link";
import { AlertTriangle, ArrowRight, Box, Boxes, ClipboardCheck, Plus, ShieldAlert, TimerReset } from "lucide-react";

import { getDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/session";
import { canUseLot, daysSince, effectiveExpiryDate, expiringWithinDays, lotEffectiveStatus } from "@/lib/reagents";
import { formatDate } from "@/lib/presentation";
import type { DepartmentRecord, ReagentLotRecord, ReagentRecord, ReagentStockMovementRecord, ReagentStorageLocationRecord } from "@/lib/models";
import { ReagentHeader, ReagentStatus, ReagentTabs, reagentErrorMessage } from "@/app/(workspace)/reagents/components";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const queryText = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

export default async function ReagentsDashboard({ searchParams }: { searchParams: Promise<{ error?: string | string[]; notice?: string | string[]; view?: string | string[] }> }) {
  await requirePermission("reagents:view");
  const params = await searchParams;
  const database = await getDatabase();
  const [reagents, lots, locations, departments, movements] = await Promise.all([
    database.collection<ReagentRecord>("reagents").find().sort({ name: 1 }).toArray(),
    database.collection<ReagentLotRecord>("reagentLots").find().sort({ expiryDate: 1 }).toArray(),
    database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").find().toArray(),
    database.collection<DepartmentRecord>("departments").find().toArray(),
    database.collection<ReagentStockMovementRecord>("reagentStockMovements").find().sort({ performedAt: -1 }).limit(8).toArray(),
  ]);
  const reagentById = new Map(reagents.map((item) => [item._id.toHexString(), item]));
  const locationById = new Map(locations.map((item) => [item._id.toHexString(), item]));
  const departmentById = new Map(departments.map((item) => [item._id.toHexString(), item]));
  const activeReagents = reagents.filter((item) => item.active);
  const quarantined = lots.filter((item) => lotEffectiveStatus(item) === "QUARANTINED");
  const pending = lots.filter((item) => item.status === "PENDING_VERIFICATION");
  const expired = lots.filter((item) => lotEffectiveStatus(item) === "EXPIRED");
  const expiring = lots.filter((item) => expiringWithinDays(item, 30));
  const availableQuantity = new Map<string, number>();
  for (const lot of lots) {
    if (canUseLot(lot)) {
      const key = lot.reagentId.toHexString();
      availableQuantity.set(key, (availableQuantity.get(key) ?? 0) + lot.currentQuantity);
    }
  }
  const lowStock = activeReagents.filter((item) => (availableQuantity.get(item._id.toHexString()) ?? 0) <= item.reorderLevel);
  const isAlertsView = queryText(params.view) === "alerts";
  const error = reagentErrorMessage(queryText(params.error));
  const noticeText: Record<string, string> = {
    "department-created": "Laboratory department created.",
    "location-created": "Storage location created.",
    "reagent-created": "Reagent definition saved.",
    "lot-received": "Lot received into quarantine.",
  };
  const notice = noticeText[queryText(params.notice) ?? ""];
  const cards = [
    { label: "Active reagents", value: activeReagents.length, icon: Boxes, tone: "text-[#073F9F] bg-[#F0F6FC]" },
    { label: "Approved / in-use lots", value: lots.filter((lot) => canUseLot(lot)).length, icon: Box, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Pending verification", value: pending.length, icon: ClipboardCheck, tone: "text-amber-700 bg-amber-50" },
    { label: "Quarantined", value: quarantined.length, icon: ShieldAlert, tone: "text-orange-700 bg-orange-50" },
    { label: "Low stock", value: lowStock.length, icon: AlertTriangle, tone: "text-rose-700 bg-rose-50" },
    { label: "Expiring in 30 days", value: expiring.length, icon: TimerReset, tone: "text-amber-700 bg-amber-50" },
    { label: "Expired", value: expired.length, icon: AlertTriangle, tone: "text-red-700 bg-red-50" },
  ];

  return (
    <main className="min-w-0 space-y-5 pb-8 text-slate-800">
      {notice && <ToastNotification message={notice} />}
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <ReagentHeader title="Reagent management" description="Track reagent definitions, lot readiness, stock, storage, and expiry from receipt through use and disposal." action={<Link href="/reagents/lots/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600"><Plus size={16} /> Receive a lot</Link>} />
      <ReagentTabs active={isAlertsView ? "Alerts" : "Dashboard"} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7" aria-label="Reagent inventory summary">
        {cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className="min-w-0 border border-slate-200 bg-white p-4">
          <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone}`}><Icon size={17} /></span>
          <p className="mt-4 text-[11px] leading-4 text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#073F9F]">{value}</p>
        </article>)}
      </section>

      {isAlertsView ? (
        <section className="overflow-hidden border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Active reagent alerts</h2><p className="mt-1 text-xs text-slate-500">Expired lots are blocked from use by the server, even before their displayed status is refreshed.</p></div>
          <div className="divide-y divide-slate-100">
            {[...expired, ...expiring.filter((lot) => !expired.some((item) => item._id.equals(lot._id))), ...quarantined, ...pending].map((lot) => {
              const reagent = reagentById.get(lot.reagentId.toHexString());
              const location = locationById.get(lot.storageLocationId.toHexString());
              const status = lotEffectiveStatus(lot);
              const reason = status === "EXPIRED" ? "Effective expiry reached" : status === "QUARANTINED" ? "Awaiting verification" : status === "PENDING_VERIFICATION" ? "Awaiting approval" : "Expires within 30 days";
              return <Link key={lot._id.toHexString()} href={`/reagents/lots/${lot._id.toHexString()}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{reagent?.name ?? "Unknown reagent"} <span className="font-normal text-slate-400">· Lot {lot.lotNumber}</span></p><p className="mt-1 text-xs text-slate-500">{reason} · {location?.name ?? "Location missing"} · {lot.currentQuantity} {lot.unit}</p></div>
                <div className="flex items-center gap-3"><span className="text-xs text-slate-500">Effective expiry {formatDate(effectiveExpiryDate(lot))}</span><ReagentStatus status={status} /></div>
              </Link>;
            })}
            {lowStock.map((reagent) => <Link key={`low-${reagent._id.toHexString()}`} href={`/reagents/definitions/${reagent._id.toHexString()}`} className="flex items-center justify-between gap-3 border-t border-slate-100 bg-rose-50/40 px-4 py-3 hover:bg-rose-50"><div><p className="text-sm font-semibold text-slate-800">{reagent.name} · Low stock</p><p className="mt-1 text-xs text-slate-500">{availableQuantity.get(reagent._id.toHexString()) ?? 0} {reagent.unitOfIssue} available · reorder level {reagent.reorderLevel}</p></div><span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-800">REORDER</span></Link>)}
            {!expired.length && !expiring.length && !quarantined.length && !pending.length && !lowStock.length && <p className="px-4 py-10 text-center text-sm text-slate-500">No active reagent alerts.</p>}
          </div>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <section className="overflow-hidden border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-semibold text-[#073F9F]">Low stock</h2><p className="mt-1 text-xs text-slate-500">Available approved stock compared with each reorder level.</p></div><Link className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700" href="/reagents/definitions">All reagents <ArrowRight size={13} /></Link></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Reagent</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Reorder level</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{lowStock.slice(0, 8).map((reagent) => <tr key={reagent._id.toHexString()}><td className="px-4 py-3"><Link href={`/reagents/definitions/${reagent._id}`} className="font-semibold text-[#073F9F] hover:underline">{reagent.name}</Link><p className="text-[10px] text-slate-400">{reagent.code}</p></td><td className="px-4 py-3 text-xs text-slate-600">{departmentById.get(reagent.departmentId.toHexString())?.name ?? "—"}</td><td className="px-4 py-3 font-medium text-slate-700">{availableQuantity.get(reagent._id.toHexString()) ?? 0} {reagent.unitOfIssue}</td><td className="px-4 py-3 text-slate-600">{reagent.reorderLevel} {reagent.unitOfIssue}</td><td className="px-4 py-3"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700">Reorder</span></td></tr>)}</tbody></table></div>
            {!lowStock.length && <p className="px-4 py-8 text-center text-sm text-slate-500">No reagents are below their reorder level.</p>}
          </section>
          <div className="space-y-5">
            <section className="overflow-hidden border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Expiring soon</h2><p className="mt-1 text-xs text-slate-500">Effective expiry in the next 30 days.</p></div><div className="divide-y divide-slate-100">{expiring.slice(0, 5).map((lot) => <Link key={lot._id.toHexString()} href={`/reagents/lots/${lot._id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{reagentById.get(lot.reagentId.toHexString())?.name ?? "Reagent"} · {lot.lotNumber}</p><p className="mt-1 text-[10px] text-slate-500">{lot.currentQuantity} {lot.unit} · {locationById.get(lot.storageLocationId.toHexString())?.name ?? "Location missing"}</p></div><span className="whitespace-nowrap text-[10px] font-medium text-amber-700">{formatDate(effectiveExpiryDate(lot))}</span></Link>)}{!expiring.length && <p className="px-4 py-8 text-center text-xs text-slate-500">No lots expiring soon.</p>}</div></section>
            <section className="overflow-hidden border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Pending verification</h2><p className="mt-1 text-xs text-slate-500">New stock stays unavailable until approved.</p></div><div className="divide-y divide-slate-100">{[...quarantined, ...pending].slice(0, 5).map((lot) => { const daysPending = daysSince(lot.dateReceived); return <Link key={lot._id.toHexString()} href={`/reagents/lots/${lot._id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{reagentById.get(lot.reagentId.toHexString())?.name ?? "Reagent"} · {lot.lotNumber}</p><p className="mt-1 text-[10px] text-slate-500">Received {formatDate(lot.dateReceived)} · {daysPending} day{daysPending === 1 ? "" : "s"} pending</p></div><ReagentStatus status={lotEffectiveStatus(lot)} /></Link>; })}{!quarantined.length && !pending.length && <p className="px-4 py-8 text-center text-xs text-slate-500">No lots are waiting for verification.</p>}</div></section>
          </div>
        </div>
      )}

      <section className="overflow-hidden border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-[#073F9F]">Recent reagent activity</h2><p className="mt-1 text-xs text-slate-500">Receipts, verification, consumption, adjustments, transfers, and disposal.</p></div>
        {movements.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Reagent / lot</th><th className="px-4 py-3">Movement</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">User</th></tr></thead><tbody className="divide-y divide-slate-100">{movements.map((movement) => <tr key={movement._id.toHexString()}><td className="px-4 py-3 text-xs text-slate-500">{formatDate(movement.performedAt)}</td><td className="px-4 py-3"><Link href={`/reagents/lots/${movement.lotId}`} className="font-medium text-[#073F9F] hover:underline">{reagentById.get(movement.reagentId.toHexString())?.name ?? "Reagent"}</Link><p className="text-[10px] text-slate-400">{movement.lotId.toHexString().slice(-8)}</p></td><td className="px-4 py-3 text-xs font-semibold text-slate-700">{movement.type.replaceAll("_", " ")}</td><td className="px-4 py-3 text-xs text-slate-700">{movement.quantity > 0 ? "+" : ""}{movement.quantity} {movement.unit}</td><td className="max-w-52 truncate px-4 py-3 text-xs text-slate-500">{movement.reason}</td><td className="px-4 py-3 text-xs text-slate-500">{movement.performedBy}</td></tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-slate-500">No reagent movements have been recorded yet.</p>}
      </section>
    </main>
  );
}
