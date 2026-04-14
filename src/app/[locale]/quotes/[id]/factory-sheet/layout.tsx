import PermissionGate from "@/components/auth/PermissionGate";

export default function FactorySheetLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate pageKey="quotes_factory_sheet">{children}</PermissionGate>;
}
