import Link from "next/link";
import { BellRing, Boxes, ClipboardList, FlaskConical, Settings2 } from "lucide-react";
import type { ReagentLotStatus } from "@/lib/models";

const statusTone: Record<ReagentLotStatus, string> = {
  QUARANTINED: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_VERIFICATION: "border-orange-200 bg-orange-50 text-orange-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  IN_USE: "border-blue-200 bg-blue-50 text-blue-800",
  EXHAUSTED: "border-slate-200 bg-slate-100 text-slate-600",
  EXPIRED: "border-rose-200 bg-rose-50 text-rose-800",
  DISPOSED: "border-slate-200 bg-slate-100 text-slate-600",
};

export function ReagentStatus({ status }: { status: ReagentLotStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide ${statusTone[status]}`}>{status.replaceAll("_", " ")}</span>;
}

export function ReagentHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">Laboratory / Reagent management</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </header>
  );
}

const links = [
  { href: "/reagents", label: "Dashboard", icon: Boxes },
  { href: "/reagents/definitions", label: "Reagents", icon: FlaskConical },
  { href: "/reagents/lots", label: "Lots & stock", icon: ClipboardList },
  { href: "/reagents/settings", label: "Settings", icon: Settings2 },
  { href: "/reagents?view=alerts", label: "Alerts", icon: BellRing },
];

export function ReagentTabs({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-2" aria-label="Reagent management sections">
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={label} href={href} aria-current={active === label ? "page" : undefined} className={`inline-flex h-9 items-center gap-2 px-3 text-xs font-medium transition ${active === label ? "border-b-2 border-blue-500 text-[#073F9F]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
          <Icon size={14} /> {label}
        </Link>
      ))}
    </nav>
  );
}

export const reagentInputClass = "mt-1 block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";
export const reagentLabelClass = "block text-xs font-medium text-slate-600";
export const reagentButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-500 px-3 text-xs font-semibold text-white hover:bg-blue-600";
export const reagentSecondaryButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50";

export function reagentErrorMessage(code: string | undefined): string | null {
  const messages: Record<string, string> = {
    forbidden: "Your account does not have permission for that reagent action.",
    validation: "Check the required fields and values, then try again.",
    "duplicate-department": "That department code already exists or could not be saved.",
    "duplicate-location": "That storage location code already exists or could not be saved.",
    "duplicate-reagent": "That reagent code already exists or could not be saved.",
    "duplicate-lot-or-save": "That lot number already exists for this reagent, or the receipt could not be saved.",
    "invalid-dates": "Expiry must be on or after receipt, and receipt cannot be in the future.",
    "invalid-reagent-or-location": "Choose an active reagent and storage location.",
    "missing-reagent": "The reagent could not be found.",
    "missing-department": "Choose an active laboratory department.",
    "department-in-use": "A department with active reagent definitions cannot be deactivated.",
    "location-in-use": "A storage location with historical reagent lots cannot be deactivated.",
    "missing-location": "Choose an active parent storage location.",
    "invalid-transition": "That lot cannot move to the requested lifecycle status.",
    "missing-verification": "Record verification before approving or rejecting this lot.",
    "lot-unusable": "This lot is expired, unavailable, quarantined, rejected, or out of stock.",
    "already-open": "This lot has already been opened.",
    "stock-adjustment-failed": "The adjustment failed. Check the available quantity and try again.",
    "usage-failed": "Usage could not be recorded. Check that enough approved stock remains.",
    "invalid-order": "Choose a valid laboratory order.",
    "invalid-order-test": "Choose a test included in the selected order.",
    "test-not-associated": "Associate this reagent with the test before recording linked usage.",
    "invalid-transfer": "That lot or destination is not available for transfer.",
    "disposal-failed": "The lot could not be disposed. Refresh and try again.",
    "missing-requirement-target": "Choose an active reagent and an existing catalogue test.",
    "duplicate-requirement": "That reagent is already associated with this test and role.",
    "missing-requirement": "The test requirement could not be found.",
    "requirement-has-history": "This test link has usage history and cannot be removed.",
  };
  return code ? messages[code] ?? null : null;
}
