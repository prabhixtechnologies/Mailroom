import { toneFor } from "@prabhix/brand";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} {...props} />;
}

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "muted" | "accent" }) {
  // The generated subtle pairs, not an alpha tint of the accent with the accent on top. An alpha
  // tint tracks the accent's own lightness, so the two stay close: measured, `bg-accent/15
  // text-accent` was 3.87:1 at worst in light mode and 3.95:1 in dark. The subtle pair is
  // asserted at 4.5:1 on every run and measures 6.84:1 at worst.
  const tones = {
    default: "bg-accent-subtle text-accent-subtle-ink",
    muted: "bg-surface-muted text-text-muted",
    accent: "bg-accent-2-subtle text-accent-2-subtle-ink",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * What a list or desk shows when it has nothing in it.
 *
 * <p>Given its own component because the alternative — a bare "No results" — is where a mail client
 * feels broken: an empty inbox and a failed request look identical, and one of them is good news.
 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  tone = "list",
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  tone?: "list" | "desk";
}) {
  if (tone === "desk") {
    return (
      <div className="mr-desk__empty">
        <h2>{title}</h2>
        {hint ? <p>{hint}</p> : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    );
  }
  return (
    <div className="mr-empty-list">
      {icon ? <div className="mb-3 text-text-muted opacity-50">{icon}</div> : null}
      <h2>{title}</h2>
      {hint ? <p>{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Initials in a circle, tinted from [seed] so a correspondent keeps one colour everywhere.
 *
 * A mail list is the case this matters most in: thirty rows of identical grey circles are
 * decoration, while thirty tinted ones let you find the thread from your accountant
 * without reading a single name. The initials still carry the meaning on their own, so
 * nothing depends on telling the swatches apart.
 */
export function Avatar({ label, seed }: { label: string; seed?: string }) {
  const tone = seed ? toneFor(seed) : undefined;
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tone ? "bg-[var(--tag-bg)] text-[var(--tag-ink)]" : "bg-surface-muted text-text-muted",
      )}
      style={
        tone
          ? ({
              "--tag-bg": `var(--px-tag-${tone}-bg)`,
              "--tag-ink": `var(--px-tag-${tone}-ink)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {label}
    </span>
  );
}
