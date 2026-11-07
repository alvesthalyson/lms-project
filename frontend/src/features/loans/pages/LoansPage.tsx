import { useState } from "react";

import { Pagination } from "@/components/Pagination";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { isStaff } from "@/features/auth/access";
import { useAuth } from "@/features/auth/hooks";
import { toApiError } from "@/api/errors";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

import { useLoans, useRenewLoan, useReturnLoan } from "../hooks";
import type { Loan, LoanStatus } from "../types";

const STATUS_BADGE: Record<LoanStatus, BadgeProps["variant"]> = {
  active: "secondary",
  overdue: "destructive",
  returned: "outline",
};

const PAGE_SIZE = 20;

/** Members see their own loans (the API scopes the list); staff see everyone's and can process returns. */
export function LoansPage() {
  const { user } = useAuth();
  const staff = isStaff(user);

  const [status, setStatus] = useState<LoanStatus | "">("");
  const [page, setPage] = useState(1);

  const query = useLoans({ status: status || undefined, page, page_size: PAGE_SIZE, ordering: "-loaned_at" });
  const renew = useRenewLoan();
  const giveBack = useReturnLoan();

  function handleRenew(loan: Loan) {
    renew.mutate(loan.id, {
      onSuccess: (updated) => toast.success(`Renewed. New due date: ${formatDate(updated.due_date)}.`),
    });
  }

  function handleReturn(loan: Loan) {
    giveBack.mutate(
      { id: loan.id },
      {
        onSuccess: ({ fine }) =>
          toast.success(fine ? `Returned. An overdue fine of ${fine.amount} was issued.` : "Returned."),
      },
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{staff ? "Loans" : "My loans"}</h1>
        <label className="flex items-center gap-2 text-sm">
          Status
          <Select
            className="w-40"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as LoanStatus | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="overdue">Overdue</option>
            <option value="returned">Returned</option>
          </Select>
        </label>
      </div>

      {query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <Alert variant="destructive" className="flex items-center justify-between gap-3">
          <span>{toApiError(query.error).detail}</span>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : query.data.results.length === 0 ? (
        <p className="rounded-md border border-dashed py-12 text-center text-muted-foreground">No loans to show.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Book</th>
                  {staff && <th className="p-3 font-medium">Member</th>}
                  <th className="hidden p-3 font-medium md:table-cell">Loaned</th>
                  <th className="p-3 font-medium">Due</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((loan) => (
                  <tr key={loan.id} className="border-t">
                    <td className="p-3 font-medium">{loan.book.title}</td>
                    {staff && <td className="p-3">{loan.member.full_name}</td>}
                    <td className="hidden p-3 md:table-cell">{formatDate(loan.loaned_at)}</td>
                    <td className="p-3">{formatDate(loan.due_date)}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[loan.status]}>
                        {loan.status === "overdue" ? `Overdue ${loan.days_overdue}d` : loan.status}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        {loan.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Renew ${loan.book.title}`}
                            disabled={renew.isPending}
                            onClick={() => handleRenew(loan)}
                          >
                            Renew
                          </Button>
                        )}
                        {staff && loan.status !== "returned" && (
                          <Button
                            size="sm"
                            aria-label={`Return ${loan.book.title}`}
                            disabled={giveBack.isPending}
                            onClick={() => handleReturn(loan)}
                          >
                            Return
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            count={query.data.count}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={query.isPlaceholderData}
          />
        </>
      )}
    </section>
  );
}
