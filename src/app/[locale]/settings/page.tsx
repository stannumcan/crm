import MoldsSettings from "@/components/settings/MoldsSettings";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("nav");
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("settings")}</h1>
      <MoldsSettings />
    </div>
  );
}
