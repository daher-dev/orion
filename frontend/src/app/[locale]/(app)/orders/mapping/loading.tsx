import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mirroring the De/Para shell — page-head, help card, progress card,
 * then a card with the toolbar + rows.
 */
export default function Loading() {
  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>

      <Skeleton className="mb-4 h-[88px] w-full rounded-[14px]" />
      <Skeleton className="mb-3.5 h-[66px] w-full rounded-[14px]" />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <Skeleton className="h-7 w-64" />
        </div>
        <div className="space-y-1 p-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </div>
    </div>
  );
}
