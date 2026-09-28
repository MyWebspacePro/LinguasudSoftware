import { redirect } from "next/navigation";

import { LocationManager } from "@/components/location-manager";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listLocations } from "@/server/services/locations";

export default async function LocationsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const locations = await listLocations(true);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Standorte</h1>
          <p>Standorte und ihre Reihenfolge im Planer pflegen.</p>
        </div>
      </div>
      <LocationManager initialLocations={locations} />
    </>
  );
}
