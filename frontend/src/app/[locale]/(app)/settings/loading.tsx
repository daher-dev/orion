import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      <div className="border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="space-y-3 p-5">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    </div>
  );
}
