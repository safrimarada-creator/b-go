"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-green-600 text-white shadow-md">
      {/* Logo */}
      <Link href="/" className="text-xl font-bold">
        🚖 B-Go
      </Link>

      {/* Menu dinamis */}
      <div className="flex items-center gap-4">
        <Link href="/">Home</Link>

        {role === "customer" && <Link href="/customer">Customer</Link>}
        {role === "driver" && <Link href="/driver">Driver</Link>}
        {role === "merchant" && <Link href="/merchant">Merchant</Link>}
        {role === "admin" && <Link href="/admin">Admin</Link>}

        {/* Login/Logout Button */}
        {status === "loading" ? (
          <span>Loading...</span>
        ) : session ? (
          <>
            <span className="hidden md:inline">
              Halo, {session.user?.name?.split(" ")[0]}
            </span>
            <button
              onClick={() => signOut()}
              className="px-3 py-1 bg-red-500 rounded-lg"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="px-3 py-1 bg-blue-500 rounded-lg"
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
