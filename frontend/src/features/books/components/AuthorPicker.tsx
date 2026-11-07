import { X } from "lucide-react";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks";

import { useAuthors } from "../hooks";
import type { Author } from "../types";

interface AuthorPickerProps {
  value: number[];
  onChange: (ids: number[]) => void;
  /** Authors already attached to the book (edit mode), so their names show before the list loads. */
  initialAuthors?: Author[];
  error?: string;
}

/** Multi-select as a searchable checkbox list. Selected authors stay visible as chips while the search changes. */
export function AuthorPicker({ value, onChange, initialAuthors = [], error }: AuthorPickerProps) {
  const [search, setSearch] = useState("");
  const query = useAuthors(useDebouncedValue(search, 300));

  // id -> name for every author seen so far, so chips survive a new search result set.
  const names = useRef(new Map<number, string>(initialAuthors.map((author) => [author.id, author.name])));
  for (const author of query.data?.results ?? []) names.current.set(author.id, author.name);

  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id]);
  }

  return (
    <fieldset aria-describedby={error ? "author_ids-error" : undefined} className="space-y-2">
      <legend className="text-sm font-medium">
        Authors
        <span aria-hidden className="text-destructive">
          {" "}
          *
        </span>
      </legend>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected authors">
          {value.map((id) => {
            const name = names.current.get(id) ?? `Author #${id}`;
            return (
              <li key={id} className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
                {name}
                <button type="button" aria-label={`Remove ${name}`} onClick={() => toggle(id)}>
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Input
        type="search"
        aria-label="Search authors"
        placeholder="Search authors"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">Loading authors…</p>
        ) : query.isError ? (
          <p className="text-sm text-destructive">Could not load authors.</p>
        ) : query.data.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No authors found.</p>
        ) : (
          query.data.results.map((author) => (
            <label key={author.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={value.includes(author.id)}
                onChange={() => toggle(author.id)}
              />
              {author.name}
            </label>
          ))
        )}
      </div>

      {error && (
        <p id="author_ids-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
