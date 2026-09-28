import { redirect } from "next/navigation";

import { CourseSizeKindManager } from "@/components/course-size-kind-manager";
import { LanguageManager } from "@/components/language-manager";
import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listCourseSizeKinds, listLanguages } from "@/server/services/course-master";

export default async function CourseMasterDataPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  const [languages, sizeKinds] = await Promise.all([listLanguages(true), listCourseSizeKinds(true)]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Kursstammdaten</h1>
          <p>Sprachen und Kursarten/Gruppengrössen pflegen.</p>
        </div>
      </div>
      <LanguageManager initialLanguages={languages} />
      <CourseSizeKindManager initialKinds={sizeKinds} />
    </>
  );
}
