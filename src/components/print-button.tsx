"use client";

export function PrintButton({ label }: { label: string }) {
  return <button className="public-button public-button--secondary print-hidden" onClick={() => window.print()} type="button">{label}</button>;
}
