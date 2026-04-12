import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPlaytime(min: number | null, max: number | null): string {
  if (!min && !max) return "Unbekannt";
  if (!max || min === max) return `${min} Min.`;
  return `${min}–${max} Min.`;
}

export function formatPlayerCount(min: number | null, max: number | null): string {
  if (!min && !max) return "?";
  if (!max || min === max) return `${min}`;
  return `${min}–${max}`;
}

export function formatComplexity(value: number | null): string {
  if (!value) return "Unbekannt";
  if (value < 2) return "Leicht";
  if (value < 3) return "Mittel";
  if (value < 4) return "Schwer";
  return "Sehr schwer";
}
