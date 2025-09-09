// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const role = req.nextauth?.token?.role as string | undefined;
        const path = req.nextUrl.pathname;

        // Blokir akses berdasarkan role
        if (path.startsWith("/admin") && role !== "admin") {
            return NextResponse.redirect(new URL("/login?error=AccessDenied", req.url));
        }
        if (path.startsWith("/driver") && role !== "driver") {
            return NextResponse.redirect(new URL("/login?error=AccessDenied", req.url));
        }
        if (path.startsWith("/merchant") && role !== "merchant") {
            return NextResponse.redirect(new URL("/login?error=AccessDenied", req.url));
        }

        // customer area aman diakses siapa saja yang login (opsional bisa dibatasi role === 'customer')
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token, // harus login dulu
        },
    }
);

export const config = {
    matcher: [
        "/admin/:path*",
        "/driver/:path*",
        "/merchant/:path*",
        "/customer/:path*",
    ],
};
