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
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar
          userName={session.user.name}
          userEmail={session.user.email}
        />
        <main className="flex-1 overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-10">
          <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
        </main>
      </div>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
