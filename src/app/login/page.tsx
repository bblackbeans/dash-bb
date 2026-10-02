import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { Card } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--bb-accent)]">
          BlackBeans
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">BBDash</h1>
        <p className="mt-2 text-sm text-[var(--bb-gray)]">
          Acesso interno à plataforma de dashboards
        </p>
      </div>
      <Card className="p-6">
        <LoginForm />
      </Card>
    </main>
  );
}
