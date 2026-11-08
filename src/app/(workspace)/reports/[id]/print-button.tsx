"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Printer, X } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const modernColorFunction = /\b(?:oklab|oklch|lab|lch|color-mix|color)\(/i;

function replaceModernColorFunctions(value: string, context: CanvasRenderingContext2D): string {
  const startPattern = /\b(?:oklab|oklch|lab|lch|color-mix|color)\(/ig;
  let output = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = startPattern.exec(value)) !== null) {
    const openParen = value.indexOf("(", match.index);
    let depth = 1;
    let end = openParen + 1;
    while (end < value.length && depth > 0) {
      if (value[end] === "(") depth += 1;
      if (value[end] === ")") depth -= 1;
      end += 1;
    }
    if (depth !== 0) break;

    output += value.slice(cursor, match.index);
    const colorFunction = value.slice(match.index, end);
    context.fillStyle = "#073F9F";
    const fallback = context.fillStyle;
    context.fillStyle = colorFunction;
    const resolved = context.fillStyle;
    output += resolved === fallback ? "#073F9F" : resolved;
    cursor = end;
    startPattern.lastIndex = end;
  }

  return output + value.slice(cursor);
}

function sanitizeStyle(style: CSSStyleDeclaration, context: CanvasRenderingContext2D): void {
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    const value = style.getPropertyValue(property);
    if (!modernColorFunction.test(value)) continue;

    const safeValue = replaceModernColorFunctions(value, context);
    style.setProperty(
      property,
      modernColorFunction.test(safeValue) ? "#073F9F" : safeValue,
      style.getPropertyPriority(property),
    );
  }
}

function sanitizeRules(
  rules: CSSRuleList,
  deleteRule: (index: number) => void,
  context: CanvasRenderingContext2D,
): void {
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    if (!rule) continue;

    if (
      "conditionText" in rule &&
      modernColorFunction.test(String((rule as CSSSupportsRule).conditionText))
    ) {
      deleteRule(index);
      continue;
    }

    if ("style" in rule) sanitizeStyle((rule as CSSStyleRule).style, context);

    if ("cssRules" in rule) {
      try {
        const groupingRule = rule as CSSGroupingRule;
        sanitizeRules(
          groupingRule.cssRules,
          (nestedIndex) => groupingRule.deleteRule(nestedIndex),
          context,
        );
      } catch {
        // Ignore cross-origin or otherwise inaccessible stylesheet groups.
      }
    }
  }
}

