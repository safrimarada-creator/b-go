import SidebarCustomer from "@/components/SidebarCustomer";
import { Shirt, Clock } from "lucide-react";

export default function LaundryPage() {
  return (
    <div className="flex flex-col md:flex-row">
      <SidebarCustomer />
      <main className="flex-1 p-6 pt-16 md:pt-6 md:ml-64">
        <h1 className="text-2xl font-bold mb-4">🧺 Laundry</h1>
        <p className="text-gray-600 mb-6">
          Pilih layanan laundry sesuai kebutuhan:
        </p>

        <div className="space-y-4 max-w-lg">
          <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-blue-50">
            <Shirt className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <p className="font-medium">Cuci & Setrika</p>
              <p className="text-sm text-gray-600">
                Layanan standar per kilo, siap dalam 2-3 hari.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-blue-50">
            <Clock className="w-6 h-6 text-blue-600 mt-1" />
            <div>
              <p className="font-medium">Layanan Ekspres</p>
              <p className="text-sm text-gray-600">
                Selesai dalam 1 hari. Cocok untuk kebutuhan mendesak.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
