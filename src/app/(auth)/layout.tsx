import type { Metadata } from "next";

import "../globals.css";

export const metadata: Metadata = { title: "Linguasud Verwaltung" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <html lang="de"><body>{children}</body></html>;
}
