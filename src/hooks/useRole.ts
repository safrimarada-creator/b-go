"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRole(requiredRole: string) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return; // tunggu session selesai
        if (!session) {
            router.push("/"); // belum login → balik ke home
        } else if ((session.user as any).role !== requiredRole) {
            router.push("/"); // salah role → redirect
        }
    }, [session, status, router, requiredRole]);

    return { session, status };
}
