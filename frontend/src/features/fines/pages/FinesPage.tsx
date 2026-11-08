import { useState } from "react";

import { toApiError } from "@/api/errors";
import { Pagination } from "@/components/Pagination";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { hasAnyRole, isStaff } from "@/features/auth/access";
import { useAuth } from "@/features/auth/hooks";
import type { Fine } from "@/features/loans/types";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

import { usePayFine, useFines, useWaiveFine } from "../hooks";

const STATUS_BADGE: Record<Fine["status"], BadgeProps["variant"]> = {
  UNPAID: "destructive",
  PAID: "success",
  WAIVED: "outline",
};

const REASON_LABEL: Record<Fine["reason"], string> = {
  OVERDUE: "Overdue return",
  LOST: "Lost book",
  DAMAGED: "Damaged book",
};

const PAGE_SIZE = 20;

/** Members see their own fines; librarians can mark them paid; only admins can waive. */
export function FinesPage() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const admin = hasAnyRole(user, ["ADMIN"]);

  const [status, setStatus] = useState<Fine["status"] | "">("");
  const [page, setPage] = useState(1);

  const query = useFines({ status: status || undefined, page, page_size: PAGE_SIZE });
  const pay = usePayFine();
  const waive = useWaiveFine();

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{staff ? "Fines" : "My fines"}</h1>
        <label className="flex items-center gap-2 text-sm">
          Status
          <Select
            className="w-40"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Fine["status"] | "");
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
            <option value="WAIVED">Waived</option>
          </Select>
        </label>
      </div>

      {query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
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
        <p className="rounded-md border border-dashed py-12 text-center text-muted-foreground">No fines to show.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Book</th>
                  {staff && <th className="p-3 font-medium">Member</th>}
                  <th className="p-3 font-medium">Reason</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="hidden p-3 font-medium md:table-cell">Issued</th>
                  {staff && <th className="p-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((fine) => (
                  <tr key={fine.id} className="border-t">
                    <td className="p-3 font-medium">{fine.book.title}</td>
                    {staff && <td className="p-3">{fine.member.full_name}</td>}
                    <td className="p-3">{REASON_LABEL[fine.reason]}</td>
                    <td className="p-3">{fine.amount}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[fine.status]}>{fine.status.toLowerCase()}</Badge>
                    </td>
                    <td className="hidden p-3 md:table-cell">{formatDate(fine.created_at)}</td>
                    {staff && (
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          {fine.status === "UNPAID" && (
                            <Button
                              size="sm"
                              aria-label={`Mark fine ${fine.id} as paid`}
                              disabled={pay.isPending}
                              onClick={() =>
                                pay.mutate(fine.id, { onSuccess: () => toast.success("Fine marked as paid.") })
                              }
                            >
                              Mark paid
                            </Button>
                          )}
                          {fine.status === "UNPAID" && admin && (
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Waive fine ${fine.id}`}
                              disabled={waive.isPending}
                              onClick={() =>
                                waive.mutate(fine.id, { onSuccess: () => toast.success("Fine waived.") })
                              }
                            >
                              Waive
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
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
