// Handler do NextAuth — captura todas as rotas /api/auth/*.
// Ver lib/auth.ts pra config (providers, callbacks, etc).
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
