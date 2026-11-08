import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBooks } from "@/features/books/hooks";
import { useUsers } from "@/features/users/hooks";
import { useDebouncedValue } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

import { useCreateLoan } from "../hooks";

interface Picked {
  id: number;
  label: string;
}

function Picker({
  label,
  placeholder,
  picked,
  onPick,
  onClear,
  options,
  loading,
  term,
  onTerm,
}: {
  label: string;
  placeholder: string;
  picked: Picked | null;
  onPick: (value: Picked) => void;
  onClear: () => void;
  options: Picked[];
  loading: boolean;
  term: string;
  onTerm: (value: string) => void;
}) {
  if (picked) {
    return (
      <div className="space-y-1">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>{picked.label}</span>
          <Button type="button" size="sm" variant="ghost" aria-label={`Change ${label.toLowerCase()}`} onClick={onClear}>
            Change
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={`pick-${label}`}>
        {label}
      </label>
      <Input id={`pick-${label}`} placeholder={placeholder} value={term} onChange={(e) => onTerm(e.target.value)} />
      {term.trim().length >= 2 && (
        <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-sm" aria-label={`${label} results`}>
          {loading && options.length === 0 ? (
            <li className="p-2 text-muted-foreground">Searching…</li>
          ) : options.length === 0 ? (
            <li className="p-2 text-muted-foreground">No matches.</li>
          ) : (
            options.map((option) => (
              <li key={option.id}>
                <button type="button" className="w-full p-2 text-left hover:bg-accent" onClick={() => onPick(option)}>
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

/** Loan desk: pick a member and an available title; the API chooses the copy. Staff only. */
export function NewLoanModal({ onClose }: { onClose: () => void }) {
  const [memberTerm, setMemberTerm] = useState("");
  const [bookTerm, setBookTerm] = useState("");
  const [member, setMember] = useState<Picked | null>(null);
  const [book, setBook] = useState<Picked | null>(null);

  const memberSearch = useDebouncedValue(memberTerm.trim(), 250);
  const bookSearch = useDebouncedValue(bookTerm.trim(), 250);

  const members = useUsers(
    { search: memberSearch, role: "MEMBER", page_size: 8 },
    { enabled: !member && memberSearch.length >= 2 },
  );
  const books = useBooks(
    { search: bookSearch, available: true, page_size: 8 },
    { enabled: !book && bookSearch.length >= 2 },
  );

  const create = useCreateLoan();

  function submit() {
    if (!member || !book) return;
    create.mutate(
      { member_id: member.id, book_id: book.id },
      {
        onSuccess: (loan) => {
          toast.success(`Lent “${loan.book.title}” to ${loan.member.full_name}, due ${formatDate(loan.due_date)}.`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New loan</DialogTitle>
          <DialogDescription>Search for the member and for a title that has a free copy.</DialogDescription>
        </DialogHeader>

        <Picker
          label="Member"
          placeholder="Name, e-mail or member number"
          picked={member}
          onPick={setMember}
          onClear={() => setMember(null)}
          term={memberTerm}
          onTerm={setMemberTerm}
          loading={members.isFetching}
          options={(members.data?.results ?? []).map((u) => ({
            id: u.id,
            label: `${u.first_name} ${u.last_name}`.trim() + ` · ${u.member_number ?? u.email}${u.is_blocked ? " (blocked)" : ""}`,
          }))}
        />
        <Picker
          label="Book"
          placeholder="Title, author or ISBN"
          picked={book}
          onPick={setBook}
          onClear={() => setBook(null)}
          term={bookTerm}
          onTerm={setBookTerm}
          loading={books.isFetching}
          options={(books.data?.results ?? []).map((b) => ({
            id: b.id,
            label: `${b.title} · ${b.available_copies} available`,
          }))}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!member || !book || create.isPending} onClick={submit}>
            Lend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