export function PrintButton({
  orderId,
  patientEmail,
  patientName,
  accessionId,
  isFinal,
}: {
  orderId: string;
  patientEmail: string;
  patientName: string;
  accessionId: string;
  isFinal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function sendReport() {
    if (!patientEmail || !isFinal || sending) return;
    setSending(true);
    setMessage("");
    setFailed(false);

    try {
      const sheet = document.getElementById("report-sheet");
      if (!sheet) throw new Error("The report preview could not be found.");
      await document.fonts.ready;
      const captureLayout: { current: {
        width: number;
        headerTop: number;
        headerHeight: number;
        rowBounds: Array<{ top: number; bottom: number }>;
      } | null } = { current: null };

      const canvas = await html2canvas(sheet, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: 2,
        useCORS: true,
        width: sheet.offsetWidth,
        windowWidth: Math.max(document.documentElement.clientWidth, sheet.offsetWidth),
        onclone(clonedDocument) {
          const colorCanvas = clonedDocument.createElement("canvas");
          const colorContext = colorCanvas.getContext("2d");

          if (colorContext) {
            for (const stylesheet of Array.from(clonedDocument.styleSheets)) {
              try {
                const mutableStylesheet = stylesheet as CSSStyleSheet;
                sanitizeRules(
                  mutableStylesheet.cssRules,
                  (index) => mutableStylesheet.deleteRule(index),
                  colorContext,
                );
              } catch {
                // Ignore cross-origin stylesheets; the report styles are same-origin.
              }
            }

            for (const element of Array.from(clonedDocument.querySelectorAll<HTMLElement>("[style]"))) {
              sanitizeStyle(element.style, colorContext);
            }
          }

          const clonedSheet = clonedDocument.getElementById("report-sheet");
          const viewport = clonedSheet?.parentElement;
          if (!clonedSheet) return;
          clonedSheet.style.transform = "none";
          clonedSheet.style.marginLeft = "0";
          clonedSheet.style.width = "210mm";
          clonedSheet.style.maxWidth = "none";
          clonedSheet.style.minHeight = "0";
          if (viewport) {
            viewport.style.width = "210mm";
            viewport.style.maxWidth = "none";
            viewport.style.height = "auto";
            viewport.style.overflow = "visible";
          }

          const results = clonedSheet.querySelector<HTMLElement>(".report-results");
          const table = clonedSheet.querySelector<HTMLTableElement>(".report-table");
          if (results) results.style.overflow = "visible";
          if (table) {
            table.style.width = "100%";
            table.style.maxWidth = "100%";
            table.style.minWidth = "0";
            table.style.boxSizing = "border-box";
            table.style.setProperty("font-size", "10px", "important");
            table.style.setProperty("line-height", "1.1", "important");
            for (const cell of Array.from(table.querySelectorAll<HTMLElement>("th, td"))) {
              cell.style.setProperty("font-size", "10px", "important");
              cell.style.setProperty("line-height", "1.1", "important");
              cell.style.setProperty("padding", "0.75px 2px", "important");
            }
            for (const cell of Array.from(table.querySelectorAll<HTMLElement>("th:first-child, td:first-child"))) {
              cell.style.setProperty("padding-left", "3px", "important");
            }
          }

          const authorisation = clonedSheet.querySelector<HTMLElement>(".report-authorisation");
          if (authorisation) {
            authorisation.style.setProperty("margin-top", "8mm", "important");
            authorisation.style.setProperty("padding-top", "3mm", "important");
          }

          const sheetBounds = clonedSheet.getBoundingClientRect();
          const headerRow = table?.querySelector("thead tr");
          const headerBounds = headerRow?.getBoundingClientRect();
          captureLayout.current = {
            width: sheetBounds.width,
            headerTop: headerBounds ? headerBounds.top - sheetBounds.top : 0,
            headerHeight: headerBounds?.height ?? 0,
            rowBounds: Array.from(table?.querySelectorAll("tbody tr") ?? []).map((row) => {
              const bounds = row.getBoundingClientRect();
              return { top: bounds.top - sheetBounds.top, bottom: bounds.bottom - sheetBounds.top };
            }),
          };
        },
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      const layout = captureLayout.current;
      const pixelsPerCssPixel = layout ? canvas.width / layout.width : 1;
      const pageHeightPixels = Math.floor((canvas.width * pageHeight) / pageWidth);
      const repeatedHeaderTop = Math.round((layout?.headerTop ?? 0) * pixelsPerCssPixel);
      const repeatedHeaderHeight = Math.round((layout?.headerHeight ?? 0) * pixelsPerCssPixel);
      const rowBounds = (layout?.rowBounds ?? []).map((row) => ({
        top: Math.round(row.top * pixelsPerCssPixel),
        bottom: Math.round(row.bottom * pixelsPerCssPixel),
      }));

      let sourceTop = 0;
      let pageIndex = 0;
      while (sourceTop < canvas.height) {
        const headerOffset = pageIndex === 0 ? 0 : repeatedHeaderHeight;
        const availableHeight = pageHeightPixels - headerOffset;
        const desiredBottom = Math.min(canvas.height, sourceTop + availableHeight);
        let sourceBottom = desiredBottom;

        if (desiredBottom < canvas.height) {
          const safeRows = rowBounds.filter((row) => row.bottom > sourceTop && row.bottom <= desiredBottom);
          if (safeRows.length > 0) {
            sourceBottom = safeRows[safeRows.length - 1]!.bottom;
          } else {
            const nextRow = rowBounds.find((row) => row.bottom > sourceTop);
            if (nextRow) sourceBottom = nextRow.bottom;
          }
        }

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightPixels;
        const pageContext = pageCanvas.getContext("2d");
        if (!pageContext) throw new Error("The report PDF page could not be prepared.");
        pageContext.fillStyle = "#ffffff";
        pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        if (pageIndex > 0 && repeatedHeaderHeight > 0) {
          pageContext.drawImage(
            canvas,
            0,
            repeatedHeaderTop,
            canvas.width,
            repeatedHeaderHeight,
            0,
            0,
            canvas.width,
            repeatedHeaderHeight,
          );
        }
        pageContext.drawImage(
          canvas,
          0,
          sourceTop,
          canvas.width,
          sourceBottom - sourceTop,
          0,
          headerOffset,
          canvas.width,
          sourceBottom - sourceTop,
        );

        if (pageIndex > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        sourceTop = sourceBottom;
        pageIndex += 1;
      }

      const pdfBlob = pdf.output("blob");
      const formData = new FormData();
      formData.append("pdf", pdfBlob, `${accessionId}-report.pdf`);
      const response = await fetch(`/api/reports/${encodeURIComponent(orderId)}/email`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json() as { error?: string; success?: boolean };
      if (!response.ok || !result.success) throw new Error(result.error || "The report email could not be sent.");

      setMessage(`PDF report sent to ${patientEmail}.`);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The report email could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button className="button button-secondary report-print-button" type="button" onClick={() => window.print()}>
          <Printer size={16} /> Print / Save PDF
        </button>
        <button
          className="button button-primary cursor-not-allowed opacity-50"
          type="button"
          disabled
          title="Email reports are temporarily unavailable"
        >
          <Mail size={16} /> Email PDF
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setOpen(false); }}>
          <section className="w-full max-w-md border border-slate-200 bg-white p-5" role="dialog" aria-modal="true" aria-labelledby="report-email-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-600">REPORT DELIVERY</p>
                <h2 id="report-email-title" className="mt-1 text-lg font-semibold text-[#073F9F]">Send report PDF</h2>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-700" type="button" aria-label="Close dialog" onClick={() => setOpen(false)} disabled={sending}><X size={19} /></button>
            </div>

            <p className="mt-4 text-sm leading-5 text-slate-600">
              Send the authorized PDF report for <strong className="text-slate-800">{patientName}</strong> ({accessionId}) to:
            </p>
            <div className="mt-3 border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800">
              {patientEmail || "No email address is saved on this patient record."}
            </div>

            {!isFinal && <p className="mt-3 text-xs text-amber-700">Only an authorized final report can be emailed.</p>}
            {message && (
              <p className={`mt-3 flex items-center gap-2 text-sm ${failed ? "text-red-700" : "text-emerald-700"}`} role={failed ? "alert" : "status"}>
                {!failed && <CheckCircle2 size={16} />}{message}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button className="button button-secondary" type="button" onClick={() => setOpen(false)} disabled={sending}>Close</button>
              <button className="button button-primary" type="button" onClick={sendReport} disabled={sending || !patientEmail || !isFinal}>
                <Mail size={15} /> {sending ? "Preparing and sending…" : "Send PDF report"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
