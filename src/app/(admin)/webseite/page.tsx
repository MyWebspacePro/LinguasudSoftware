import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { PublicPageEditor } from "@/components/public-page-editor";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listEditablePages } from "@/server/services/public-pages";

export default async function WebsiteEditorPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const pages = await listEditablePages();
  return (
    <>
      <div className="page-header"><div><h1>Website-Inhalte</h1><p>Öffentliche Texte auf Deutsch und Englisch pflegen.</p></div></div>
      <PublicPageEditor initialPages={pages} />
    </>
  );
}
