// // src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// firebase-admin butuh Node.js runtime (bukan Edge)
export const runtime = "nodejs";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };


// src/app/api/auth/[...nextauth]/route.ts
