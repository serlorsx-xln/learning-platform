import { Suspense } from "react";
import { listJobs } from "@/lib/jobs/service";
import { type Platform, type JobStatus } from "@/lib/jobs/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobsFilters } from "@/components/jobs/jobs-filters";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    platform?: Platform;
    status?: JobStatus;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const params = await searchParams;
  const jobs = await listJobs({
    platform: params.platform,
    status: params.status,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader description="History and status of all automation runs." />

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-24" />
              ))}
            </div>
          </div>
        }
      >
        <JobsFilters />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>{jobs.length} jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <JobsTable jobs={jobs} />
        </CardContent>
      </Card>
    </div>
  );
}
