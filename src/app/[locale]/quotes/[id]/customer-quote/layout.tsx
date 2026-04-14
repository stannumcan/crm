import PermissionGate from "@/components/auth/PermissionGate";

export default function CustomerQuoteLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate pageKey="quotes_customer_quote">{children}</PermissionGate>;
}
