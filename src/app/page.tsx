"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <main className="p-6">Memeriksa sesi...</main>;
  }

  if (!session) {
    return (
      <main className="p-6 flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Selamat datang di B-Go</h1>
        <button
          onClick={() => signIn("google")}
          className="px-4 py-2 rounded-lg bg-red-500 text-white"
        >
          Login dengan Google
        </button>
      </main>
    );
  }

  return (
    <main className="p-6 flex flex-col gap-3">
      <h2 className="text-2xl">Halo, {session.user?.name}</h2>
      <p>Email: {session.user?.email}</p>
      <p>Role: {(session.user as any).role}</p>

      <div className="flex gap-2 mt-4">
        <Link
          href="/customer"
          className="px-3 py-2 bg-blue-600 text-white rounded-lg"
        >
          Ke Dashboard Customer
        </Link>
        <button
          onClick={() => signOut()}
          className="px-3 py-2 bg-gray-800 text-white rounded-lg"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
