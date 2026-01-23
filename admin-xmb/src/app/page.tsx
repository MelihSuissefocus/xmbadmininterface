import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const runtime = "nodejs";

export default async function Home() {
  const session = await auth();
  
  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
