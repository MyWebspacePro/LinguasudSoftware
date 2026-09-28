import { redirect } from "next/navigation";

import "../../globals.css";

export default async function PublicLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await params;
  void children;
  redirect("/");
}
