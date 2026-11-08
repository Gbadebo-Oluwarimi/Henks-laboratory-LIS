import Link from "next/link";
import { ListChecks } from "lucide-react";

import { getDatabase } from "@/lib/mongodb";
import type { DepartmentRecord, LabOrder } from "@/lib/models";
import type { TestStatus } from "@/lib/workflow";

const statuses: TestStatus[] = ["Pending", "In Progress", "Awaiting Review", "Completed"];

export default async function WorklistPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; department?: string | string[] }> }) {
  const params = await searchParams;
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = statuses.includes(requested as TestStatus) ? requested as TestStatus : undefined;
  const requestedDepartment = Array.isArray(params.department) ? params.department[0] : params.department;
  const database = await getDatabase();
  const departments = await database.collection<DepartmentRecord>("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).sort({ name: 1 }).toArray();
  const departmentCode = departments.some((item) => item.code === requestedDepartment) ? requestedDepartment : undefined;
  const testFilter: Record<string, unknown> = { status: status ?? { $in: ["Pending", "In Progress", "Awaiting Review"] } };
  if (departmentCode) testFilter.departmentCode = departmentCode;
  const query = { tests: { $elemMatch: testFilter } };
  const orders = await database.collection<LabOrder>("labOrders").find(query).sort({ updatedAt: 1 }).limit(200).toArray();
  const rows = orders.flatMap((order) => order.tests.filter((test) => (status ? test.status === status : test.status !== "Completed") && (!departmentCode || test.departmentCode === departmentCode)).map((test) => ({ order, test })));

  return <main className="min-w-0 space-y-5 pb-8 text-slate-800">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0049B7]"><ListChecks size={14} />LABORATORY / WORKLIST</p><h1 className="mt-1 text-2xl font-semibold text-[#073F9F]">Test worklist</h1><p className="mt-1 text-sm text-slate-500">Pending entry and review work across active orders. Department assignment is shown when configured.</p></div><form method="get" action="/worklist" className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="worklist-status">Filter status</label><select id="worklist-status" name="status" defaultValue={status ?? ""} className="h-9 border border-slate-200 bg-white px-2 text-xs"><option value="">All open work</option>{statuses.filter((item) => item !== "Completed").map((item) => <option key={item} value={item}>{item}</option>)}</select><label className="sr-only" htmlFor="worklist-department">Filter department</label><select id="worklist-department" name="department" defaultValue={departmentCode ?? ""} className="h-9 border border-slate-200 bg-white px-2 text-xs"><option value="">All departments</option>{departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select><button className="h-9 border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50" type="submit">Filter</button></form></header>
    <section className="overflow-x-auto border border-slate-200 bg-white"><div className="border-b border-slate-200 px-4 py-3"><p className="text-xs font-semibold text-slate-800">{rows.length} tests in this queue</p></div>{rows.length ? <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Patient / accession</th><th className="px-4 py-3">Test</th><th className="px-4 py-3">Panel</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(({ order, test }) => <tr key={`${order._id.toHexString()}-${test.code}`}><td className="px-4 py-3"><p className="font-medium text-slate-800">{order.clientSnapshot.fullName}</p><p className="mt-1 text-[10px] text-slate-500">{order.clientSnapshot.patientId} · {order.accessionId}</p></td><td className="px-4 py-3"><p className="text-xs font-semibold">{test.name}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{test.code}</p></td><td className="px-4 py-3 text-xs text-slate-600">{test.panel}</td><td className="px-4 py-3 text-xs text-slate-500">{test.departmentName ?? "Unassigned"}</td><td className="px-4 py-3"><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700">{test.status}</span></td><td className="px-4 py-3 text-xs text-slate-600">{(test.updatedAt ?? order.updatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}</td><td className="px-4 py-3"><Link href={`/orders/${order._id.toHexString()}`} className="text-xs font-semibold text-blue-700 underline">Open order</Link></td></tr>)}</tbody></table> : <p className="px-4 py-12 text-center text-sm text-slate-500">No tests match this worklist filter.</p>}</section>
  </main>;
}
