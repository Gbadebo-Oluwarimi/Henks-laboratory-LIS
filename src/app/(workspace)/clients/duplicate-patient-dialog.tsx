"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

export function DuplicatePatientDialog() {
  const [open, setOpen] = useState(true);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="w-full max-w-md min-w-0 overflow-hidden border border-amber-200 bg-white p-5" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-patient-title" aria-describedby="duplicate-patient-description">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-200 bg-amber-50 text-amber-700"><AlertTriangle size={19} /></span>
            <div className="min-w-0">
              <h2 id="duplicate-patient-title" className="text-lg font-semibold text-slate-900">Patient already registered</h2>
              <p className="mt-1 text-xs text-slate-500">No new patient record was created.</p>
            </div>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-700" type="button" aria-label="Close duplicate patient message" onClick={() => setOpen(false)}><X size={19} /></button>
        </div>
        <p id="duplicate-patient-description" className="mt-4 text-sm leading-6 text-slate-600" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
          A patient with the same name and matching date of birth or contact details is already in the system. Review the registered patients before creating another record.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button className="inline-flex h-9 w-full items-center justify-center border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto" type="button" onClick={() => setOpen(false)}>Back to form</button>
          <Link className="inline-flex h-9 w-full items-center justify-center border border-blue-500 bg-blue-500 px-3 text-sm font-semibold text-white hover:bg-blue-600 sm:w-auto" href="/clients">View patients</Link>
        </div>
      </section>
    </div>,
    document.body,
  );
}
