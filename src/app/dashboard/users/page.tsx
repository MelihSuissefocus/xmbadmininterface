import { getAllUsers } from "@/actions/users";
import { auth } from "@/auth";
import { UsersList } from "./users-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const allUsers = await getAllUsers();
  const session = await auth();
  const currentUserId = session?.user?.id;

  return <UsersList users={allUsers} currentUserId={currentUserId} />;
}

