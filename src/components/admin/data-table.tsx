import * as React from "react";
import { cn } from "@/lib/utils";
import { AdminEmptyState } from "./empty-state";

export interface AdminDataTableColumn<TRow> {
  /** Stable key — used for React row keying and aria-sort hooks. */
  key: string;
  /** Localized header label. */
  header: React.ReactNode;
  /** Render the cell for a single row. */
  cell: (row: TRow, index: number) => React.ReactNode;
  /** Optional className applied to both the <th> and <td>. */
  className?: string;
  /** Right-align numeric columns by default. */
  align?: "left" | "right" | "center";
}

export interface AdminDataTableProps<TRow> {
  rows: TRow[];
  columns: AdminDataTableColumn<TRow>[];
  /** Stable React key for each row. Defaults to row index (avoid for paginated data). */
  rowKey?: (row: TRow, index: number) => string;
  /** Rendered when `rows` is empty. */
  empty?: React.ReactNode;
  /** Optional caption (visually hidden by default). */
  caption?: React.ReactNode;
  className?: string;
}

/**
 * Generic, server-friendly data table for admin pages.
 *
 * Intentionally renderless re: data: callers feed it pre-sorted rows
 * and pre-built column descriptors. Sorting / pagination live above
 * this component (URL search-params in the page) so this stays a pure
 * presentation layer.
 */
export function AdminDataTable<TRow>({
  rows,
  columns,
  rowKey,
  empty,
  caption,
  className,
}: AdminDataTableProps<TRow>) {
  if (rows.length === 0) {
    return (
      <div className={className}>
        {empty ?? <AdminEmptyState title="—" />}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-3xl border border-foreground/10", className)}>
      <table className="min-w-full divide-y divide-foreground/10 text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-muted/40">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-xs font-medium uppercase tracking-wider text-foreground/55",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align !== "right" && col.align !== "center" && "text-left",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {rows.map((row, idx) => {
            const key = rowKey ? rowKey(row, idx) : String(idx);
            return (
              <tr key={key} className="hover:bg-foreground/5">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 align-top text-foreground/80",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className,
                    )}
                  >
                    {col.cell(row, idx)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
