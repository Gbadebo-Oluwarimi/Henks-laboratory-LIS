
import Link from"next/link";
import { Search, UserRoundPlus, ArrowRight, Users, UserRound } from"lucide-react";
import { getDatabase } from"@/lib/mongodb";
import type { ClientRecord } from"@/lib/models";
import { escapeRegex, formatDate } from"@/lib/presentation";
import { PaginationControls } from "@/app/(workspace)/pagination";
import { getCurrentUser } from "@/lib/session";
import { DeletePatientButton } from "@/app/(workspace)/clients/delete-patient-button";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const PATIENTS_PER_PAGE = 10;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[]; notice?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q)
    ? params.q[0] ??""
    : params.q ??"";

  const searchTerm = query.trim().slice(0, 80);
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const [database, user] = await Promise.all([getDatabase(), getCurrentUser()]);
  const canDeletePatients = user?.role === "Administrator";
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  const filter = searchTerm
    ? {
        $or: [
          {
            fullName: {
              $regex: escapeRegex(searchTerm),
              $options:"i",
            },
          },
          {
            patientId: {
              $regex: escapeRegex(searchTerm),
              $options:"i",
            },
          },
        ],
      }
    : {};

  const clientCollection = database.collection<ClientRecord>("clients");
  const totalPatients = await clientCollection.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(totalPatients / PATIENTS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const clients = await clientCollection
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((currentPage - 1) * PATIENTS_PER_PAGE)
    .limit(PATIENTS_PER_PAGE)
    .toArray();
  const orderCounts = canDeletePatients && clients.length > 0
    ? await database.collection("labOrders").aggregate<{ _id: ClientRecord["_id"]; count: number }>([
        { $match: { clientId: { $in: clients.map((client) => client._id) } } },
        { $group: { _id: "$clientId", count: { $sum: 1 } } },
      ]).toArray()
    : [];
  const orderCountByClientId = new Map(orderCounts.map((item) => [item._id.toHexString(), item.count]));

  return (
    <main className="space-y-6 pb-8">
      {notice === "patient-deleted" && <ToastNotification message="Patient and associated lab records deleted." />}
      {error === "delete-failed" && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">The patient could not be deleted. Please try again.</div>}
      {error === "missing" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">That patient record no longer exists.</div>}
      {error === "has-reagent-traceability" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">This patient has order records with reagent lot traceability and cannot be deleted.</div>}
      {error === "clinical-record-retained" && <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">This patient has released reports or specimen history and cannot be deleted.</div>}
      {error === "invalid-delete" && <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">The patient record could not be identified.</div>}
      {/* Page heading */}
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center  border border-[#D5E5F7] bg-[#F0F6FC] text-[#073F9F]">
            <Users size={22} strokeWidth={1.8} />
          </div>
          <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">
            Workspace / Records
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">
            Patients
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Search and manage registered patient records.
          </p>
          </div>
        </div>

        <Link
          href="/clients/new"
          className="inline-flex h-10  items-center justify-center gap-2 self-start border border-blue-500 bg-blue-500 px-4 text-sm font-semibold transition hover:border-blue-600 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 sm:self-auto"
        >
          <UserRoundPlus size={16} strokeWidth={1.8} color="white" />
          <span className="text-white">New patient</span>
        </Link>
      </header>

      {/* Patient directory */}
      <section className="overflow-hidden  border border-slate-200 bg-white">
        {/* Directory heading */}
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#073F9F]">
                Patient directory
              </h2>

              <span className="inline-flex h-5 min-w-5 items-center justify-center  bg-[#EAF9FE] px-1.5 text-xs font-medium text-[#073F9F]">
                {totalPatients}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {searchTerm
                ? `Results matching "${searchTerm}"`
                :"All registered patient records"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users size={15} />
            Patient records
          </div>
        </div>

        {/* Search */}
        <form
          action="/clients"
          method="get"
          className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-center"
        >
          <label className="relative block min-w-0 flex-1">
            <Search
              size={16}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search patient name or ID..."
              aria-label="Search patients by name or patient ID"
              className="h-9 w-full  border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-2 border border-blue-500 bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <Search size={15} />
              Search
            </button>

            {searchTerm && (
              <Link
                href="/clients"
                className="inline-flex h-9 items-center justify-center  border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        {/* Patient table */}
        {clients.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center  border border-slate-200 bg-white text-[#073F9F]">
              {searchTerm ? (
                <Search size={19} strokeWidth={1.7} />
              ) : (
                <Users size={19} strokeWidth={1.7} />
              )}
            </div>

            <h3 className="text-sm font-semibold text-[#073F9F]">
              {searchTerm
                ?"No matching patients"
                :"No patients registered"}
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {searchTerm
                ?"Try another patient name or ID."
                :"Register your first patient to begin managing laboratory records."}
            </p>

            {!searchTerm && (
              <Link
                href="/clients/new"
                className="mt-4 inline-flex h-9 items-center gap-2 border border-blue-500 bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600"
              >
                <UserRoundPlus size={15} />
                New patient
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Patient
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Patient ID
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Date of birth
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Registered
                    </th>
                    <th className="w-40 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-[#073F9F]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr
                      key={client._id.toHexString()}
                      className="transition-colors hover:bg-[#F5FBFE]"
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center  bg-[#EAF9FE] text-xs font-bold uppercase text-[#073F9F]">
                            {client.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || <UserRound size={15} />}
                          </span>
                          <Link
                            href={`/clients/${client._id.toHexString()}`}
                            className="font-semibold text-slate-800 hover:text-[#079CC8]"
                          >
                            {client.fullName}
                          </Link>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                        {client.patientId}
                      </td>

                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {client.dateOfBirth ||"Not recorded"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {formatDate(client.createdAt)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/clients/${client._id.toHexString()}`}
                          aria-label={`View ${client.fullName}`}
                          className="inline-flex h-7 items-center gap-1  border border-slate-200 px-2 text-xs font-medium text-[#073F9F] hover:border-[#0049B7] hover:bg-[#EAF9FE]"
                        >
                          View
                          <ArrowRight size={13} />
                        </Link>
                        {canDeletePatients && (
                          <DeletePatientButton
                            clientId={client._id.toHexString()}
                            patientName={client.fullName}
                            patientId={client.patientId}
                            associatedOrderCount={orderCountByClientId.get(client._id.toHexString()) ?? 0}
                          />
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaginationControls basePath="/clients" currentPage={currentPage} totalItems={totalPatients} pageSize={PATIENTS_PER_PAGE} query={{ q: searchTerm || undefined }} itemLabel="patients" />
          </>
        )}
      </section>
    </main>
  );
}
