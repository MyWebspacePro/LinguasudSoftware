import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { PeopleManager } from "@/components/people-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listPeople } from "@/server/services/people";

export default async function PeoplePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const people = await listPeople({ includeInactive: true });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Personen</h1>
          <p>Teilnehmende, Lehrpersonen und Büromitarbeitende mit Rollen verwalten.</p>
        </div>
      </div>
      <PeopleManager initialPeople={people} />
    </>
  );
}
