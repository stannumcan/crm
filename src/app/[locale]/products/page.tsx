import { createClient } from "@/lib/supabase/server";
import MoldImageManager from "@/components/products/MoldImageManager";

export default async function ProductsPage() {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: molds } = await (supabase as any)
    .from("molds")
    .select("id, mold_number, category, variant, dimensions, feature, image_url, is_active")
    .order("mold_number");

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">製品・金型画像 Mold Image Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click a mold card to upload or change its product image. Images appear in customer quotes.
        </p>
      </div>
      <MoldImageManager initialMolds={molds ?? []} />
    </div>
  );
}
