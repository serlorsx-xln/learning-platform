import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { RecentJobsTable } from "@/components/jobs/recent-jobs-table";
import { getJobStats, listJobs } from "@/lib/jobs/service";

export default async function OverviewPage() {
  const [stats, recentJobs] = await Promise.all([getJobStats(), listJobs({ limit: 5 })]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Monitor automation jobs across all platforms."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total jobs" value={stats.total} />
        <StatCard label="Running" value={stats.running} />
        <StatCard label="Successful" value={stats.success} />
        <StatCard label="Failed / partial" value={stats.failed} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
          <CardDescription>Latest activity across platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentJobsTable jobs={recentJobs} />
        </CardContent>
      </Card>
    </div>
  );
}
