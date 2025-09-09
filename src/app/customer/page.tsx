// src/app/customer/page.tsx
import SidebarCustomer from "@/components/SidebarCustomer";
import Link from "next/link";

// Import ikon modern dari lucide-react
import {
  Car,
  ShoppingBag,
  WashingMachine,
  Package as PackageIcon,
} from "lucide-react";

export default function CustomerDashboard() {
  // Definisi layanan dengan ikon, slug, dan warna latar
  const services = [
    {
      name: "Pesan Ojek / Ride",
      slug: "ride",
      bg: "bg-green-100",
      icon: <Car className="w-8 h-8 text-green-600" />,
    },
    {
      name: "Belanja Produk",
      slug: "products",
      bg: "bg-yellow-100",
      icon: <ShoppingBag className="w-8 h-8 text-yellow-600" />,
    },
    {
      name: "Laundry",
      slug: "laundry",
      bg: "bg-blue-100",
      icon: <WashingMachine className="w-8 h-8 text-blue-600" />,
    },
    {
      name: "Kirim Barang",
      slug: "delivery",
      bg: "bg-purple-100",
      icon: <PackageIcon className="w-8 h-8 text-purple-600" />,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row">
      {/* Sidebar customer responsif */}
      <SidebarCustomer />

      {/* Konten utama */}
      <main className="flex-1 p-6 pt-16 md:pt-6 md:ml-64">
        <h1 className="text-3xl font-bold mb-4">🏠 Dashboard Customer</h1>
        <p className="text-gray-600 mb-6">
          Selamat datang di <strong>B-Go</strong>. Silakan pilih layanan
          berikut:
        </p>

        {/* Grid layanan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
          {services.map((svc) => (
            <Link
              key={svc.slug}
              href={`/customer/${svc.slug}`}
              className={`flex items-center gap-4 p-4 rounded-xl hover:bg-opacity-80 transition ${svc.bg}`}
            >
              {/* Tampilkan ikon modern */}
              {svc.icon}
              <span className="text-lg font-medium">{svc.name}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
