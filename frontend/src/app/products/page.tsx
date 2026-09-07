import { getSessionUser } from "@/lib/auth";
import { AuthGate } from "@/components/auth-gate";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  const user = await getSessionUser();
  return (
    <AuthGate initialUser={user}>
      <ProductsClient />
    </AuthGate>
  );
}
