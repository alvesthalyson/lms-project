import { BookOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import type { Book } from "../types";

interface BookTableProps {
  books: Book[];
  /** LIBRARIAN+: show the Edit action. */
  canManage: boolean;
  /** MEMBER: show Reserve on books with no copy on the shelf. */
  canReserve: boolean;
  /** Id of the book whose reservation is in flight (disables its button). */
  reservingId: number | null;
  onEdit: (book: Book) => void;
  onReserve: (book: Book) => void;
  /** True while a new page loads on top of the previous one. */
  stale?: boolean;
}

function AvailabilityBadge({ book }: { book: Book }) {
  if (book.total_copies === 0) return <Badge variant="secondary">No copies</Badge>;
  return (
    <Badge variant={book.available_copies > 0 ? "success" : "destructive"}>
      {book.available_copies}/{book.total_copies} available
    </Badge>
  );
}

/** Columns collapse on narrow screens (ISBN below lg, category below md); the table scrolls if it still does not fit. */
export function BookTable({ books, canManage, canReserve, reservingId, onEdit, onReserve, stale = false }: BookTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-md border transition-opacity", stale && "opacity-60")}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th scope="col" className="w-16 p-3">
              <span className="sr-only">Cover</span>
            </th>
            <th scope="col" className="p-3 font-medium">
              Title
            </th>
            <th scope="col" className="hidden p-3 font-medium lg:table-cell">
              ISBN
            </th>
            <th scope="col" className="hidden p-3 font-medium md:table-cell">
              Category
            </th>
            <th scope="col" className="p-3 font-medium">
              Availability
            </th>
            <th scope="col" className="p-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id} className="border-t align-middle">
              <td className="p-3">
                {book.cover_image ? (
                  <img src={book.cover_image} alt="" loading="lazy" className="h-14 w-10 rounded object-cover" />
                ) : (
                  <div className="flex h-14 w-10 items-center justify-center rounded bg-muted text-muted-foreground" aria-hidden>
                    <BookOpen className="h-5 w-5" />
                  </div>
                )}
              </td>
              <td className="p-3">
                <div className="font-medium">{book.title}</div>
                <div className="text-muted-foreground">{book.authors.map((author) => author.name).join(", ")}</div>
                {!book.is_active && (
                  <Badge variant="outline" className="mt-1">
                    Hidden
                  </Badge>
                )}
              </td>
              <td className="hidden p-3 font-mono text-xs lg:table-cell">{book.isbn}</td>
              <td className="hidden p-3 md:table-cell">{book.category.name}</td>
              <td className="p-3">
                <AvailabilityBadge book={book} />
              </td>
              <td className="p-3">
                <div className="flex justify-end gap-2">
                  {canManage && (
                    <Button variant="outline" size="sm" aria-label={`Edit ${book.title}`} onClick={() => onEdit(book)}>
                      Edit
                    </Button>
                  )}
                  {canReserve && book.is_active && book.total_copies > 0 && !book.is_available && (
                    <Button
                      size="sm"
                      aria-label={`Reserve ${book.title}`}
                      disabled={reservingId === book.id}
                      onClick={() => onReserve(book)}
                    >
                      Reserve
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
