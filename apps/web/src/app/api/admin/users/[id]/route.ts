import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setUserBanned, updateUserRole, listUsers } from "@/lib/db/seed";
import { getUserRole } from "@/lib/session";
import { logAudit, getClientIp } from "@/lib/audit/service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || getUserRole(session.user) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const users = await listUsers();
  const target = users.find((u) => u.id === id);

  if (body.banned !== undefined) {
    if (id === session.user.id && body.banned) {
      return NextResponse.json({ error: "Cannot disable your own account" }, { status: 400 });
    }
    await setUserBanned(id, Boolean(body.banned));

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name,
      actorEmail: session.user.email,
      action: body.banned ? "user.ban" : "user.unban",
      resource: "user",
      resourceId: id,
      details: {
        targetEmail: target?.email,
        targetName: target?.name,
      },
      ipAddress: getClientIp(request),
    });
  }

  if (body.role) {
    if (id === session.user.id && body.role !== "admin") {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }
    const previousRole = target?.role;
    await updateUserRole(id, body.role);

    await logAudit({
      actorId: session.user.id,
      actorName: session.user.name,
      actorEmail: session.user.email,
      action: "user.role_change",
      resource: "user",
      resourceId: id,
      details: {
        targetEmail: target?.email,
        from: previousRole,
        to: body.role,
      },
      ipAddress: getClientIp(request),
    });
  }

  return NextResponse.json({ ok: true });
}
