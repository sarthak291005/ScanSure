import { getSessionUser } from "@/lib/auth";
import { AuthGate } from "@/components/auth-gate";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const user = await getSessionUser();
  return (
    <AuthGate initialUser={user}>
      <ReportsClient />
    </AuthGate>
  );
}
