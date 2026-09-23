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
  const tones = {
    default: "bg-primary/15 text-primary",
    muted: "bg-surface-muted text-text-muted",
    accent: "bg-accent/15 text-accent",
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

export function Avatar({ label }: { label: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-text-muted">
      {label}
    </span>
  );
}
