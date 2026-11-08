import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { getDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/session";
import { lotEffectiveStatus, parseDateOnly, todayKey } from "@/lib/reagents";
import type { ReagentLotRecord, ReagentRecord, ReagentStorageLocationRecord, ReagentLotStatus } from "@/lib/models";
import { ReagentHeader, ReagentStatus, ReagentTabs, reagentErrorMessage } from "@/app/(workspace)/reagents/components";
import { PaginationControls } from "@/app/(workspace)/pagination";

const statuses: ReagentLotStatus[] = ["QUARANTINED", "PENDING_VERIFICATION", "APPROVED", "IN_USE", "REJECTED", "EXPIRED", "EXHAUSTED", "DISPOSED"];
const pageSize = 20;
const textValue = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

export default async function ReagentLotsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[]; error?: string | string[] }> }) {
  await requirePermission("reagents:view");
  const params = await searchParams;
  const q = textValue(params.q)?.trim().slice(0, 100) ?? "";
  const status = textValue(params.status) ?? "";
  const page = Math.max(1, Number.parseInt(textValue(params.page) ?? "1", 10) || 1);
  const database = await getDatabase();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matchingReagents = q ? await database.collection<ReagentRecord>("reagents").find({ $or: [{ name: { $regex: escaped, $options: "i" } }, { code: { $regex: escaped, $options: "i" } }] }, { projection: { _id: 1 } }).toArray() : [];
  const clauses: Record<string, unknown>[] = [];
  if (q) clauses.push({ $or: [{ lotNumber: { $regex: escaped, $options: "i" } }, { reagentId: { $in: matchingReagents.map((item) => item._id) } }] });
  if (statuses.includes(status as ReagentLotStatus) && status !== "EXPIRED") clauses.push({ status });
  if (status === "EXPIRED") {
    const cutoff = parseDateOnly(todayKey())!;
    clauses.push({ status: { $nin: ["REJECTED", "DISPOSED", "EXHAUSTED", "EXPIRED"] } });
    clauses.push({ $or: [{ expiryDate: { $lte: cutoff } }, { inUseExpiryDate: { $lte: cutoff } }] });
  }
  const filter = clauses.length ? { $and: clauses } : {};
  const collection = database.collection<ReagentLotRecord>("reagentLots");
  const [total, lots] = await Promise.all([
    collection.countDocuments(filter),
    collection.find(filter).sort({ dateReceived: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ]);
  const reagentIds = [...new Map(lots.map((lot) => [lot.reagentId.toHexString(), lot.reagentId])).values()];
  const locationIds = [...new Map(lots.map((lot) => [lot.storageLocationId.toHexString(), lot.storageLocationId])).values()];
  const [reagents, locations] = await Promise.all([
    reagentIds.length ? database.collection<ReagentRecord>("reagents").find({ _id: { $in: reagentIds } }).toArray() : [],
    locationIds.length ? database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").find({ _id: { $in: locationIds } }).toArray() : [],
  ]);
  const reagentById = new Map(reagents.map((item) => [item._id.toHexString(), item]));
  const locationById = new Map(locations.map((item) => [item._id.toHexString(), item]));
  const errorCode = textValue(params.error);
  const error = reagentErrorMessage(errorCode);

  return (
    <main className="min-w-0 space-y-5 pb-8 text-slate-800">
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <ReagentHeader title="Lots and inventory" description="Review physical reagent batches, stock quantities, storage, approval state, and expiry." action={<Link href="/reagents/lots/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600"><Plus size={15} /> Receive lot</Link>} />
      <ReagentTabs active="Lots & stock" />
      <section className="overflow-hidden border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold text-[#073F9F]">Reagent lots</h2><p className="mt-1 text-xs text-slate-500">{total} matching lots · expired stock is blocked even when its stored status still shows approved.</p></div>
          <form method="get" action="/reagents/lots" className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="lot-search">Search reagent and lot numbers</label><input id="lot-search" name="q" defaultValue={q} className="h-9 w-56 max-w-[58vw] border border-slate-200 px-3 text-xs outline-none focus:border-blue-500" placeholder="Search reagent or lot" /><label className="sr-only" htmlFor="lot-status">Filter by status</label><select id="lot-status" name="status" defaultValue={status} className="h-9 border border-slate-200 bg-white px-2 text-xs"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><button className="inline-flex h-9 items-center gap-2 border border-slate-200 px-3 text-xs font-medium hover:bg-slate-50"><Search size={13} /> Apply</button></form>
        </div>
        {lots.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Reagent / lot</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Effective expiry</th><th className="px-4 py-3">Storage</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{lots.map((lot) => { const reagent = reagentById.get(lot.reagentId.toHexString()); return <tr key={lot._id.toHexString()}><td className="px-4 py-3"><Link href={`/reagents/lots/${lot._id}`} className="font-semibold text-[#073F9F] hover:underline">{reagent?.name ?? "Unknown reagent"}</Link><p className="mt-0.5 text-[10px] text-slate-400">{lot.lotNumber}{lot.batchNumber ? ` · Batch ${lot.batchNumber}` : ""}</p></td><td className="px-4 py-3 text-xs text-slate-600">{reagent?.category ?? "—"}</td><td className="px-4 py-3 text-xs font-medium text-slate-700">{lot.currentQuantity} {lot.unit}</td><td className="px-4 py-3 text-xs text-slate-500">{lot.dateReceived.toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" })}</td><td className="px-4 py-3 text-xs text-slate-500">{(lot.inUseExpiryDate && lot.inUseExpiryDate < lot.expiryDate ? lot.inUseExpiryDate : lot.expiryDate).toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" })}</td><td className="px-4 py-3 text-xs text-slate-600">{locationById.get(lot.storageLocationId.toHexString())?.name ?? "Location missing"}</td><td className="px-4 py-3"><ReagentStatus status={lotEffectiveStatus(lot)} /></td></tr>; })}</tbody></table></div><PaginationControls basePath="/reagents/lots" currentPage={page} totalItems={total} pageSize={pageSize} query={{ q, status }} itemLabel="lots" /></> : <p className="px-4 py-12 text-center text-sm text-slate-500">{q || status ? "No lots matched those filters." : "No reagent lots have been received yet."}</p>}
      </section>
    </main>
  );
}
