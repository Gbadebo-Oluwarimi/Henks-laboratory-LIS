"use client";

import { Printer } from "lucide-react";

export function PrintLabelButton() {
  return <button className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 print:hidden" type="button" onClick={() => window.print()}><Printer className="mr-1 inline" size={14} />Print label</button>;
}
