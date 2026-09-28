import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { TaskManager } from "@/components/task-manager";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { listPeople } from "@/server/services/people";
import { listTasks } from "@/server/services/tasks";

export default async function TasksPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin", "finance")) return <NoAccess />;

  const [tasks, people] = await Promise.all([listTasks({}), listPeople({})]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Aufgaben</h1>
          <p>Interne Aufgaben zuweisen, verfolgen und kommentieren.</p>
        </div>
      </div>
      <TaskManager initialTasks={tasks} people={people} />
    </>
  );
}
