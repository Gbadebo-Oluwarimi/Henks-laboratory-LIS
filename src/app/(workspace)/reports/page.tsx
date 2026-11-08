import Link from "next/link";
import { FileText } from "lucide-react";
import type { ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import type { LabOrder } from "@/lib/models";
import { formatDate, statusClass } from "@/lib/presentation";
import { PaginationControls } from "@/app/(workspace)/pagination";

const REPORTS_PER_PAGE = 10;

type PatientReportSummary = {
  _id: ObjectId;
  clientSnapshot: LabOrder["clientSnapshot"];
  reportCount: number;
  latestOrder: Pick<LabOrder, "accessionId" | "createdAt" | "updatedAt" | "status">;
};

type PatientReportPage = { metadata: Array<{ total: number }>; data: PatientReportSummary[] };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const database = await getDatabase();
  const reports = database.collection<LabOrder>("labOrders");
  const loadPage = (page: number) => reports.aggregate<PatientReportPage>([
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: "$clientId",
        clientSnapshot: { $first: "$clientSnapshot" },
        reportCount: { $sum: 1 },
        latestOrder: { $first: { accessionId: "$accessionId", createdAt: "$createdAt", updatedAt: "$updatedAt", status: "$status" } },
      },
    },
    { $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $sort: { "latestOrder.updatedAt": -1 } }, { $skip: (page - 1) * REPORTS_PER_PAGE }, { $limit: REPORTS_PER_PAGE }],
    } },
  ]).toArray();
  let [reportPage] = await loadPage(requestedPage);
  const totalPatients = reportPage?.metadata[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPatients / REPORTS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  if (currentPage !== requestedPage) [reportPage] = await loadPage(currentPage);
  const visiblePatients = reportPage?.data ?? [];
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">REFERENCE / REPORTS</p><h1>Reports</h1><p className="page-subtitle">Preview persisted order results and print to PDF.</p></div></div>
      <section className="table-panel">
        <div className="panel-heading"><div><h2>Patients with reports <span className="count-badge">{totalPatients}</span></h2><p>Select a patient to view all associated reports.</p></div></div>
        {totalPatients === 0 ? <div className="empty-state"><FileText size={25} /><strong>No reports available</strong><p>Create a lab order to begin recording test results.</p></div> : <><div className="table-scroll"><table><thead><tr><th>PATIENT</th><th>PATIENT ID</th><th>REPORTS</th><th>LATEST ORDER</th><th>UPDATED</th><th /></tr></thead><tbody>
          {visiblePatients.map((patient) => <tr key={patient._id.toHexString()}>
            <td><span className="cell-primary">{patient.clientSnapshot.fullName}</span></td><td>{patient.clientSnapshot.patientId}</td><td>{patient.reportCount}</td><td>{patient.latestOrder.accessionId}</td><td>{formatDate(patient.latestOrder.updatedAt)}</td>
            
            <td><Link className="row-link" href={`/reports/patients/${patient._id.toHexString()}`}>View reports</Link></td>
          </tr>)}
        </tbody></table></div><PaginationControls basePath="/reports" currentPage={currentPage} totalItems={totalPatients} pageSize={REPORTS_PER_PAGE} itemLabel="patients" /></>}
      </section>
    </>
  );
}
