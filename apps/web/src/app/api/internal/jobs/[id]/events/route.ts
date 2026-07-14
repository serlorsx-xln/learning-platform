import { NextRequest, NextResponse } from "next/server";
import { handleWorkerEvent } from "@/lib/jobs/service";

function verifyInternalKey(request: NextRequest) {
  const key = request.headers.get("x-internal-key");
  return key && key === process.env.INTERNAL_API_KEY;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyInternalKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  await handleWorkerEvent(id, body);
  return NextResponse.json({ ok: true });
}
