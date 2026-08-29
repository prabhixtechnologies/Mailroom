import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isThisYear, isToday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * The timestamp a mail list shows: a time for today, a date for this year, a year for anything older.
 *
 * <p>Not a relative "3 days ago", which is the wrong unit for mail — scanning a list, the useful
 * question is which day something arrived, and every row saying "N days ago" makes that arithmetic the
 * reader's job.
 */
export function formatMailDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return format(date, "HH:mm");
  if (isThisYear(date)) return format(date, "d MMM");
  return format(date, "MMM yyyy");
}

export function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "EEE d MMM yyyy, HH:mm");
}

export function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** The part of an address a person recognises, for a list where the full address does not fit. */
export function displayName(address: string | null, name: string | null): string {
  if (name && name.trim().length > 0) return name.trim();
  if (!address) return "Unknown sender";
  const at = address.indexOf("@");
  return at > 0 ? address.slice(0, at) : address;
}

export function initials(value: string): string {
  const parts = value.trim().split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
