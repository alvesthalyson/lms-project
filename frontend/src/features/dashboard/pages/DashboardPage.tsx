import { useState } from "react";

import { toApiError } from "@/api/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

import { useActivity, useDashboardSummary, useMostBorrowed } from "../hooks";

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={tone === "warn" && Number(value) > 0 ? "text-3xl font-semibold text-destructive" : "text-3xl font-semibold"}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="flex items-center justify-between gap-3">
      <span>{toApiError(error).detail}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </Alert>
  );
}

/** Staff only (the route is wrapped in <ProtectedRoute roles={STAFF_ROLES} />). */
export function DashboardPage() {
  const [days, setDays] = useState(30);
  const [activityPage, setActivityPage] = useState(1);

  const summary = useDashboardSummary();
  const popular = useMostBorrowed(days, 5);
  const activity = useActivity(activityPage, 10);

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {summary.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : summary.isError ? (
        <ErrorBox error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Copies available"
            value={`${summary.data.books.copies_available} / ${summary.data.books.copies_total}`}
            hint={`${summary.data.books.titles} titles`}
          />
          <Stat label="Active loans" value={summary.data.loans.active} />
          <Stat label="Overdue loans" value={summary.data.loans.overdue} tone="warn" />
          <Stat
            label="Reservations"
            value={summary.data.reservations.pending + summary.data.reservations.ready}
            hint={`${summary.data.reservations.ready} ready for pick-up`}
          />
          <Stat label="Members" value={summary.data.members.total} hint={`${summary.data.members.blocked} blocked`} />
          <Stat
            label="Unpaid fines"
            value={summary.data.fines.unpaid_total}
            hint={`${summary.data.fines.unpaid_count} open`}
            tone="warn"
          />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Most borrowed</h2>
            <label className="flex items-center gap-2 text-sm">
              Period
              <Select
                aria-label="Period"
                className="h-9 w-32"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </Select>
            </label>
          </div>
          {popular.isPending ? (
            <Skeleton className="h-40" />
          ) : popular.isError ? (
            <ErrorBox error={popular.error} onRetry={() => void popular.refetch()} />
          ) : popular.data.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-muted-foreground">
              No loans in this period.
            </p>
          ) : (
            <ol className="divide-y rounded-md border">
              {popular.data.map((row, index) => (
                <li key={row.book.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {row.book.title}
                  </span>
                  <span className="font-medium">{row.loan_count} loans</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          {activity.isPending ? (
            <Skeleton className="h-40" />
          ) : activity.isError ? (
            <ErrorBox error={activity.error} onRetry={() => void activity.refetch()} />
          ) : activity.data.results.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-muted-foreground">
              Nothing has happened yet.
            </p>
          ) : (
            <>
              <ul className="divide-y rounded-md border">
                {activity.data.results.map((entry) => (
                  <li key={entry.id} className="p-3 text-sm">
                    <p className="font-medium">{entry.action_label}</p>
                    <p className="text-muted-foreground">
                      {[entry.member?.full_name, entry.book?.title].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!activity.data.previous}
                  onClick={() => setActivityPage((page) => page - 1)}
                >
                  Newer
                </Button>
                <span className="text-muted-foreground">
                  Page {activity.data.page} of {activity.data.total_pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!activity.data.next}
                  onClick={() => setActivityPage((page) => page + 1)}
                >
                  Older
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
