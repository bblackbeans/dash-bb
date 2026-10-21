export function TruncationNotice({ views }: { views: string[] }) {
  if (!views.length) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-[var(--bb-accent)] px-4 py-3 text-sm text-[var(--bb-gray)]"
    >
      Esta fonte tem mais de 20.000 linhas. O dashboard mostra só as mais recentes, então os
      totais do período mais antigo podem estar incompletos. Avise quem mantém os dados.
    </div>
  );
}
