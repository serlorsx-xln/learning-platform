import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RunWorkflowGuide() {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle>Recommended workflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-small text-muted-foreground">
        <p>
          Use this dashboard for day-to-day runs - jobs are logged, stream live progress, and can run in
          parallel. Original CLI scripts are for one-off debugging only.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open a platform below and load status (modules, courses, or activities).</li>
          <li>Select what you want to process, then submit the job.</li>
          <li>Follow progress on the job detail page.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
