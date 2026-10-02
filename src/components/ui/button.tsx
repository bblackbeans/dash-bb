import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--bb-accent)] text-[var(--bb-black)] hover:brightness-110 disabled:opacity-50",
  secondary:
    "border border-[var(--bb-accent)] text-[var(--bb-accent)] bg-transparent hover:bg-[var(--bb-accent)]/10",
  ghost:
    "text-[var(--bb-cream)] hover:bg-white/5 border border-transparent",
  danger: "text-red-400 hover:bg-red-400/10 border border-red-400/40",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    { className = "", variant = "primary", size = "md", type = "button", ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--bb-radius)] font-medium transition disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = "Button";
