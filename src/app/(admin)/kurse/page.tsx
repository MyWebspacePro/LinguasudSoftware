import { redirect } from "next/navigation";

import { CourseManager } from "@/components/course-manager";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listCourses } from "@/server/services/courses";
import { listCourseSizeKinds, listLanguages } from "@/server/services/course-master";
import { listLocations } from "@/server/services/locations";
import { listPeople } from "@/server/services/people";
import { listRooms } from "@/server/services/rooms";

export default async function CoursesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const [courses, languages, sizeKinds, teachers, locations, rooms] = await Promise.all([
    listCourses({ includeInactive: true }),
    listLanguages(false),
    listCourseSizeKinds(false),
    listPeople({ role: "teacher", includeInactive: false }),
    listLocations(true),
    listRooms(false),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Kurse</h1>
          <p>Kurse mit Sprache, Niveau, Lehrperson und Wochenplan verwalten.</p>
        </div>
      </div>
      <CourseManager
        initialCourses={courses}
        languages={languages}
        sizeKinds={sizeKinds}
        teachers={teachers}
        locations={locations}
        rooms={rooms}
      />
    </>
  );
}
