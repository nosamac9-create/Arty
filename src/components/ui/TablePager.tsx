/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Page state for a table.
 *
 * Paging is presentational only: `items` is never trimmed, so a record is
 * always reachable by turning the page rather than being dropped.
 *
 * The page resets whenever the number of rows changes, which covers both a
 * filter being applied and rows arriving or leaving live. It deliberately does
 * not reset on every new array identity — these lists are rebuilt by `useMemo`
 * on each data tick, and resetting there would snap staff back to page one
 * while they were reading page three.
 */
export function usePagination<T>(items: T[], perPage = 5) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));

  useEffect(() => {
    setPage(1);
  }, [items.length, perPage]);

  // Clamp rather than reset: deleting the last row of the last page should
  // step back a page, not jump to the front.
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * perPage, safePage * perPage),
    [items, safePage, perPage]
  );

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    from: items.length === 0 ? 0 : (safePage - 1) * perPage + 1,
    to: Math.min(safePage * perPage, items.length),
    total: items.length
  };
}

interface Props {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
  /** What the rows are, for the count line: "bookings", "pieces". */
  noun?: string;
}

/** Previous / Next with the range being shown. Hidden when there is one page. */
export const TablePager: React.FC<Props> = ({
  page, totalPages, from, to, total, onPage, noun = 'entries'
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-brand-clay/40">
      <p className="text-[11px] font-semibold text-brand-charcoal/55 ltr-numerals">
        Showing {from}–{to} of {total} {noun}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-1 rounded-xl border border-brand-clay bg-white px-3 py-1.5 text-[11px] font-bold text-brand-charcoal transition-colors hover:bg-brand-sand/50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Previous</span>
        </button>

        <span className="text-[11px] font-bold text-brand-charcoal/60 ltr-numerals">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="inline-flex items-center gap-1 rounded-xl border border-brand-clay bg-white px-3 py-1.5 text-[11px] font-bold text-brand-charcoal transition-colors hover:bg-brand-sand/50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
