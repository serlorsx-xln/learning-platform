import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isUserBanned } from "@/lib/session";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await isUserBanned(session.user.id)) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }
  return NextResponse.json({ user: session.user });
}
