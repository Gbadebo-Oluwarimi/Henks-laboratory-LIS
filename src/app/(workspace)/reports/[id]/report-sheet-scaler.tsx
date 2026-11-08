"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function ReportSheetScaler({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const sheet = viewport?.querySelector<HTMLElement>(".report-sheet");
    if (!viewport || !sheet) return;

    const fitSheet = () => {
      const sheetWidth = sheet.offsetWidth;
      const availableWidth = viewport.clientWidth;
      if (!sheetWidth || !availableWidth) return;

      const scale = Math.min(1, availableWidth / sheetWidth);
      sheet.style.transform = `scale(${scale})`;
      sheet.style.marginLeft = `${(availableWidth - sheetWidth * scale) / 2}px`;
      viewport.style.height = `${sheet.offsetHeight * scale}px`;
    };

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(fitSheet)
      : null;
    observer?.observe(viewport);
    observer?.observe(sheet);
    fitSheet();

    if (!observer) {
      window.addEventListener("resize", fitSheet);
      window.addEventListener("orientationchange", fitSheet);
    }

    return () => {
      observer?.disconnect();
      if (!observer) {
        window.removeEventListener("resize", fitSheet);
        window.removeEventListener("orientationchange", fitSheet);
      }
    };
  }, []);

  return (
    <div className="report-sheet-viewport" ref={viewportRef}>
      {children}
    </div>
  );
}
