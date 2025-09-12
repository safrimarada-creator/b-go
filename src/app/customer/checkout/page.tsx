import { Suspense } from "react";
import CostumerCheckOut from "@/components/CostumerCheckOut";

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Memuat halaman checkout...</div>}>
      <CostumerCheckOut />
    </Suspense>
  );
}
