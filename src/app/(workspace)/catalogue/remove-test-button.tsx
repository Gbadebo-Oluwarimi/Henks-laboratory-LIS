"use client";

import { useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { AlertTriangle, ToggleLeft, X } from "lucide-react";
import { toggleCatalogueTest } from "@/app/actions";

function ConfirmRemoveButton() {
  const { pending } = useFormStatus();

  return (
    <button className="inline-flex h-9 w-full items-center justify-center gap-2 border border-amber-700 bg-amber-700 px-3 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto" type="submit" disabled={pending}>
      <ToggleLeft size={14} /> {pending ? "Removing…" : "Remove test"}
    </button>
  );
}

export function RemoveCatalogueTestButton({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="inline-flex h-6 w-7 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-800" type="button" onClick={() => setOpen(true)} title="Remove from future orders" aria-label={`Remove ${name} from future orders`}>
        <ToggleLeft size={13} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="w-full max-w-md min-w-0 overflow-hidden border border-slate-200 bg-white p-5" role="alertdialog" aria-modal="true" aria-labelledby="remove-test-title" aria-describedby="remove-test-description">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-200 bg-amber-50 text-amber-700"><AlertTriangle size={19} /></span>
                <div className="min-w-0">
                  <h2 id="remove-test-title" className="text-lg font-semibold text-slate-900">Remove test from catalogue?</h2>
                  <p className="mt-1 text-xs text-slate-500">It will no longer be available for new orders.</p>
                </div>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-700" type="button" aria-label="Close confirmation" onClick={() => setOpen(false)}><X size={19} /></button>
            </div>
            <div id="remove-test-description" className="mt-4 min-w-0 text-sm leading-6 text-slate-600" style={{ overflowWrap: "anywhere" }}>
              <p className="m-0 max-w-full" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>Remove this test from future orders?</p>
              <dl className="mt-3 grid min-w-0 gap-2 border-t border-slate-100 pt-3">
                <div className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-2">
                  <dt className="text-slate-500">Test</dt>
                  <dd className="m-0 min-w-0 font-semibold text-slate-900" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{name}</dd>
                </div>
              </dl>
              <p className="mt-3 mb-0 max-w-full text-xs" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>Existing orders and reports will remain unchanged.</p>
            </div>
            <form action={toggleCatalogueTest} className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row">
              <input type="hidden" name="code" value={code} />
              <button className="inline-flex h-9 w-full items-center justify-center border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <ConfirmRemoveButton />
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
