
import Link from"next/link";
import {
  ClipboardList,
  Plus,
  ArrowRight,
  FlaskConical,
  Clock3,
  ClipboardCheck,
  ShieldCheck,
} from"lucide-react";
import { getDatabase } from"@/lib/mongodb";
import type { LabOrder } from"@/lib/models";
import { formatDate, statusClass } from"@/lib/presentation";
import { PaginationControls } from "@/app/(workspace)/pagination";
import { DeleteOrderButton } from "@/app/(workspace)/orders/delete-order-button";
import { getCurrentUser } from "@/lib/session";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const ORDERS_PER_PAGE = 10;
const ORDER_CREATED_TIME_FORMAT = new Intl.DateTimeFormat("en-NG", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; error?: string | string[]; notice?: string | string[] }>;
}) {
  const params = await searchParams;
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const [database, user] = await Promise.all([getDatabase(), getCurrentUser()]);
  const canDeleteOrders = user?.role === "Administrator";

  const orderCollection = database.collection<LabOrder>("labOrders");
  const [totalOrders, recentOrders] = await Promise.all([
    orderCollection.countDocuments(),
    orderCollection.find({}, { projection: { status: 1 } }).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalOrders / ORDERS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const orders = await orderCollection
    .find()
    .sort({ createdAt: -1 })
    .skip((currentPage - 1) * ORDERS_PER_PAGE)
    .limit(ORDERS_PER_PAGE)
    .toArray();

  const orderSummary = [
    { label:"Total orders", count: totalOrders, icon: ClipboardList, tone:"navy" },
    { label:"In progress", count: recentOrders.filter((order) => order.status ==="In Progress").length, icon: Clock3, tone:"blue" },
    { label:"Awaiting review", count: recentOrders.filter((order) => order.status ==="Awaiting Review").length, icon: ClipboardCheck, tone:"amber" },
    { label:"Completed", count: recentOrders.filter((order) => order.status ==="Completed").length, icon: ShieldCheck, tone:"green" },
  ];

  return (
    <main className="min-w-0 space-y-6 pb-8 text-slate-800">
      {notice === "order-deleted" && <ToastNotification message="Lab order deleted successfully." />}
      {error === "delete-failed" && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">The lab order could not be deleted. Please try again.</div>}
      {error === "missing" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">That lab order no longer exists.</div>}
      {error === "has-reagent-traceability" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">This order has reagent lot usage history and cannot be deleted.</div>}
      {error === "clinical-record-retained" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">This order has a released report and must be retained.</div>}
      {error === "specimen-history" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">This order has specimen records and cannot be deleted.</div>}
      {error === "invalid-delete" && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">The lab order could not be identified.</div>}
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center  border border-[#D5E5F7] bg-[#F0F6FC] text-[#073F9F]">
            <FlaskConical size={22} strokeWidth={1.8} />
          </div>
          <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">
            Workspace / Requests
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">
            Lab orders
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View laboratory requests, ordered tests, and processing status.
          </p>
          </div>
        </div>

        <Link
          href="/orders/new"
          className="inline-flex h-10 items-center justify-center gap-2 self-start border border-blue-500 bg-blue-500 px-4 text-sm font-semibold text-white transition hover:border-blue-600 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 sm:self-auto"
        >
          <Plus size={16} strokeWidth={2} color="white" />
         <span className="text-white">Create order</span>
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Recent order summary">
        {orderSummary.map(({ label, count, icon: Icon, tone }) => (
          <article key={label} className="flex min-w-0 items-center gap-3  border border-slate-200 bg-white px-4 py-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center  ${
              tone ==="blue" ?"bg-blue-50 text-blue-700" :
              tone ==="amber" ?"bg-amber-50 text-amber-700" :
              tone ==="green" ?"bg-emerald-50 text-emerald-700" :
"bg-[#EAF9FE] text-[#073F9F]"
            }`}>
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-500">{label}</p>
              <p className="mt-0.5 text-xl font-semibold leading-none tracking-tight text-[#073F9F]">{count}</p>
            </div>
          </article>
        ))}
      </section>

      {/* Orders directory */}
      <section className="overflow-hidden  border border-slate-200 bg-white">
        {/* Section heading */}
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#073F9F]">
                All orders
              </h2>

              <span className="inline-flex h-5 min-w-5 items-center justify-center  bg-[#EAF9FE] px-1.5 text-xs font-medium text-[#073F9F]">
                {totalOrders}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              All laboratory orders · 10 shown per page
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <FlaskConical size={15} />
            Laboratory requests
          </div>
        </div>

        {/* Empty state or order table */}
        {orders.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center  border border-slate-200 bg-white text-[#073F9F]">
              <ClipboardList size={20} strokeWidth={1.7} />
            </div>

            <h3 className="text-sm font-semibold text-[#073F9F]">
              No lab orders yet
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Choose a registered patient and select the required tests to
              create your first laboratory order.
            </p>

            <Link
              href="/orders/new"
              className="mt-4 inline-flex h-9 items-center justify-center gap-2 border border-blue-500 bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600"
            >
              <Plus size={15} />
              Create an order
            </Link>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Accession
                    </th>

                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Patient
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Tests
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Created
                    </th>

                    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Status
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const orderId = order._id.toHexString();

                    return (
                      <tr
                        key={orderId}
                        className="transition-colors hover:bg-[#F5FBFE]"
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            href={`/orders/${orderId}`}
                            className="inline-flex items-center  bg-[#F0F6FC] px-2.5 py-1.5 font-mono text-xs font-semibold tracking-wide text-[#073F9F] transition hover:bg-[#E2EFFB] hover:text-[#079CC8]"
                          >
                            {order.accessionId}
                          </Link>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">
                            {order.clientSnapshot.fullName}
                          </p>

                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {order.clientSnapshot.patientId}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          <span className="inline-flex min-w-7 items-center justify-center  border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                            {order.tests.length}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          <p>{formatDate(order.createdAt)}</p>
                          <p className="mt-1 text-xs text-slate-400">{ORDER_CREATED_TIME_FORMAT.format(new Date(order.createdAt))}</p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center  px-2 py-1 text-xs font-medium ${statusClass(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              href={`/orders/${orderId}`}
                              aria-label={`Open order ${order.accessionId}`}
                              className="inline-flex h-7 items-center justify-center gap-1.5 border border-slate-200 px-2.5 text-xs font-medium text-[#073F9F] transition-colors hover:border-[#0049B7] hover:bg-[#EAF9FE]"
                            >
                              Open
                              <ArrowRight size={13} />
                            </Link>
                            {canDeleteOrders && <DeleteOrderButton orderId={orderId} accessionId={order.accessionId} patientName={order.clientSnapshot.fullName} compact />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls basePath="/orders" currentPage={currentPage} totalItems={totalOrders} pageSize={ORDERS_PER_PAGE} itemLabel="orders" />
          </>
        )}
      </section>
    </main>
  );
}
