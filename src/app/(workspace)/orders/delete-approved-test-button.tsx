"use client";

import { useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteApprovedOrderTest } from "@/app/actions";

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button className="inline-flex h-9 w-full items-center justify-center gap-2 border border-red-700 bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto" type="submit" disabled={pending}>
      <Trash2 size={14} /> {pending ? "Deleting…" : "Delete test"}
    </button>
  );
}

export function DeleteApprovedTestButton({
  orderId,
  testCode,
  testName,
}: {
  orderId: string;
  testCode: string;
  testName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="lis-button border-red-200 text-red-700 hover:bg-red-50" type="button" onClick={() => setOpen(true)} aria-label={`Delete approved test ${testName}`} title="Delete approved test">
        <Trash2 size={14} /> Delete test
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="w-full max-w-md min-w-0 overflow-hidden border border-slate-200 bg-white p-5" role="alertdialog" aria-modal="true" aria-labelledby="delete-approved-test-title" aria-describedby="delete-approved-test-description">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-red-700"><AlertTriangle size={19} /></span>
                <div className="min-w-0">
                  <h2 id="delete-approved-test-title" className="text-lg font-semibold text-slate-900">Delete approved test?</h2>
                  <p className="mt-1 text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-700" type="button" aria-label="Close deletion dialog" onClick={() => setOpen(false)}><X size={19} /></button>
            </div>
            <div id="delete-approved-test-description" className="mt-4 min-w-0 text-sm leading-6 text-slate-600" style={{ overflowWrap: "anywhere" }}>
              <p className="m-0" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>Remove this approved test and its result from this order?</p>
              <dl className="mt-3 grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-3">
                <dt className="text-slate-500">Test</dt>
                <dd className="m-0 min-w-0 font-semibold text-slate-900" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{testName}</dd>
              </dl>
            </div>
            <form action={deleteApprovedOrderTest} className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row">
              <input type="hidden" name="orderId" value={orderId} />
              <input type="hidden" name="testCode" value={testCode} />
              <button className="inline-flex h-9 w-full items-center justify-center border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <ConfirmDeleteButton />
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
