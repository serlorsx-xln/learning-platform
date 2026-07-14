import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getJob, getJobEvents } from "@/lib/jobs/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const job = await getJob(id);
  if (!job) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let lastCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const pushSnapshot = async () => {
        const events = await getJobEvents(id);
        const currentJob = await getJob(id);
        send({
          type: "snapshot",
          job: currentJob,
          events,
        });
        lastCount = events.length;
      };

      await pushSnapshot();

      const interval = setInterval(async () => {
        const events = await getJobEvents(id);
        const currentJob = await getJob(id);
        if (events.length > lastCount) {
          for (const event of events.slice(lastCount)) {
            send({ type: "event", event, job: currentJob });
          }
          lastCount = events.length;
        } else if (currentJob?.status !== job.status) {
          send({ type: "event", job: currentJob, events: [] });
        }

        if (currentJob && ["success", "partial", "failed", "cancelled"].includes(currentJob.status)) {
          clearInterval(interval);
          controller.close();
        }
      }, 1500);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
