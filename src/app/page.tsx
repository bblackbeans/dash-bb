import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--bb-accent)]">
          BlackBeans
        </p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight text-[var(--bb-cream)]">
          BBDash
        </h1>
        <p className="mt-4 max-w-xl text-[var(--bb-gray)]">
          Plataforma própria de dashboards para clientes BlackBeans — sem
          Looker Studio.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/login">
          <Button size="lg">Entrar no Admin</Button>
        </Link>
        <Link href="/p/johnson/trafego">
          <Button size="lg" variant="secondary">
            Ver demo pública
          </Button>
        </Link>
      </div>
    </main>
  );
}
