import Link from "next/link";

import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listLocations } from "@/server/services/locations";
import { listOrganizations } from "@/server/services/organizations";
import { listPeople } from "@/server/services/people";
import { listRooms } from "@/server/services/rooms";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) return null;

  if (!hasRole(user, "office", "admin", "finance")) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Willkommen, {user.name}</h1>
            <p>Für Ihre Rolle stehen die Fachmodule noch nicht bereit.</p>
          </div>
        </div>
      </>
    );
  }

  const [people, rooms, locations, organizations] = await Promise.all([
    listPeople({ includeInactive: true }),
    listRooms(true),
    listLocations(true),
    listOrganizations({ includeInactive: true }),
  ]);

  const peopleByRole = {
    participants: people.filter((person) => person.roles.includes("participant")).length,
    teachers: people.filter((person) => person.roles.includes("teacher")).length,
    office: people.filter((person) => person.roles.includes("office") || person.roles.includes("admin")).length,
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Übersicht</h1>
          <p>Stammdaten auf einen Blick.</p>
        </div>
      </div>

      <div className="grid-cards">
        <Link className="stat" href="/personen">
          <div className="stat__value">{people.length}</div>
          <div className="stat__label">Personen</div>
        </Link>
        <Link className="stat" href="/personen/teilnehmende">
          <div className="stat__value">{peopleByRole.participants}</div>
          <div className="stat__label">Teilnehmende</div>
        </Link>
        <Link className="stat" href="/personen/lehrpersonen">
          <div className="stat__value">{peopleByRole.teachers}</div>
          <div className="stat__label">Lehrpersonen</div>
        </Link>
        <Link className="stat" href="/personen/bueromitarbeitende">
          <div className="stat__value">{peopleByRole.office}</div>
          <div className="stat__label">Büromitarbeitende</div>
        </Link>
        <Link className="stat" href="/standorte">
          <div className="stat__value">{locations.length}</div>
          <div className="stat__label">Standorte</div>
        </Link>
        <Link className="stat" href="/raeume">
          <div className="stat__value">{rooms.length}</div>
          <div className="stat__label">Räume</div>
        </Link>
        <Link className="stat" href="/organisationen">
          <div className="stat__value">{organizations.length}</div>
          <div className="stat__label">Kostenträger</div>
        </Link>
      </div>
    </>
  );
}
