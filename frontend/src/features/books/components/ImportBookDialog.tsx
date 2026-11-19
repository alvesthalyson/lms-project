import { useMemo, useState, type FormEvent } from "react";

import { toApiError } from "@/api/errors";
import { Spinner } from "@/components/Spinner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { countryName, flagOf, useWorld } from "@/features/home/globe/world";
import { toast } from "@/lib/toast";

import { useCategories, useImportBook, useLookupBooks } from "../hooks";
import type { BookCandidate, LookupMode } from "../types";

const MODES: { value: LookupMode; label: string; placeholder: string }[] = [
  { value: "isbn", label: "ISBN", placeholder: "978-0-13-235088-4" },
  { value: "title", label: "Title", placeholder: "Clean Code" },
  { value: "author", label: "Author", placeholder: "Machado de Assis" },
];

interface ImportBookDialogProps {
  onClose: () => void;
}

/**
 * Add books without typing them: search Open Library by ISBN, title or author, pick the right edition,
 * choose the category, how many copies and (for new authors) their nationality, and import.
 * The nationality is what puts the author's books on the Home globe.
 */
export function ImportBookDialog({ onClose }: ImportBookDialogProps) {
  const [mode, setMode] = useState<LookupMode>("title");
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<BookCandidate | null>(null);
  const lookup = useLookupBooks();

  const search = (event: FormEvent): void => {
    event.preventDefault();
    if (text.trim()) lookup.mutate({ mode, text });
  };

  const placeholder = MODES.find((m) => m.value === mode)?.placeholder;
  const error = lookup.isError ? toApiError(lookup.error) : null;
  const results = lookup.data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Open Library</DialogTitle>
          <DialogDescription>
            {chosen ? "Check the details, then add it to the catalogue." : "Search by ISBN, title or author and pick the edition to add."}
          </DialogDescription>
        </DialogHeader>

        {chosen ? (
          <ConfirmStep candidate={chosen} onBack={() => setChosen(null)} onDone={onClose} />
        ) : (
          <>
            <form className="flex flex-wrap items-end gap-2" onSubmit={search} role="search">
              <div className="space-y-1">
                <Label htmlFor="imp-mode">Search by</Label>
                <Select id="imp-mode" value={mode} onChange={(e) => setMode(e.target.value as LookupMode)} className="w-32">
                  {MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[12rem] flex-1 space-y-1">
                <Label htmlFor="imp-text">Search text</Label>
                <Input id="imp-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus />
              </div>
              <Button type="submit" disabled={!text.trim() || lookup.isPending}>
                Search
              </Button>
            </form>

            {lookup.isPending && <Spinner label="Searching Open Library…" />}
            {error && (
              <Alert variant="destructive" className="flex items-center justify-between gap-3">
                <span>{error.detail}</span>
                <Button size="sm" variant="outline" onClick={() => lookup.mutate({ mode, text })}>
                  Try again
                </Button>
              </Alert>
            )}
            {results && results.length === 0 && (
              <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                Nothing found. Check the spelling, or try the ISBN printed on the back cover.
              </p>
            )}
            {results && results.length > 0 && (
              <ul className="divide-y rounded-md border" aria-label="Search results">
                {results.map((candidate) => (
                  <li key={candidate.isbn} className="flex items-center gap-3 p-3">
                    {candidate.cover_url ? (
                      <img src={candidate.cover_url} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-sm object-cover shadow" />
                    ) : (
                      <div className="h-16 w-11 shrink-0 rounded-sm bg-muted" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{candidate.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {candidate.authors.join(", ") || "Unknown author"}
                        {candidate.publication_year ? ` · ${candidate.publication_year}` : ""}
                        {candidate.publisher ? ` · ${candidate.publisher}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">ISBN {candidate.isbn}</p>
                    </div>
                    {candidate.in_catalogue ? (
                      <Badge variant="secondary">Already in the catalogue</Badge>
                    ) : (
                      <Button size="sm" onClick={() => setChosen(candidate)} aria-label={`Choose ${candidate.title}`}>
                        Choose
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmStep({ candidate, onBack, onDone }: { candidate: BookCandidate; onBack: () => void; onDone: () => void }) {
  const categories = useCategories();
  const world = useWorld();
  const importBook = useImportBook();
  const [categoryId, setCategoryId] = useState<string>(candidate.suggested_category_id ? String(candidate.suggested_category_id) : "");
  const [copies, setCopies] = useState("1");
  const [country, setCountry] = useState("");

  const countries = useMemo(
    () =>
      Object.keys(world.data ?? {})
        .map((code) => ({ code, name: countryName(code, "en") }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [world.data],
  );

  const copiesNumber = Number(copies);
  const valid = categoryId !== "" && Number.isInteger(copiesNumber) && copiesNumber >= 0 && copiesNumber <= 500;
  const error = importBook.isError ? toApiError(importBook.error) : null;

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!valid) return;
    try {
      const saved = await importBook.mutateAsync({
        isbn: candidate.isbn,
        title: candidate.title,
        author_names: candidate.authors.length > 0 ? candidate.authors : ["Unknown author"],
        publisher: candidate.publisher,
        publication_year: candidate.publication_year,
        pages: candidate.pages,
        cover_url: candidate.cover_url,
        category_id: Number(categoryId),
        copies: copiesNumber,
        author_country: country,
      });
      toast.success(`"${saved.title}" was added.`);
      onDone();
    } catch {
      // shown by the alert below (importBook.isError)
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      <div className="flex items-start gap-3 rounded-md border p-3">
        {candidate.cover_url ? <img src={candidate.cover_url} alt="" className="h-24 w-16 rounded-sm object-cover shadow" /> : <div className="h-24 w-16 rounded-sm bg-muted" aria-hidden />}
        <div className="min-w-0">
          <p className="font-semibold">{candidate.title}</p>
          <p className="text-sm text-muted-foreground">{candidate.authors.join(", ") || "Unknown author"}</p>
          <p className="text-sm text-muted-foreground">
            {[candidate.publisher, candidate.publication_year, candidate.pages ? `${candidate.pages} pages` : ""].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">ISBN {candidate.isbn}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="imp-category">Category</Label>
          <Select id="imp-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!categories.isSuccess}>
            <option value="">Choose…</option>
            {categories.data?.results.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {candidate.suggested_category_id && categoryId === String(candidate.suggested_category_id) && (
            <p className="text-xs text-muted-foreground">Suggested from the book's subjects.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="imp-copies">Copies</Label>
          <Input id="imp-copies" type="number" min={0} max={500} value={copies} onChange={(e) => setCopies(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="imp-country">Author's country</Label>
          <Select id="imp-country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Unknown</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {flagOf(c.code)} {c.name}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Puts the book on the Home globe. Only used for new authors.</p>
        </div>
      </div>

      {error && <Alert variant="destructive">{error.fieldErrors.isbn?.[0] ?? error.detail}</Alert>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack} disabled={importBook.isPending}>
          Back
        </Button>
        <Button type="submit" disabled={!valid || importBook.isPending}>
          {importBook.isPending ? "Adding…" : "Add to catalogue"}
        </Button>
      </DialogFooter>
    </form>
  );
}
