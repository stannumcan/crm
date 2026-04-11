import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("nav");
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("settings")}</h1>
      <p className="text-sm text-muted-foreground">App settings coming soon.</p>
    </div>
  );
}
