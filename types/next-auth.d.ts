// ============================================================================
// types/next-auth.d.ts — module augmentation pra NextAuth
// ----------------------------------------------------------------------------
// Adiciona o campo `googleId` em Session.user e em JWT — o NextAuth não sabe
// dessa extensão por padrão. Sem isso, todo lugar que lê `session.user.googleId`
// ou `token.googleId` precisaria de `@ts-expect-error`.
//
// A propriedade é populada nos callbacks `jwt`/`session` de lib/auth.ts.
// Marcada como opcional (`?: string`) porque um token muito antigo (criado
// antes do callback existir) pode não ter o campo.
//
// O arquivo é carregado automaticamente pelo TypeScript via o glob `**/*.ts`
// do tsconfig.json — não precisa importar em lugar nenhum.
// ============================================================================
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      googleId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string;
  }
}
