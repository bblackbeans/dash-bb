"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Credenciais inválidas. Verifique e-mail e senha.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <div>
        <LabelWithHelp
          htmlFor="email"
          help="Use o e-mail interno BlackBeans cadastrado no sistema."
        >
          E-mail
        </LabelWithHelp>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="nome@blackbeans.com.br"
        />
      </div>
      <div>
        <LabelWithHelp
          htmlFor="password"
          help="Senha da conta interna. Clique no olho para mostrar ou ocultar."
        >
          Senha
        </LabelWithHelp>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="new-password"
        />
      </div>
      {error ? (
        <p className="rounded-[var(--bb-radius)] border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
