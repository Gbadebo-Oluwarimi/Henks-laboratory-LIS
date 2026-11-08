
import Link from"next/link";
import { notFound } from"next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  UserRound,
  Droplets,
  Plus,
} from"lucide-react";

import { createOrder } from"@/app/actions";
import { getDatabase } from"@/lib/mongodb";
import type { ClientRecord } from"@/lib/models";
import type { CataloguePriceRecord, DepartmentRecord } from "@/lib/models";
import type { CatalogueTest } from "@/lib/catalogue";
import { pageError } from"@/lib/presentation";
import { PatientAutocomplete } from"@/app/(workspace)/orders/new/patient-autocomplete";
import { TestSelection, type OrderableCataloguePanel } from "@/app/(workspace)/orders/new/test-selection";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;

  const requestedClient = Array.isArray(params.clientId)
    ? params.clientId[0]
    : params.clientId;

  const error = pageError(
    Array.isArray(params.error) ? params.error[0] : params.error
  );

  const database = await getDatabase();

  const [clients, definitions, departments] = await Promise.all([
    database
      .collection<ClientRecord>("clients")
      .find()
      .sort({ fullName: 1 })
      .limit(500)
      .toArray(),

    database
      .collection<CatalogueTest & { enabled: boolean }>("testDefinitions")
      .find({ enabled: true, panelHeaderOnly: { $ne: true } })
      .toArray(),
    database.collection<DepartmentRecord>("departments").find({ active: true, departmentKind: { $ne: "ORDER_GROUP" } }).toArray(),
  ]);
  const activeDepartmentCodes = new Set(departments.map((department) => department.code));
  const orderableDefinitions = definitions.filter((test) => !test.departmentCode || activeDepartmentCodes.has(test.departmentCode));
  const definitionsByPanel = new Map<string, typeof orderableDefinitions>();
  for (const definition of orderableDefinitions) {
    definitionsByPanel.set(definition.panel, [...(definitionsByPanel.get(definition.panel) ?? []), definition]);
  }
  const panelDepartmentConflicts: string[] = [];
  const panelMap = new Map<string, OrderableCataloguePanel>();
  for (const [panel, panelDefinitions] of definitionsByPanel) {
    const departmentCodes = [...new Set(panelDefinitions.map((definition) => definition.departmentCode ?? "__unassigned__"))];
    if (departmentCodes.length !== 1) {
      panelDepartmentConflicts.push(panel);
      continue;
    }
    panelMap.set(panel, {
      panel,
      departmentCode: departmentCodes[0] === "__unassigned__" ? undefined : departmentCodes[0],
      resultFieldCount: panelDefinitions.length,
      subcategories: [...new Set(panelDefinitions.flatMap((definition) => definition.subcategory ? [definition.subcategory] : []))],
      specimenTypes: [...new Set(panelDefinitions.flatMap((definition) => definition.specimenType?.trim() ? [definition.specimenType.trim()] : []))],
    });
  }
  const priceHistory = await database.collection<CataloguePriceRecord>("cataloguePrices")
    .find({ effectiveFrom: { $lte: new Date() } })
    .sort({ effectiveFrom: -1 })
    .toArray();
  const currentPrices = new Map<string, CataloguePriceRecord>();
  for (const price of priceHistory) if (!currentPrices.has(price.panel)) currentPrices.set(price.panel, price);

  const prices = Object.fromEntries([...currentPrices.entries()].map(([panel, price]) => [panel, new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(price.amountMinor / 100)]));

  if (
    requestedClient &&
    !clients.some(
      (client) => client._id.toHexString() === requestedClient
    )
  ) {
    notFound();
  }

  const patientOptions = clients.map((client) => ({
    id: client._id.toHexString(),
    fullName: client.fullName,
    patientId: client.patientId,
  }));

  return (
    <main className="mx-auto min-w-0 max-w-4xl space-y-5 pb-8 text-slate-800">
      {/* Page heading */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <Link
          href="/orders"
          className="inline-flex w-fit items-center gap-2 text-sm text-slate-500 transition-colors hover:text-[#079CC8]"
        >
          <ArrowLeft size={16} />
          Back to lab orders
        </Link>

        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center  border border-[#C8EEF9] bg-[#EAF9FE] text-[#073F9F]">
            <ClipboardList size={22} strokeWidth={1.7} />
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">
              Lab orders / New
            </p>

            <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">
              Create order
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Select a patient and the laboratory tests required for their
              order.
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

      {/* No patient state */}
      {clients.length === 0 ? (
        <section className="flex min-h-64 flex-col items-center justify-center  border border-slate-200 bg-white px-5 py-10 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center  border border-slate-200 text-[#073F9F]">
            <UserRound size={21} />
          </div>

          <h2 className="text-sm font-semibold text-[#073F9F]">
            Register a patient first
          </h2>

          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Every laboratory order must be linked to a registered patient
            record.
          </p>

          <Link
            href="/clients/new"
            className="mt-4 inline-flex h-9 items-center gap-2 border border-blue-500 bg-blue-500 px-3 text-sm font-medium text-white hover:bg-blue-600"
          >
            <Plus size={15} />
            Register patient
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden  border border-slate-200 bg-white">
          {/* Form title */}
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#073F9F]">
              Order details
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Required fields are marked with{""}
              <span className="text-red-500">*</span>.
            </p>
          </div>

          <form action={createOrder} className="space-y-6 p-5">
            {/* Patient selection */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <UserRound size={17} className="text-[#073F9F]" />

                <h3 className="text-sm font-semibold text-slate-800">
                  Patient information
                </h3>
              </div>

              <div className=" border border-slate-200 bg-slate-50/50 p-4">
                <label
                  htmlFor="patient-search"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Select patient <span className="text-red-500">*</span>
                </label>

                <PatientAutocomplete
                  patients={patientOptions}
                  defaultPatientId={requestedClient}
                />

                <p className="mt-2 text-xs text-slate-500">
                  Search using the patient{`&apos`}s name or patient ID.
                </p>
              </div>
            </section>

            {panelDepartmentConflicts.length > 0 && <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Some panels have conflicting department assignments and are hidden until an administrator assigns one department to the whole panel in the <Link href="/catalogue" className="font-semibold underline">Test Catalogue</Link>: {panelDepartmentConflicts.join(", ")}.</div>}
            <TestSelection departments={departments.map((item) => ({ code: item.code, name: item.name }))} panels={[...panelMap.values()].sort((left, right) => left.panel.localeCompare(right.panel))} prices={prices} />

            {/* Specimen */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Droplets size={17} className="text-[#073F9F]" />

                <h3 className="text-sm font-semibold text-slate-800">
                  Specimen information
                </h3>

                <span className="text-xs font-normal text-slate-400">
                  Optional
                </span>
              </div>

              <label
                htmlFor="specimenType"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Default specimen / sample type
              </label>

              <input
                id="specimenType"
                name="specimenType"
                type="text"
                maxLength={120}
                placeholder="e.g. Whole blood, serum or urine"
                className="h-10 w-full  border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0049B7] focus:ring-2 focus:ring-[#0049B7]/15"
              />

              <p className="mt-1.5 text-xs text-slate-500">
                Enter a default specimen type if applicable. Individual tests
                can have their own specimen requirements.
              </p>
            </section>

            {/* Form actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Review your selections before creating the order.
              </p>

              <div className="flex items-center justify-end gap-2">
                <Link
                  href="/orders"
                  className="inline-flex h-9 items-center justify-center  border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={orderableDefinitions.length === 0}
                  className="inline-flex h-9 items-center justify-center gap-2 border border-blue-500 bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ClipboardList size={16} />
                  Create lab order
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
