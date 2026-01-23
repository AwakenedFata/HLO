import { Suspense } from "react";
import AdminLoginPage from "@/components/pages/admin/AdminLoginPage";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <AdminLoginPage />
    </Suspense>
  );
}
