"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";

export type UserRow = {
  id: string;
  name: string;
  email: string;
};

export function UserManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState("");

  const [removing, setRemoving] = useState<UserRow | null>(null);
  const [removeError, setRemoveError] = useState("");
  const [pending, setPending] = useState(false);

  async function createUser() {
    setCreating(true);
    setFormError("");
    const result = await createUserAction({ name, email, password });
    setCreating(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    router.refresh();
  }

  function openEdit(user: UserRow) {
    setEditError("");
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword("");
    setEditing(user);
  }

  async function saveEdit() {
    if (!editing) return;
    setPending(true);
    const result = await updateUserAction({
      id: editing.id,
      name: editName,
      email: editEmail,
      password: editPassword,
    });
    setPending(false);
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!removing) return;
    setPending(true);
    const result = await deleteUserAction({ id: removing.id });
    setPending(false);
    if (!result.ok) {
      setRemoveError(result.error);
      return;
    }
    setRemoving(null);
    setRemoveError("");
    router.refresh();
  }

  return (
    <>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-[var(--bb-cream)]">Novo usuário</h2>
      <form
        className="grid gap-3 lg:grid-cols-4"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          void createUser();
        }}
      >
        <div>
          <LabelWithHelp htmlFor="user-name" help="Nome que aparece na conta.">
            Nome
          </LabelWithHelp>
          <Input
            id="user-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome"
            required
            autoComplete="off"
          />
        </div>
        <div>
          <LabelWithHelp htmlFor="user-email" help="E-mail usado para entrar.">
            E-mail
          </LabelWithHelp>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nome@blackbeans.com.br"
            required
            autoComplete="off"
          />
        </div>
        <div>
          <LabelWithHelp
            htmlFor="user-password"
            help="Mínimo de 8 caracteres. A pessoa usa essa senha para entrar."
          >
            Senha
          </LabelWithHelp>
          <PasswordInput
            id="user-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={creating}>
            <UserPlus className="h-4 w-4" />
            {creating ? "Criando..." : "Criar usuário"}
          </Button>
        </div>
      </form>
      {formError ? (
        <p className="mt-3 text-sm text-red-300">{formError}</p>
      ) : null}
      </Card>

      <ul className="divide-y divide-[var(--bb-border)] overflow-hidden rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)]">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bb-surface)] px-4 py-3"
          >
            <div>
              <p className="font-medium text-[var(--bb-cream)]">
                {user.name}{" "}
                {user.id === currentUserId ? (
                  <Badge tone="neutral">você</Badge>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm text-[var(--bb-gray)]">{user.email}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(user)}>
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={user.id === currentUserId}
                onClick={() => {
                  setRemoveError("");
                  setRemoving(user);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(editing)}
        title="Editar usuário"
        description="Troque o nome, o e-mail ou defina uma senha nova."
        confirmLabel="Salvar"
        pending={pending}
        onClose={() => setEditing(null)}
        onConfirm={() => void saveEdit()}
      >
        <div className="space-y-3">
          <div>
            <LabelWithHelp htmlFor="edit-name" help="Nome da conta.">
              Nome
            </LabelWithHelp>
            <Input
              id="edit-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <LabelWithHelp htmlFor="edit-email" help="E-mail usado para entrar.">
              E-mail
            </LabelWithHelp>
            <Input
              id="edit-email"
              type="email"
              value={editEmail}
              onChange={(event) => setEditEmail(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <LabelWithHelp
              htmlFor="edit-password"
              help="Deixe em branco para manter a senha atual. Mínimo de 8 caracteres se for trocar."
            >
              Nova senha
            </LabelWithHelp>
            <PasswordInput
              id="edit-password"
              value={editPassword}
              onChange={(event) => setEditPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Manter a senha atual"
            />
          </div>
          {editError ? <p className="text-sm text-red-300">{editError}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(removing)}
        title="Excluir usuário"
        description={
          removing
            ? `${removing.name} deixa de conseguir entrar. Essa ação não apaga os dashboards.`
            : undefined
        }
        confirmLabel="Excluir"
        confirmVariant="danger"
        pending={pending}
        onClose={() => setRemoving(null)}
        onConfirm={() => void confirmDelete()}
      >
        {removeError ? <p className="text-sm text-red-300">{removeError}</p> : null}
      </Modal>
    </>
  );
}
