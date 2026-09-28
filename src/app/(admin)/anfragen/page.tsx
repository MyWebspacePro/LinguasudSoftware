import { redirect } from "next/navigation";

import { PublicInbox } from "@/components/public-inbox";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listInquiries } from "@/server/services/public-inquiries";
import { listPlacementResults } from "@/server/services/public-placement";

export default async function InquiriesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;
  const [inquiries, results] = await Promise.all([listInquiries(), listPlacementResults()]);
  return (
    <>
      <div className="page-header"><div><h1>Website-Anfragen</h1><p>Anfragen und Einstufungen bearbeiten und nach Prüfung zuordnen.</p></div></div>
      <PublicInbox initialInquiries={inquiries} initialResults={results} />
    </>
  );
}
