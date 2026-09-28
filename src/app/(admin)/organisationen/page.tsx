import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { OrganizationManager } from "@/components/organization-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listOrganizations } from "@/server/services/organizations";

export default async function OrganizationsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const organizations = await listOrganizations({ includeInactive: true });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Kostenträger</h1>
          <p>Firmen, Behörden und Eltern als Rechnungsempfänger pflegen.</p>
        </div>
      </div>
      <OrganizationManager initialOrganizations={organizations} />
    </>
  );
}
