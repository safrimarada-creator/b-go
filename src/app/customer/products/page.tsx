import SidebarCustomer from "@/components/SidebarCustomer";
import { Search, ShoppingBag } from "lucide-react";

export default function ProductsPage() {
  return (
    <div className="flex flex-col md:flex-row">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-16 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-4">🛍️ Belanja Produk</h1>
        <p className="text-gray-600 mb-6">
          Cari dan pesan produk dari berbagai merchant:
        </p>

        <div className="relative mb-6 max-w-lg">
          <input
            type="text"
            placeholder="Cari produk..."
            className="w-full p-3 pl-10 border rounded-md focus:outline-none focus:ring focus:border-yellow-500"
          />
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        </div>

        <div className="text-gray-500 italic">
          🔧 Daftar produk & kategori akan ditampilkan di sini.
        </div>
      </main>
    </div>
  );
}
