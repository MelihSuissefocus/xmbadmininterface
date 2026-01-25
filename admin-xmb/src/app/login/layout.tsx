import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const runtime = "nodejs";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (session) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

