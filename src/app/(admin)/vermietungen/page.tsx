import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { RoomRentalManager } from "@/components/room-rental-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listRentals } from "@/server/services/room-rentals";
import { listRooms } from "@/server/services/rooms";

export default async function RentalsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const [rentals, rooms] = await Promise.all([listRentals(), listRooms(false)]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Raumvermietung</h1>
          <p>Räume einmalig oder wiederkehrend an Dritte vermieten.</p>
        </div>
      </div>
      <RoomRentalManager initialRentals={rentals} rooms={rooms} />
    </>
  );
}
