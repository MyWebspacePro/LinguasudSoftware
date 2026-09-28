import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { PriceListManager } from "@/components/price-list-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listCourseSizeKinds } from "@/server/services/course-master";
import { listPriceLists } from "@/server/services/pricing";

export default async function PriceListsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const [priceLists, sizeKinds] = await Promise.all([listPriceLists(true), listCourseSizeKinds(false)]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tarife</h1>
          <p>Preislisten mit Positionen nach Kursart, Dauer und Tarif pflegen.</p>
        </div>
      </div>
      <PriceListManager initialPriceLists={priceLists} sizeKinds={sizeKinds} />
    </>
  );
}
