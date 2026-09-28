import { redirect } from "next/navigation";

import { InvoiceManager } from "@/components/invoice-manager";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listInvoices } from "@/server/services/finance";
import { listOrganizations } from "@/server/services/organizations";

export default async function InvoicesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const [invoices, organizations] = await Promise.all([listInvoices({}), listOrganizations({})]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Rechnungen</h1>
          <p>Rechnungen erfassen, Status pflegen und mit bexio synchronisieren.</p>
        </div>
      </div>
      <InvoiceManager initialInvoices={invoices} organizations={organizations} />
    </>
  );
}
