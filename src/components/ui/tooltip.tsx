"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";

type Props = {
  content: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom";
};

export function Tooltip({ content, children, side = "top" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const child = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": open ? id : undefined,
        onMouseEnter: (e: React.MouseEvent) => {
          setOpen(true);
          const orig = (children.props as { onMouseEnter?: (e: React.MouseEvent) => void })
            .onMouseEnter;
          orig?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          setOpen(false);
          const orig = (children.props as { onMouseLeave?: (e: React.MouseEvent) => void })
            .onMouseLeave;
          orig?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
          setOpen(true);
          const orig = (children.props as { onFocus?: (e: React.FocusEvent) => void }).onFocus;
          orig?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          setOpen(false);
          const orig = (children.props as { onBlur?: (e: React.FocusEvent) => void }).onBlur;
          orig?.(e);
        },
      } as Record<string, unknown>)
    : children;

  return (
    <span className="relative inline-flex">
      {child}
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[var(--bb-black)] px-2.5 py-1.5 text-xs text-[var(--bb-cream)] shadow-lg ${
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
