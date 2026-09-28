import { redirect } from "next/navigation";

import { EnrollmentManager } from "@/components/enrollment-manager";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listCourses } from "@/server/services/courses";
import { listEnrollments } from "@/server/services/enrollments";
import { listOrganizations } from "@/server/services/organizations";
import { listPeople } from "@/server/services/people";

export default async function EnrollmentsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const [enrollments, courses, participants, organizations] = await Promise.all([
    listEnrollments({ includeInactive: true }),
    listCourses({ includeInactive: true }),
    listPeople({ role: "participant", includeInactive: true }),
    listOrganizations({ includeInactive: true }),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Anmeldungen</h1>
          <p>Teilnehmende Kurse zuordnen, Preise und Guthaben pflegen.</p>
        </div>
      </div>
      <EnrollmentManager
        initialEnrollments={enrollments}
        courses={courses}
        participants={participants}
        organizations={organizations}
      />
    </>
  );
}
