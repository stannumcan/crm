import MoldCatalog from "@/components/products/MoldCatalog";

export default function ProductsPage() {
  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">金型カタログ Mold Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage molds, dimensions, and product images. Images appear in customer quotes.
        </p>
      </div>
      <MoldCatalog />
    </div>
  );
}
