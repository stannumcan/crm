"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Division, UserDivisionContext } from "@/lib/divisions";

interface DivisionContextValue extends UserDivisionContext {
  /** True while the initial fetch is running */
  loading: boolean;
  /**
   * Switch active division and persist server-side. Pass null only if
   * the user is super-admin (combined view).
   */
  switchDivision: (divisionId: string | null) => Promise<void>;
  /** Force-refetch from /api/me/permissions */
  refresh: () => Promise<void>;
}

const DivisionContext = createContext<DivisionContextValue>({
  accessible_divisions: [],
  active_division: null,
  is_super_admin: false,
  loading: true,
  switchDivision: async () => {},
  refresh: async () => {},
});

export function DivisionProvider({ children }: { children: React.ReactNode }) {
  const [accessibleDivisions, setAccessibleDivisions] = useState<Division[]>([]);
  const [activeDivision, setActiveDivision] = useState<Division | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDivisionContext = useCallback(async () => {
    try {
      const res = await fetch("/api/me/permissions");
      const data = await res.json();
      setAccessibleDivisions(data.division?.accessible_divisions ?? []);
      setActiveDivision(data.division?.active_division ?? null);
      setIsSuperAdmin(data.division?.is_super_admin ?? false);
    } catch {
      // Ignore — likely unauthenticated
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDivisionContext();
  }, [fetchDivisionContext]);

  const switchDivision = useCallback(
    async (divisionId: string | null) => {
      const res = await fetch("/api/me/division", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ division_id: divisionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to switch division");
      }
      // Optimistically update local state
      const newActive = divisionId
        ? accessibleDivisions.find((d) => d.id === divisionId) ?? null
        : null;
      setActiveDivision(newActive);
    },
    [accessibleDivisions]
  );

  return (
    <DivisionContext.Provider
      value={{
        accessible_divisions: accessibleDivisions,
        active_division: activeDivision,
        is_super_admin: isSuperAdmin,
        loading,
        switchDivision,
        refresh: fetchDivisionContext,
      }}
    >
      {children}
    </DivisionContext.Provider>
  );
}

export function useDivision() {
  return useContext(DivisionContext);
}
