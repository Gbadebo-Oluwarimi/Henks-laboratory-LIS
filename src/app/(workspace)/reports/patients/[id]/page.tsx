import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import type { ClientRecord, LabOrder } from "@/lib/models";
import { formatDate, statusClass } from "@/lib/presentation";
import { PaginationControls } from "@/app/(workspace)/pagination";

const REPORTS_PER_PAGE = 10;

export default async function PatientReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const pageParam = Array.isArray(query.page) ? query.page[0] : query.page;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  if (!ObjectId.isValid(id)) notFound();
  const patientObjectId = new ObjectId(id);
  const database = await getDatabase();
  const [patient, orders] = await Promise.all([
    database.collection<ClientRecord>("clients").findOne({ _id: patientObjectId }),
    database.collection<LabOrder>("labOrders").find({ clientId: patientObjectId }).sort({ createdAt: -1 }).toArray(),
  ]);
  if (!patient && orders.length === 0) notFound();
  const patientName = patient?.fullName ?? orders[0].clientSnapshot.fullName;
  const patientId = patient?.patientId ?? orders[0].clientSnapshot.patientId;
  const totalPages = Math.max(1, Math.ceil(orders.length / REPORTS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const visibleOrders = orders.slice((currentPage - 1) * REPORTS_PER_PAGE, currentPage * REPORTS_PER_PAGE);
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow">REPORTS / PATIENT RECORDS</p><h1>{patientName}</h1><p className="page-subtitle">{patientId} · {orders.length} reports</p></div>
        <Link className="button button-secondary" href="/reports"><ArrowLeft size={15} /> All patients</Link>
      </div>
      <section className="table-panel">
        <div className="panel-heading"><div><h2>Choose a report <span className="count-badge">{orders.length}</span></h2><p>Match the accession, test names, and order date before opening a report.</p></div></div>
        {orders.length === 0 ? <div className="empty-state"><FileText size={25} /><strong>No reports available</strong><p>Reports will appear here when an order is created.</p></div> : <>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleOrders.map((order, index) => {
              const id = order._id.toHexString();
              const testNames = [...new Set(order.tests.map((test) => test.name))];
              const isReleased = order.status === "Completed" || Boolean(order.reportVersions?.length);
              return <article key={id} className="flex min-h-56 flex-col rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {index === 0 && currentPage === 1 && <span className="mb-2 inline-block rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-800">Most recent</span>}
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Accession</p>
                    <h3 className="mt-1 break-all text-base font-semibold text-slate-900">{order.accessionId}</h3>
                  </div>
                  <span className={statusClass(order.status)}>{isReleased ? "Final report" : "In progress"}</span>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tests ({order.tests.length})</p>
                  <p className="mt-1 text-sm leading-5 text-slate-700">{testNames.length ? testNames.slice(0, 3).join(", ") : "No tests listed"}{testNames.length > 3 ? ` + ${testNames.length - 3} more` : ""}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Ordered {formatDate(order.createdAt)}</span>
                  <span>{isReleased ? "Latest report released" : "No report released"}</span>
                </div>
                <Link className="button button-secondary mt-3 w-full" href={`/reports/${id}`}>Open this report <ArrowRight size={14} /></Link>
              </article>;
            })}
          </div>
          <PaginationControls basePath={`/reports/patients/${id}`} currentPage={currentPage} totalItems={orders.length} pageSize={REPORTS_PER_PAGE} itemLabel="reports" />
        </>}
      </section>
    </>
  );
}
