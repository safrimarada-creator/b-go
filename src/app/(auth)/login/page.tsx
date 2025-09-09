// src/app/(auth)/login/page.tsx
"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Chrome, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { status } = useSession();
  const sp = useSearchParams();
  const router = useRouter();
  const callbackUrl = sp.get("callbackUrl") || "/customer";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-1">Masuk ke B-Go</h1>
        <p className="text-xs text-gray-500 mb-6">
          Gunakan akun Google untuk melanjutkan.
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          <Chrome className="w-4 h-4" />
          Lanjut dengan Google
        </button>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Kami tidak menyimpan kata sandi Anda.</span>
        </div>
      </div>
    </main>
  );
}
