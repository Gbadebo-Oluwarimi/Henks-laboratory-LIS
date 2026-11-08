import Link from "next/link";
import { ArrowLeft, PackageCheck } from "lucide-react";

import { getDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/session";
import { todayKey } from "@/lib/reagents";
import type { ReagentRecord, ReagentStorageLocationRecord } from "@/lib/models";
import { receiveReagentLot } from "@/app/(workspace)/reagents/actions";
import { ReagentHeader, reagentButtonClass, reagentErrorMessage, reagentInputClass, reagentLabelClass, reagentSecondaryButtonClass } from "@/app/(workspace)/reagents/components";

export default async function ReceiveReagentLotPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  await requirePermission("reagents:receive");
  const [database, params] = await Promise.all([getDatabase(), searchParams]);
  const [reagents, locations] = await Promise.all([
    database.collection<ReagentRecord>("reagents").find({ active: true }).sort({ name: 1 }).toArray(),
    database.collection<ReagentStorageLocationRecord>("reagentStorageLocations").find({ active: true }).sort({ code: 1 }).toArray(),
  ]);
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const error = reagentErrorMessage(errorCode);
  const today = todayKey();

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-8 text-slate-800">
      <Link href="/reagents/lots" className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-[#073F9F]"><ArrowLeft size={14} /> Back to lots</Link>
      <ReagentHeader title="Receive reagent lot" description="Register a physical batch. Every delivery starts in quarantine and remains unavailable for use until verification and approval." />
      {error && <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {!reagents.length || !locations.length ? <section className="space-y-2 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{!reagents.length ? "Create an active reagent definition" : "Create an active storage location"} before receiving stock.</p><Link className="font-semibold underline" href={!reagents.length ? "/reagents/definitions" : "/reagents/settings"}>{!reagents.length ? "Open reagent definitions" : "Open reagent settings"}</Link></section> : (
        <form action={receiveReagentLot} className="space-y-5 border border-slate-200 bg-white p-5">
          <section><h2 className="mb-3 text-sm font-semibold text-[#073F9F]">Product and batch</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={reagentLabelClass}>Reagent<select className={reagentInputClass} name="reagentId" required defaultValue=""><option value="" disabled>Select reagent</option>{reagents.map((reagent) => <option key={reagent._id.toHexString()} value={reagent._id.toHexString()}>{reagent.name} · {reagent.code}</option>)}</select></label>
            <label className={reagentLabelClass}>Lot number<input className={reagentInputClass} name="lotNumber" required maxLength={100} /></label>
            <label className={reagentLabelClass}>Batch number (optional)<input className={reagentInputClass} name="batchNumber" maxLength={100} /></label>
            <label className={reagentLabelClass}>Quantity received<input className={reagentInputClass} name="quantity" type="number" min="0.000001" step="any" required /></label>
            <label className={reagentLabelClass}>Supplier<input className={reagentInputClass} name="supplier" maxLength={120} placeholder="Supplier name (optional)" /></label>
            <label className={reagentLabelClass}>Storage location<select className={reagentInputClass} name="storageLocationId" required defaultValue=""><option value="" disabled>Select location</option>{locations.map((location) => <option key={location._id.toHexString()} value={location._id.toHexString()}>{location.code} · {location.name} ({location.type.replaceAll("_", " ")})</option>)}</select></label>
            <label className={reagentLabelClass}>Date received<input className={reagentInputClass} name="dateReceived" type="date" defaultValue={today} max={today} required /></label>
            <label className={reagentLabelClass}>Manufacturer expiry<input className={reagentInputClass} name="expiryDate" type="date" min={today} required /></label>
            <div className="flex items-end"><p className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Received stock is recorded in the ledger but is blocked from testing while quarantined.</p></div>
            <label className={`${reagentLabelClass} sm:col-span-2 lg:col-span-3`}>Condition on receipt<textarea className="mt-1 block min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" name="conditionOnReceipt" maxLength={300} placeholder="Packaging, temperature, seal, or visible damage observations" /></label>
            <label className={`${reagentLabelClass} sm:col-span-2 lg:col-span-3`}>Remarks<textarea className="mt-1 block min-h-16 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" name="remarks" maxLength={500} /></label>
          </div></section>
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end"><Link href="/reagents/lots" className={reagentSecondaryButtonClass}>Cancel</Link><button className={reagentButtonClass} type="submit"><PackageCheck size={15} /> Receive into quarantine</button></footer>
        </form>
      )}
    </main>
  );
}
