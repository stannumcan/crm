import PermissionGate from "@/components/auth/PermissionGate";

export default function DDPCalcLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate pageKey="quotes_ddp_calc">{children}</PermissionGate>;
}
