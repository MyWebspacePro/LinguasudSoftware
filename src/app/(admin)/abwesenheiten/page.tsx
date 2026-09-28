import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { TeacherAbsenceManager } from "@/components/teacher-absence-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listTeacherAbsences } from "@/server/services/absences";
import { listCourses } from "@/server/services/courses";
import { listPeople } from "@/server/services/people";

export default async function AbsencesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "teacher")) return <NoAccess />;

  const canDecide = hasRole(user, "office", "admin");
  const [absences, teachers, courses] = await Promise.all([
    listTeacherAbsences(user, {}),
    listPeople({ role: "teacher" }),
    listCourses({}),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Abwesenheiten</h1>
          <p>Abwesenheiten der Lehrpersonen melden und bestätigen.</p>
        </div>
      </div>
      <TeacherAbsenceManager canDecide={canDecide} courses={courses} initialAbsences={absences} selfId={user.id} teachers={teachers} />
    </>
  );
}
