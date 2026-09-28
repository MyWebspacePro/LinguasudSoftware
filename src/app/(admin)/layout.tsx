import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { AdminNav } from "@/components/admin-nav";
import { currentUser } from "@/lib/auth";

import "../globals.css";

export const metadata: Metadata = {
  title: "Verwaltung",
  description: "Interne Verwaltung der Sprachschule Linguasud.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <html lang="de">
      <body>
        <div className="app">
          <AdminNav user={{ name: user.name, roles: user.roles }} />
          <main className="app__main">{children}</main>
        </div>
      </body>
    </html>
  );
}
