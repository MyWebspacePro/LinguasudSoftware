import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { PayrollManager } from "@/components/payroll-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listCourseSizeKinds } from "@/server/services/course-master";
import { listPeople } from "@/server/services/people";

export default async function PayrollPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const [teachers, sizeKinds] = await Promise.all([listPeople({ role: "teacher" }), listCourseSizeKinds(false)]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Honorare</h1>
          <p>Honorarsätze je Lehrperson pflegen und Monatsabrechnung erstellen.</p>
        </div>
      </div>
      <PayrollManager sizeKinds={sizeKinds} teachers={teachers} />
    </>
  );
}
