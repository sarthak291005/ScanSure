import { getSessionUser } from "@/lib/auth";
import { AuthGate } from "@/components/auth-gate";
import { DashboardClient } from "./dashboard-client";

export default async function Home() {
  const user = await getSessionUser();
  return (
    <AuthGate initialUser={user}>
      <DashboardClient />
    </AuthGate>
  );
}
