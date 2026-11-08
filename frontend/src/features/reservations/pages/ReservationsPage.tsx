import { useState } from "react";

import { toApiError } from "@/api/errors";
import { Pagination } from "@/components/Pagination";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { isStaff } from "@/features/auth/access";
import { useAuth } from "@/features/auth/hooks";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

import { useCancelReservation, useReservations } from "../hooks";
import type { Reservation, ReservationStatus } from "../types";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "Waiting",
  READY: "Ready for pick-up",
  FULFILLED: "Picked up",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_BADGE: Record<ReservationStatus, BadgeProps["variant"]> = {
  PENDING: "secondary",
  READY: "success",
  FULFILLED: "outline",
  CANCELLED: "outline",
  EXPIRED: "destructive",
};

const PAGE_SIZE = 20;

/** Members see their own reservations (the API scopes the list); staff see everyone's. */
export function ReservationsPage() {
  const { user } = useAuth();
  const staff = isStaff(user);

  const [filter, setFilter] = useState<"active" | "all">("active");
  const [page, setPage] = useState(1);

  const query = useReservations({ active: filter === "active" ? true : undefined, page, page_size: PAGE_SIZE });
  const cancel = useCancelReservation();

  function handleCancel(reservation: Reservation) {
    cancel.mutate(reservation.id, { onSuccess: () => toast.success(`Cancelled: ${reservation.book.title}.`) });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{staff ? "Reservations" : "My reservations"}</h1>
        <label className="flex items-center gap-2 text-sm">
          Show
          <Select
            className="w-40"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as "active" | "all");
              setPage(1);
            }}
          >
            <option value="active">Open only</option>
            <option value="all">All</option>
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
        <p className="rounded-md border border-dashed py-12 text-center text-muted-foreground">
          No reservations to show.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Book</th>
                  {staff && <th className="p-3 font-medium">Member</th>}
                  <th className="p-3 font-medium">Status</th>
                  <th className="hidden p-3 font-medium md:table-cell">Reserved</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {query.data.results.map((reservation) => (
                  <tr key={reservation.id} className="border-t">
                    <td className="p-3 font-medium">{reservation.book.title}</td>
                    {staff && <td className="p-3">{reservation.member.full_name}</td>}
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_BADGE[reservation.status]}>{STATUS_LABEL[reservation.status]}</Badge>
                        {reservation.queue_position !== null && (
                          <span className="text-xs text-muted-foreground">#{reservation.queue_position} in line</span>
                        )}
                        {reservation.status === "READY" && reservation.expires_at && (
                          <span className="text-xs text-muted-foreground">
                            until {formatDate(reservation.expires_at)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden p-3 md:table-cell">{formatDate(reservation.created_at)}</td>
                    <td className="p-3">
                      <div className="flex justify-end">
                        {(reservation.status === "PENDING" || reservation.status === "READY") && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Cancel reservation of ${reservation.book.title}`}
                            disabled={cancel.isPending}
                            onClick={() => handleCancel(reservation)}
                          >
                            Cancel
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
          />
        </>
      )}
    </section>
  );
}
