import { redirect } from "next/navigation";

import { FinanceOverviewPanel } from "@/components/finance-overview";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { financeOverview } from "@/server/services/finance";

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function FinancePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const overview = await financeOverview(currentPeriod());

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Finanzen</h1>
          <p>Umsatz, offene Beträge und Honorare pro Periode.</p>
        </div>
      </div>
      <FinanceOverviewPanel initialOverview={overview} />
    </>
  );
}
