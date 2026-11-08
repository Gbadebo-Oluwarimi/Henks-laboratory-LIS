
import Link from"next/link";
import {
  ArrowLeft,
  UserRoundPlus,
  CalendarDays,
  Phone,
  Mail,
  MapPin,
  UserRound,
} from"lucide-react";
import { createClient } from"@/app/actions";
import { getCurrentUser } from"@/lib/session";
import { pageError } from"@/lib/presentation";
import { DuplicatePatientDialog } from "@/app/(workspace)/clients/duplicate-patient-dialog";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const canRegister = Boolean(user);
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const duplicatePatient = errorCode === "duplicate-patient";
  const error = pageError(duplicatePatient ? undefined : errorCode);

  return (
    <main className="mx-auto max-w-4xl space-y-5">
      {duplicatePatient && <DuplicatePatientDialog />}
      {/* Page heading */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <Link
          href="/clients"
          className="inline-flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-[#079CC8]"
        >
          <ArrowLeft size={16} />
          Back to patients
        </Link>

        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center  border border-[#C8EEF9] bg-[#EAF9FE] text-[#073F9F]">
            <UserRoundPlus size={22} strokeWidth={1.7} />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">
              Patients / Registration
            </p>

            <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">
              New patient
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Enter the patient&apos;s details to create a new record.
            </p>
          </div>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className=" border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Registration form */}
      <section className="overflow-hidden  border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#073F9F]">
            Patient information
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Fields marked with <span className="text-red-500">*</span> are
            required.
          </p>
        </div>

        <form action={createClient} className="space-y-6 p-5">
          {/* Name */}
          <div>
            <label
              htmlFor="fullName"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Full name <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <UserRound
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Enter patient's full name"
                className="h-10 w-full  border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
              />
            </div>
          </div>

          {/* Contact and demographic details */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#073F9F]">
              Contact and personal details
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Date of birth */}
              <div>
                <label
                  htmlFor="dateOfBirth"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Date of birth
                </label>

                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    className="h-10 w-full  border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
                  />
                </div>
              </div>
{/* Sex */}
<div>
  <label
    htmlFor="sex"
    className="mb-1.5 block text-sm font-medium text-slate-700"
  >
    Sex
  </label>

  <select
    id="sex"
    name="sex"
    defaultValue=""
    className="h-10 w-full  border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
  >
    <option value="">Select sex</option>
    <option value="Female">Female</option>
    <option value="Male">Male</option>
    <option value="Other">Other</option>
  </select>
</div>
              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Phone number
                </label>

                <div className="relative">
                  <Phone
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    placeholder="Enter phone number"
                    className="h-10 w-full  border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="patient@example.com"
                    className="h-10 w-full  border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="address"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  House address
                </label>

                <div className="relative">
                  <MapPin
                    size={16}
                    className="pointer-events-none absolute left-3 top-3 text-slate-400"
                  />

                  <textarea
                    id="address"
                    name="address"
                    autoComplete="street-address"
                    rows={3}
                    maxLength={300}
                    placeholder="Enter patient's residential address"
                    className="w-full resize-y  border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Patient ID generation is handled by the registration process.
            </p>

            <div className="flex items-center justify-end gap-2">
              <Link
                href="/clients"
                className="inline-flex h-9 items-center justify-center  border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={!canRegister}
                className="inline-flex h-9 items-center justify-center gap-2 border border-blue-500 bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserRoundPlus size={16} />
                Register patient
              </button>
            </div>
          </div>
        </form>
      </section>

      {!canRegister && (
        <p className=" border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sign in to register a patient.
        </p>
      )}
    </main>
  );
}
