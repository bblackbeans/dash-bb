import Link from "next/link";

export function BrandMark({ href = "/admin" }: { href?: string }) {
  return (
    <Link href={href} className="block min-w-0">
      <img
        src="/brand/blackbeans.png"
        alt="blackbeans. agência de marketing digital"
        width={991}
        height={180}
        className="h-auto w-[220px]"
      />
    </Link>
  );
}
