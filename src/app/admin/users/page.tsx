import { getServerSession } from "next-auth";
import { UserManager } from "@/components/admin/user-manager";
import { PageHeader } from "@/components/ui/page-header";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Usuários"
        description="Contas que entram no painel. Crie acessos e troque a senha de quem precisar."
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Usuários" },
        ]}
      />

      <UserManager
        currentUserId={currentUserId}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        }))}
      />
    </div>
  );
}
