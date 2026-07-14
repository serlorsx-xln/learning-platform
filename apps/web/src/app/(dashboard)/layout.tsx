import { Sidebar, BottomNav } from "@/components/layout/nav";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { requireSession, getUserRole } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const isAdmin = getUserRole(session.user) === "admin";

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      <Sidebar isAdmin={isAdmin} userName={session.user.name} userEmail={session.user.email} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-16 md:ml-56 md:pb-0">
        <DashboardTopbar userName={session.user.name} userEmail={session.user.email} />
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 p-3 sm:p-4 md:p-6">{children}</main>
      </div>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
