"use client";

import { useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteClient } from "@/app/actions";

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex h-9 w-full items-center justify-center gap-2 border border-red-700 bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      type="submit"
      disabled={pending}
    >
      <Trash2 size={15} /> {pending ? "Deleting…" : "Delete patient"}
    </button>
  );
}

export function DeletePatientButton({
  clientId,
  patientName,
  patientId,
  associatedOrderCount,
}: {
  clientId: string;
  patientName: string;
  patientId: string;
  associatedOrderCount: number;
}) {
  const [open, setOpen] = useState(false);
  const recordLabel = `${associatedOrderCount} associated lab ${associatedOrderCount === 1 ? "record" : "records"}`;

  return (
    <>
      <button
        className="inline-flex h-7 items-center gap-1 border border-red-200 px-2 text-xs font-medium text-red-700 hover:bg-red-50"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete patient ${patientName}`}
      >
        <Trash2 size={13} /> Delete
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="w-full max-w-md min-w-0 overflow-hidden border border-slate-200 bg-white p-5"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-patient-title"
            aria-describedby="delete-patient-description"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-red-200 bg-red-50 text-red-700">
                  <AlertTriangle size={19} />
                </span>
                <div className="min-w-0">
                  <h2 id="delete-patient-title" className="text-lg font-semibold text-slate-900">Delete patient record?</h2>
                  <p className="mt-1 text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>
              <button
                className="p-1 text-slate-400 hover:text-slate-700"
                type="button"
                aria-label="Close deletion dialog"
                onClick={() => setOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div id="delete-patient-description" className="mt-4 min-w-0 text-sm leading-6 text-slate-600" style={{ overflowWrap: "anywhere" }}>
              <p className="m-0 max-w-full" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>You are about to permanently delete this patient and their associated lab records and reports.</p>
              <dl className="mt-3 grid min-w-0 gap-2 border-t border-slate-100 pt-3">
                <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-slate-500">Patient</dt>
                  <dd className="m-0 min-w-0 font-semibold text-slate-900" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{patientName}</dd>
                </div>
                <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-slate-500">Patient ID</dt>
                  <dd className="m-0 min-w-0 font-semibold text-slate-900" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{patientId}</dd>
                </div>
                <div className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-slate-500">Records</dt>
                  <dd className="m-0 min-w-0" style={{ overflowWrap: "anywhere" }}>{recordLabel}, including reports</dd>
                </div>
              </dl>
            </div>

            <form action={deleteClient} className="mt-5 flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row">
              <input type="hidden" name="clientId" value={clientId} />
              <button
                className="inline-flex h-9 w-full items-center justify-center border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <ConfirmDeleteButton />
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
