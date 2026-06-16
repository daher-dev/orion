import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-[280px] w-full rounded-[14px]" />
        <Skeleton className="h-[280px] w-full rounded-[14px]" />
      </div>
    </div>
  );
}
