
import Link from"next/link";
import { notFound } from"next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FilePlus2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from"lucide-react";

import { updateClient } from"@/app/actions";
import { getDatabase } from"@/lib/mongodb";
import type { ClientRecord, LabOrder } from"@/lib/models";
import { formatDate, pageError } from"@/lib/presentation";
import { getCurrentUser } from "@/lib/session";
import { DeletePatientButton } from "@/app/(workspace)/clients/delete-patient-button";

export default async function ClientDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string | string[];
    notice?: string | string[];
  }>;
}) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const { ObjectId } = await import("mongodb");

  if (!ObjectId.isValid(id)) notFound();

  const database = await getDatabase();

  const client = await database
    .collection<ClientRecord>("clients")
    .findOne({ _id: new ObjectId(id) });

  if (!client) notFound();

  const [orders, orderCount, user] = await Promise.all([
    database.collection<LabOrder>("labOrders")
      .find({ clientId: client._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray(),
    database.collection<LabOrder>("labOrders").countDocuments({ clientId: client._id }),
    getCurrentUser(),
  ]);

  const error = pageError(
    Array.isArray(query.error) ? query.error[0] : query.error
  );

  const notice = Array.isArray(query.notice)
    ? query.notice[0]
    : query.notice;

  const statusStyles: Record<string, string> = {
    Completed:"bg-emerald-50 text-emerald-700",
"In Progress":"bg-blue-50 text-blue-700",
"Awaiting Review":"bg-amber-50 text-amber-700",
    Pending:"bg-slate-100 text-slate-600",
  };

  const inputClass =
"h-10 w-full  border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15";

  const labelClass =
"mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <main className="min-w-0 space-y-6 pb-8 text-slate-800">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-slate-500"
      >
        <Link
          href="/clients"
          className="hover:text-[#079CC8]"
        >
          Patients
        </Link>
        <span>/</span>
        <span className="text-slate-700">Patient details</span>
      </nav>

      {/* Page heading */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center  border border-[#D5E5F7] bg-[#F0F6FC] text-[#073F9F]">
            <UserRound size={21} />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">
              Patient record
            </p>

            <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900">
              {client.fullName}
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Patient ID: {client.patientId}
              <span className="mx-2 text-slate-300">|</span>
              Registered {formatDate(client.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link
            href={`/orders/new?clientId=${id}`}
            className="inline-flex h-10 items-center justify-center gap-2 bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-600"
          >
            <FilePlus2 size={15} />
            Create order
          </Link>
          {user?.role === "Administrator" && (
            <DeletePatientButton
              clientId={client._id.toHexString()}
              patientName={client.fullName}
              patientId={client.patientId}
              associatedOrderCount={orderCount}
            />
          )}
        </div>
      </header>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className=" border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2  border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <ShieldCheck size={16} />
          Patient details saved successfully.
        </div>
      )}

      {/* Patient summary */}
      <section className="overflow-hidden  border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Patient overview
          </h2>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0">
          <div className="flex items-start gap-3 px-4 py-3">
            <CalendarDays
              size={17}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <div>
              <p className="text-xs text-slate-500">Date of birth</p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {client.dateOfBirth ||"Not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3">
            <Phone
              size={17}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Phone number</p>
              <p className="mt-1 break-words text-sm font-medium text-slate-800">
                {client.phone ||"Not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3">
            <ClipboardList
              size={17}
              className="mt-0.5 shrink-0 text-slate-400"
            />
            <div>
              <p className="text-xs text-slate-500">
                Recent orders displayed
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {orders.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Edit patient details */}
      <section className="overflow-hidden  border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Patient information
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Update patient registration and contact details.
          </p>
        </div>

        <form action={updateClient}>
          <input
            type="hidden"
            name="clientId"
            value={id}
          />

          <div className="space-y-5 p-4 sm:p-5">
            {/* Personal information */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Personal information
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Patient ID</span>
                  <input
                    value={client.patientId}
                    readOnly
                    className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>
                    Full name <span className="text-red-600">*</span>
                  </span>
                  <input
                    name="fullName"
                    defaultValue={client.fullName}
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Enter full name"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Date of birth</span>
                  <input
                    name="dateOfBirth"
                    type="date"
                    defaultValue={client.dateOfBirth ??""}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Contact information */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact information
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Phone size={14} className="text-slate-400" />
                    Phone number
                  </span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={client.phone ??""}
                    maxLength={40}
                    autoComplete="tel"
                    placeholder="Enter phone number"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Mail size={14} className="text-slate-400" />
                    Email address
                  </span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={client.email ??""}
                    maxLength={254}
                    autoComplete="email"
                    placeholder="Enter email address"
                    className={inputClass}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <MapPin size={14} className="text-slate-400" />
                    House address
                  </span>
                  <textarea
                    name="address"
                    defaultValue={client.address ??""}
                    rows={2}
                    maxLength={300}
                    autoComplete="street-address"
                    placeholder="Enter residential address"
                    className="w-full resize-y  border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Form footer */}
          <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <Link
              href="/clients"
              className="inline-flex h-9 items-center justify-center gap-2  border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={15} />
              Back to patients
            </Link>

            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              <Save size={15} />
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Previous orders */}
      <section className="overflow-hidden  border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Previous laboratory orders
              <span className="ml-2  bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {orders.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              The 10 most recent orders for this patient.
            </p>
          </div>

          <Link
            href={`/orders/new?clientId=${id}`}
            className="inline-flex h-9 items-center justify-center gap-2 self-start  border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-[#0049B7] hover:bg-[#F5FBFE] hover:text-[#073F9F] sm:self-auto"
          >
            <FilePlus2 size={14} />
            New order
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ClipboardList
              size={25}
              className="mx-auto mb-3 text-slate-300"
            />
            <h3 className="text-sm font-medium text-slate-800">
              No laboratory orders yet
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Create an order to begin this patient{`&apos`}s laboratory history.
            </p>
            <Link
              href={`/orders/new?clientId=${id}`}
              className="mt-4 inline-flex h-9 items-center gap-2 bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600"
            >
              <FilePlus2 size={15} />
              Create order
            </Link>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                    Accession number
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Tests
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
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
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          href={`/orders/${orderId}`}
                          className="font-semibold text-[#073F9F] hover:text-[#079CC8]"
                        >
                          {order.accessionId}
                        </Link>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {order.tests.length}{""}
                        {order.tests.length === 1 ?"test" :"tests"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatDate(order.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center  px-2 py-1 text-[10px] font-medium ${
                            statusStyles[order.status] ??
"bg-slate-100 text-slate-600"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right sm:px-5">
                        <Link
                          href={`/orders/${orderId}`}
                          aria-label={`View order ${order.accessionId}`}
                          className="inline-flex h-8 items-center gap-1.5  px-2 text-xs font-semibold text-slate-600 transition hover:bg-[#EAF9FE] hover:text-[#073F9F]"
                        >
                          View
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {orders.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-[11px] text-slate-500">
              Showing {orders.length} recent{""}
              {orders.length === 1 ?"order" :"orders"}.
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck
          size={14}
          className="mt-0.5 shrink-0 text-[#073F9F]"
        />
        <p>
          Patient records should only be accessed and updated by
          authorized personnel.
        </p>
      </footer>
    </main>
  );
}
