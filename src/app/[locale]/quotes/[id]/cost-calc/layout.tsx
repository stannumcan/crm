import PermissionGate from "@/components/auth/PermissionGate";

export default function CostCalcLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate pageKey="quotes_wilfred_calc">{children}</PermissionGate>;
}
