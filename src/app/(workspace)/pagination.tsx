import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function PaginationControls({
  basePath,
  currentPage,
  totalItems,
  pageSize = 10,
  query = {},
  itemLabel,
}: {
  basePath: string;
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  query?: Record<string, string | undefined>;
  itemLabel: string;
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        Showing <strong className="font-semibold text-slate-700">{start}–{end}</strong> of {totalItems} {itemLabel}
      </p>
      <nav className="flex items-center gap-2" aria-label={`${itemLabel} pages`}>
        {currentPage > 1 ? (
          <Link href={href(currentPage - 1)} className="inline-flex h-8 items-center gap-1 border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <ArrowLeft size={13} /> Previous
          </Link>
        ) : (
          <span aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center gap-1 border border-slate-100 bg-slate-50 px-3 text-xs font-medium text-slate-400">
            <ArrowLeft size={13} /> Previous
          </span>
        )}
        <span className="min-w-20 text-center text-xs font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
        {currentPage < totalPages ? (
          <Link href={href(currentPage + 1)} className="inline-flex h-8 items-center gap-1 bg-blue-500 px-3 text-xs font-medium text-white hover:bg-blue-600">
            Next 10 <ArrowRight size={13} />
          </Link>
        ) : (
          <span aria-disabled="true" className="inline-flex h-8 cursor-not-allowed items-center gap-1 bg-slate-100 px-3 text-xs font-medium text-slate-400">
            Next 10 <ArrowRight size={13} />
          </span>
        )}
      </nav>
    </footer>
  );
}
