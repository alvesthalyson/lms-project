import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

interface PaginationProps {
  page: number;
  totalPages: number;
  count: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the page-size selector. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  disabled?: boolean;
}

export function Pagination({
  page,
  totalPages,
  count,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  disabled = false,
}: PaginationProps) {
  const first = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, count);

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {count === 0 ? "No results" : `Showing ${first}–${last} of ${count}`}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Per page
            <Select
              aria-label="Items per page"
              className="h-9 w-20"
              value={pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        )}

        <span className="text-sm">
          Page {page} of {Math.max(totalPages, 1)}
        </span>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
