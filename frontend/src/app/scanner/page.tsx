import { getSessionUser } from "@/lib/auth";
import { AuthGate } from "@/components/auth-gate";
import { ScannerClient } from "./scanner-client";

export default async function ScannerPage() {
  const user = await getSessionUser();
  return (
    <AuthGate initialUser={user}>
      <ScannerClient />
    </AuthGate>
  );
}
