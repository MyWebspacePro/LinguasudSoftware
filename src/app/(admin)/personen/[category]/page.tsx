import { notFound, redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { PeopleManager } from "@/components/people-manager";
import { currentUser } from "@/lib/auth";
import { hasRole, type Role } from "@/lib/roles";
import { listPeople } from "@/server/services/people";

const categories: Record<string, { role: Role; title: string; description: string }> = {
  teilnehmende: { role: "participant", title: "Teilnehmende", description: "Teilnehmende erfassen und verwalten." },
  lehrpersonen: { role: "teacher", title: "Lehrpersonen", description: "Lehrpersonen und ihre Zugangsdaten verwalten." },
  bueromitarbeitende: { role: "office", title: "Büromitarbeitende", description: "Bürozugänge und Zuständigkeiten verwalten." },
};

export default async function PeopleCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const config = categories[category];
  if (!config) notFound();

  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const people = await listPeople({ includeInactive: true, role: config.role });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
      </div>
      <PeopleManager defaultRole={config.role} initialPeople={people} key={config.role} />
    </>
  );
}
