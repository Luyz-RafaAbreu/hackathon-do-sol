// ============================================================================
// lib/auth.ts — configuração NextAuth (Google OAuth)
// ----------------------------------------------------------------------------
// Gate de autenticação obrigatória pra /inscricao. Objetivo principal: dar
// à pessoa um identificador estável (e-mail Google) pra que o rascunho do
// formulário sobreviva a F5/fechar navegador E também sincronize entre
// dispositivos (ver lib/draft-store.ts + /api/draft).
//
// Estratégia de sessão: JWT (sem banco). NextAuth assina/verifica o token
// com AUTH_SECRET. Em middleware (Edge runtime) decodificamos via getToken
// — funciona sem chamar nenhuma API do Google em cada request.
//
// Por que NextAuth v4 e não v5 (Auth.js)?
//   v4 é estável, App Router suportado, documentação completa. v5 ainda é
//   beta em maio/2026 — não faz sentido apostar numa beta pra um form de
//   inscrição que precisa funcionar em ~5 semanas.
// ============================================================================

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Pede só o e-mail e perfil básico. Não pedimos drive/sheets/etc — o
      // OAuth consent screen mostra "Quer compartilhar seu nome, e-mail e
      // foto?", o que é o mínimo possível e baixa a fricção de aprovar.
      authorization: {
        params: {
          // `prompt=select_account` força o seletor de conta a cada login —
          // útil pra famílias/notebooks compartilhados onde 2 pessoas usam
          // o mesmo Chrome.
          prompt: "select_account",
          access_type: "online",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // 30 dias. Edital roda até 28/06; folga pra reabrir a aba uma semana
    // depois sem precisar autenticar de novo.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    // Sem página dedicada de signin — usamos modal global. Quando o NextAuth
    // precisa redirecionar pra signin (raro: erro de callback, signIn() sem
    // provider), manda pra home com ?login=1 que o SignInModalProvider
    // intercepta e abre o modal automaticamente.
    signIn: "/?login=1",
  },
  callbacks: {
    // Bloqueia login quando Google não confirmou o e-mail. Maioria das
    // contas vem com email_verified: true, mas contas Workspace migradas
    // ou pré-criadas por admin podem vir false — nesse caso o user pode
    // não ser o dono real do email, abre brecha pra alguém se inscrever
    // como outra pessoa.
    async signIn({ profile }) {
      if (!profile) return false;
      // Profile do Google tem email_verified, mas o tipo genérico Profile
      // do NextAuth não — daí o type guard.
      const p = profile as { email_verified?: boolean };
      if (p.email_verified === false) return false;
      return true;
    },
    // Anexa o ID do Google no token — útil pra usar como chave estável do
    // rascunho no servidor (não muda nem se o usuário trocar de e-mail).
    async jwt({ token, account, profile }) {
      if (account?.providerAccountId) {
        token.googleId = account.providerAccountId;
      }
      if (profile?.email) {
        token.email = profile.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Tipos em types/next-auth.d.ts declaram `googleId` em Session.user
      // e JWT — sem augmentation o TS reclamaria dessa atribuição.
      if (session.user) {
        session.user.googleId = token.googleId;
      }
      return session;
    },
  },
};
