import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { BOOK_ORDERINGS, DEFAULT_BOOK_FILTERS, type BookFilters } from "../filters";
import type { BookOrdering, Category } from "../types";

const SEARCH_DEBOUNCE_MS = 300;

interface BookFiltersBarProps {
  filters: BookFilters;
  categories: Category[];
  onChange: (patch: Partial<BookFilters>, options?: { replace?: boolean }) => void;
  onClear: () => void;
}

export function BookFiltersBar({ filters, categories, onChange, onClear }: BookFiltersBarProps) {
  // The input shows what the user typed; the URL (the source of truth) only updates after they pause.
  const [text, setText] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The timer may fire after other filters changed, so it must call the latest onChange, not the one it was created with.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // URL -> input: back/forward navigation or "Clear filters". Cancel a pending debounce so it cannot undo that.
  useEffect(() => {
    clearTimeout(timer.current);
    setText(filters.search);
  }, [filters.search]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleSearchChange(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // `replace`: typing should not add a history entry per keystroke pause.
      onChangeRef.current({ search: value }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  const isFiltered =
    filters.search.trim() !== "" ||
    filters.category !== null ||
    filters.availableOnly ||
    filters.ordering !== DEFAULT_BOOK_FILTERS.ordering;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[16rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search books"
          placeholder="Search by title, author, ISBN or publisher"
          className="pl-9"
          value={text}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
      </div>

      <Select
        aria-label="Category"
        className="w-48"
        value={filters.category ?? ""}
        onChange={(event) => onChange({ category: event.target.value ? Number(event.target.value) : null })}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Sort by"
        className="w-52"
        value={filters.ordering}
        onChange={(event) => onChange({ ordering: event.target.value as BookOrdering })}
      >
        {BOOK_ORDERINGS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <label className="flex h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={filters.availableOnly}
          onChange={(event) => onChange({ availableOnly: event.target.checked })}
        />
        Available now
      </label>

      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}
