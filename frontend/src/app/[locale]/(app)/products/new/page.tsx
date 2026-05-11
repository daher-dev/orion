"use client";

import { useRouter } from "@/i18n/routing";
import { ProductFormSheet } from "@/components/products/ProductFormSheet";

/**
 * `/products/new` is a thin wrapper that opens the create sheet over the
 * (still-mounted) list page underneath. We push back to `/products` on close
 * so the sheet always overlays the list — mirroring the `New <X>` flows from
 * the design source where every "Novo …" action is a Sheet, not a route.
 */
export default function NewProductPage() {
  const router = useRouter();
  return (
    <ProductFormSheet
      open
      onOpenChange={(open) => {
        if (!open) router.push("/products");
      }}
    />
  );
}
