import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { RunWorkflowGuide } from "@/components/run/run-workflow-guide";
import { PLATFORM_LABELS, type Platform } from "@/lib/jobs/types";

const platforms: Platform[] = ["andrewbiggs", "edlearning", "speexx"];

export default function RunIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Run"
        subtitle="Primary channel for automation - load status, submit jobs, and track logs here."
      />

      <RunWorkflowGuide />

      <div className="grid gap-4 md:grid-cols-3">
        {platforms.map((platform) => (
          <Link key={platform} href={`/run/${platform}`}>
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
              <CardHeader>
                <CardTitle>{PLATFORM_LABELS[platform]}</CardTitle>
                <CardDescription>Start a new {PLATFORM_LABELS[platform]} job</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
