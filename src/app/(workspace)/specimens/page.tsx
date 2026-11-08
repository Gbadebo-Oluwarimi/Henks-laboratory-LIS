import Link from "next/link";
import { Droplets, ExternalLink } from "lucide-react";

import { transitionSpecimen } from "@/app/(workspace)/specimens/actions";
import { getDatabase } from "@/lib/mongodb";
import type { SpecimenRecord, SpecimenStatus } from "@/lib/models";
import { nextSpecimenStatuses } from "@/lib/specimens";
import { getCurrentUser } from "@/lib/session";

const statusLabels: Record<SpecimenStatus, string> = {
  ORDERED: "Ordered", COLLECTED: "Collected", RECEIVED: "Received", ACCEPTED: "Accepted",
  IN_PROCESS: "In process", COMPLETED: "Completed", REJECTED: "Rejected",
  RECOLLECTION_REQUIRED: "Recollection required", CANCELLED: "Cancelled",
};

function formattedDate(date?: Date): string {
  return date ? date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }) : "—";
}

export default async function SpecimensPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const [database, user, params] = await Promise.all([getDatabase(), getCurrentUser(), searchParams]);
  const specimens = await database.collection<SpecimenRecord>("specimens").find().sort({ createdAt: -1 }).limit(200).toArray();
  const canUpdate = user?.role === "Administrator" || user?.role === "Laboratory Staff";
  const errorMessages: Record<string, string> = {
    forbidden: "You do not have permission to update specimens.", validation: "A rejection requires a reason. Check the form and try again.",
    missing: "That specimen could not be found.", transition: "That specimen has changed or the requested transition is not allowed. Refresh and try again.",
  };

  return <main className="min-w-0 space-y-5 pb-8 text-slate-800">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#0049B7]">LABORATORY / SPECIMENS</p><h1 className="mt-1 text-2xl font-semibold text-[#073F9F]">Specimen tracking</h1><p className="mt-1 text-sm text-slate-500">Collection and reception status are tracked independently from test results.</p></div><span className="text-xs text-slate-500">Showing latest {specimens.length} specimens</span></header>
    {params.notice === "updated" && <p className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Specimen history updated.</p>}
    {params.error && errorMessages[params.error] && <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessages[params.error]}</p>}
    {specimens.length === 0 ? <section className="border border-slate-200 bg-white px-5 py-12 text-center"><Droplets className="mx-auto text-slate-400" size={26} /><h2 className="mt-3 text-sm font-semibold text-slate-800">No specimens recorded</h2><p className="mt-1 text-sm text-slate-500">Specimens are created when an order includes configured specimen types.</p></section> : <section className="overflow-x-auto border border-slate-200 bg-white"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Specimen</th><th className="px-4 py-3">Patient / order</th><th className="px-4 py-3">Type / tests / departments</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Next action</th></tr></thead><tbody className="divide-y divide-slate-100">{specimens.map((specimen) => { const next = nextSpecimenStatuses(specimen.status); return <tr key={specimen._id.toHexString()} className="align-top"><td className="px-4 py-3"><p className="font-mono text-xs font-semibold text-slate-800">{specimen.specimenId}</p><p className="mt-1 text-xs text-slate-500">{specimen.specimenType}</p><Link href={`/specimens/${specimen._id.toHexString()}/label`} className="mt-1 inline-flex text-xs font-semibold text-blue-700 underline">Print label</Link>{specimen.parentSpecimenId && <p className="mt-1 text-[10px] text-slate-500">Recollection of {specimen.parentSpecimenId.toHexString()}</p>}</td><td className="px-4 py-3"><p className="font-medium text-slate-800">{specimen.patientName}</p><p className="mt-1 text-xs text-slate-500">{specimen.patientNumber} · {specimen.accessionId}</p><Link href={`/orders/${specimen.orderId.toHexString()}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Open order <ExternalLink size={11} /></Link></td><td className="px-4 py-3"><p className="max-w-64 text-xs text-slate-700">{specimen.testCodes.join(", ")}</p>{specimen.departmentNames?.length ? <p className="mt-1 text-[10px] font-medium text-blue-800">Route to: {specimen.departmentNames.join(", ")}</p> : null}<p className="mt-1 text-[10px] text-slate-500">Collected {formattedDate(specimen.collectedAt)} · Received {formattedDate(specimen.receivedAt)}</p>{specimen.rejectionReason && <p className="mt-1 text-xs text-red-700">Reason: {specimen.rejectionReason}</p>}</td><td className="px-4 py-3 text-xs text-slate-600">{formattedDate(specimen.createdAt)}</td><td className="px-4 py-3"><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{statusLabels[specimen.status]}</span><details className="mt-2 text-[10px] text-slate-500"><summary className="cursor-pointer">History ({specimen.events.length})</summary><ul className="mt-1 space-y-1">{specimen.events.map((event, index) => <li key={`${event.occurredAt.toISOString()}-${index}`}>{statusLabels[event.toStatus]} · {formattedDate(event.occurredAt)}{event.reason ? ` · ${event.reason}` : ""}{event.notes ? ` · ${event.notes}` : ""}</li>)}</ul></details></td><td className="px-4 py-3">{canUpdate && next.length > 0 ? <form action={transitionSpecimen} className="flex min-w-48 flex-col gap-1.5"><input type="hidden" name="specimenId" value={specimen.specimenId} /><select name="toStatus" className="h-8 border border-slate-200 bg-white px-2 text-xs">{next.map((nextStatus) => <option value={nextStatus} key={nextStatus}>{statusLabels[nextStatus]}</option>)}</select>{(next.includes("REJECTED") || next.includes("RECOLLECTION_REQUIRED")) && <input name="reason" maxLength={300} placeholder="Reason (required for rejection)" className="h-8 border border-slate-200 px-2 text-xs" />}<button className="h-8 border border-blue-500 bg-blue-500 px-3 text-xs font-semibold text-white hover:bg-blue-600" type="submit">Record transition</button></form> : <span className="text-xs text-slate-400">No action available</span>}</td></tr>; })}</tbody></table></section>}
  </main>;
}
