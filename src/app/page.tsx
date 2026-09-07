import { LinguasudDashboard } from "@/components/linguasud-dashboard";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <LinguasudDashboard />;
}
