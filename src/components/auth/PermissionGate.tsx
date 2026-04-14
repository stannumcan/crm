"use client";

import { usePermissions } from "@/lib/permissions-context";
import type { PageKey } from "@/lib/permissions";

export default function PermissionGate({
  pageKey,
  children,
}: {
  pageKey: PageKey;
  children: React.ReactNode;
}) {
  const { canView, loading } = usePermissions();

  // Don't flash the protected content while we resolve permissions.
  if (loading) {
    return <div className="p-6" aria-busy="true" />;
  }

  if (!canView(pageKey)) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-800">
          <p className="font-semibold mb-1">Access denied</p>
          <p className="text-sm">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
