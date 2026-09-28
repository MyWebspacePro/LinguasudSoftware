import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { RoomManager } from "@/components/room-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listLocations } from "@/server/services/locations";
import { listRooms } from "@/server/services/rooms";

export default async function RoomsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const [rooms, locations] = await Promise.all([listRooms(true), listLocations(true)]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Räume</h1>
          <p>Kursräume mit Standort, Etage und Kapazität pflegen.</p>
        </div>
      </div>
      <RoomManager initialRooms={rooms} locations={locations} />
    </>
  );
}
