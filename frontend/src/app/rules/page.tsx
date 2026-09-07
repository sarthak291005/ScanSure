import { getSessionUser } from "@/lib/auth";
import { AuthGate } from "@/components/auth-gate";
import { RulesClient } from "./rules-client";

export default async function RulesPage() {
  const user = await getSessionUser();
  return (
    <AuthGate initialUser={user}>
      <RulesClient />
    </AuthGate>
  );
}
