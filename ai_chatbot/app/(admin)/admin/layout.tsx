"use client";

import { notFound, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session?.user) {
      router.push("/login");
      return;
    }

    const permissions =
      (session.user as { permissions?: string[] }).permissions || [];
    const hasMetricsAccess = permissions.includes("metrics");

    if (!hasMetricsAccess) {
      notFound();
    }
  }, [session, status, router]);

  // Don't render children until permissions are verified
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-red-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If no permissions, don't render children (notFound() will redirect)
  const permissions =
    (session?.user as { permissions?: string[] }).permissions || [];
  const hasMetricsAccess = permissions.includes("metrics");

  if (!hasMetricsAccess) {
    return null;
  }

  return <>{children}</>;
}
