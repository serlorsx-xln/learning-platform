import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const workerUrl = process.env.WORKER_ANDREWBIGGS_URL ?? "http://worker-andrewbiggs:8001";

  const response = await fetch(`${workerUrl}/internal/courses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({
      email: body.email,
      username: body.email,
      password: body.password,
      courseUrls: body.courseUrls ?? [],
    }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
