import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin-nav";
import { currentUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="app">
      <AdminNav user={{ name: user.name, roles: user.roles }} />
      <main className="app__main">{children}</main>
    </div>
  );
}
