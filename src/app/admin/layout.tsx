import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { FolderKanban, Users } from "lucide-react";
import { LogoutButton } from "@/components/admin/logout-button";
import { Tooltip } from "@/components/ui/tooltip";
import { authOptions } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="bb-admin-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--bb-border)] bg-[var(--bb-black)]/90 backdrop-blur">
        <div className="bb-admin-bar mx-auto flex max-w-[1440px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="block shrink-0">
              <img
                src="/brand/blackbeans.png"
                alt="blackbeans."
                width={991}
                height={180}
                className="h-10 w-auto"
              />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Tooltip content="Pastas dos clientes e seus dashboards">
                <Link
                  href="/admin/clients"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--bb-radius)] px-3 py-2 text-[var(--bb-gray)] hover:bg-white/5 hover:text-[var(--bb-cream)]"
                >
                  <FolderKanban className="h-4 w-4" aria-hidden />
                  Clientes
                </Link>
              </Tooltip>
              <Tooltip content="Contas que entram neste painel">
                <Link
                  href="/admin/users"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--bb-radius)] px-3 py-2 text-[var(--bb-gray)] hover:bg-white/5 hover:text-[var(--bb-cream)]"
                >
                  <Users className="h-4 w-4" aria-hidden />
                  Usuários
                </Link>
              </Tooltip>
            </nav>
          </div>
          <LogoutButton email={session.user?.email} />
        </div>
      </header>
      <main className="bb-admin-main mx-auto max-w-[1440px] px-6 py-8">{children}</main>
    </div>
  );
}
