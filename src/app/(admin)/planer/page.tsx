import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { Planner } from "@/components/planner";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listLocations } from "@/server/services/locations";
import { listRooms } from "@/server/services/rooms";

export default async function PlannerPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "teacher")) return <NoAccess />;

  const [locations, rooms] = await Promise.all([listLocations(false), listRooms(false)]);
  const canDecide = hasRole(user, "office", "admin");

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Belegungsplan</h1>
          <p>Lektionen per Drag’n’Drop verschieben; Änderungen erst fixieren.</p>
        </div>
      </div>
      <Planner canDecide={canDecide} locations={locations} rooms={rooms} />
    </>
  );
}
