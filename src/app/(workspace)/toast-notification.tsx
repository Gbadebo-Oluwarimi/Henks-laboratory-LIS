"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function ToastNotification({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="toast-notification fixed right-4 top-4 z-[100] flex items-start gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 shadow-lg shadow-slate-900/10" role="status" aria-live="polite">
      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={19} />
      <p className="flex-1 text-sm font-medium leading-5 text-slate-800">{message}</p>
      <button className="-mr-1 -mt-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" type="button" onClick={() => setVisible(false)} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
}
