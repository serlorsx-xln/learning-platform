import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/service";
import { JobDetailView } from "@/components/jobs/job-detail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  return <JobDetailView jobId={id} />;
}
