# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev       # Next dev server em http://localhost:3001
npm run build     # build de produção
npm run start     # serve o build
npm run lint      # next lint
```

Scripts auxiliares (rodam manualmente, não entram no build):

```bash
node scripts/generate-blur.mjs    # regenera lib/blur-data.ts a partir de public/imagens/
node scripts/optimize-images.mjs  # gera logo.{webp,png}, story.webp, og.jpg em public/imagens/
```

Não há suíte de testes configurada.

## Arquitetura

### Stack
Next.js 14 (App Router) + React 18 + TypeScript estrito + Tailwind CSS. Alias `@/*` aponta pra raiz. Página única (`app/page.tsx`) que monta os componentes da landing em ordem.

### Pipeline de inscrição (parte mais não-óbvia do projeto)

`Formulário (Inscricao.tsx) → POST /api/inscricao → Apps Script Web App → Google Sheets + Drive + Gmail`

Pontos críticos:

- **`app/api/inscricao/route.ts`** é apenas um proxy validador. Recebe `FormData`, valida campos + arquivos (incluindo magic bytes pra detectar MIME falsificado), converte arquivos pra base64 e repassa ao Apps Script num envelope assinado por **HMAC-SHA256** sobre `${ts}.${payload}`. O Apps Script recalcula a assinatura e rejeita se não bater (ou se o `ts` tiver >5 min — anti-replay).
- **`scripts/apps-script.gs`** é o backend real. Vive no Google Apps Script — **não é executado pelo Next**, precisa ser colado manualmente no editor do Apps Script via `Extensões → Apps Script` na planilha do Google. O setup completo está em [scripts/README-inscricoes.md](scripts/README-inscricoes.md).
- O `WEBHOOK_SECRET` precisa ser **idêntico** entre `.env.local` (`APPS_SCRIPT_WEBHOOK_SECRET`) e o topo do `apps-script.gs` (`CONFIG.WEBHOOK_SECRET`).
- Mudanças em `apps-script.gs` no repo **não se propagam sozinhas** — depois de editar, copie de novo no editor do Apps Script e use `Implantar → Gerenciar implantações → Nova versão` (não nova implantação, senão a URL muda).
- Triggers de e-mail aprovação/reprovação rodam quando o usuário muda manualmente a coluna Status na planilha. É um **installable trigger** (`handleStatusChange`), não simple `onEdit` — edições via API não disparam.

### Limite de 4.5 MB do Vercel Hobby
Toda escolha de tamanho de arquivo deriva disso: `MAX_FILE_SIZE = 1 MB`, `MAX_FILES = 3`, `MAX_TOTAL_SIZE = 3 MB`. 3 MB raw → ~4 MB em base64, abaixo do teto de 4.5 MB. Se aumentar qualquer um, conferir o cálculo antes — o erro 413 acontece **antes** da rota Next ser chamada, então não dá pra interceptar com mensagem amigável.

### Rate limiting é por instância
`rateLimitStore` é um `Map` em memória. Em serverless (Vercel) cada instância tem o próprio store, então o limite real é maior que `RATE_LIMIT_MAX = 5/h`. Suficiente pro caso de uso, mas não confunda com proteção global. Pra defesa séria, migrar pra Upstash/Vercel KV.

### Single source of truth do evento
[lib/event.ts](lib/event.ts) — datas, local, prêmio, vagas. Importado por Hero, Countdown, layout (metadata + JSON-LD), OG image, Footer.

**Não cobertos pela constante** (textos narrativos embutidos): `Sobre.tsx`, `FAQ.tsx`, `Cronograma.tsx`, `Informacoes.tsx`, `NotFoundHero.tsx`, frase "160 vagas" em `Inscricao.tsx`, description em `app/not-found.tsx`, e o `CONFIG` do `apps-script.gs` (que vive separado no Google). Ao mudar data/local/prêmio, fazer busca por "26 a 28", "Praiamar", "10 mil", "160 vagas" pra cobrir o resto.

### Imagens OG/Twitter dinâmicas
`app/opengraph-image.tsx` e `app/twitter-image.tsx` rodam no edge runtime e geram PNG via `next/og` com countdown ao vivo (faltam X dias / acontecendo agora / edição passada). `revalidate = 3600` dá folga pro cache das redes sociais.

### blur-data.ts é gerado
[lib/blur-data.ts](lib/blur-data.ts) é **auto-gerado** por `scripts/generate-blur.mjs` — não editar à mão. Rodar o script depois de adicionar/trocar imagens em `public/imagens/`.

### Escala 4K
- `html { font-size: clamp(16px, calc(1.35vw - 10px), 48px) }` em [app/globals.css](app/globals.css) escala a base 16px → 48px entre 1080p e 5K. Como tudo usa `rem`, layout, tipografia e espaçamento crescem juntos.
- [tailwind.config.ts](tailwind.config.ts) **sobrescreve** os valores default de `boxShadow` e `blur` (que vêm em px) pra `rem` — isso é proposital, pra que sombras e blur escalem em 4K. Não trocar pra px sem entender o impacto.

### CSP relaxado em dev
[next.config.js](next.config.js) adiciona `'unsafe-eval'` e `ws:`/`wss:` à CSP **só** quando `NODE_ENV !== "production"` — pra HMR funcionar. Em produção a política fica estrita. Se algo carregar em dev e quebrar em prod, conferir essa parte primeiro.

### Cursor custom
Componente client (`components/CustomCursor.tsx`) montado no `RootLayout`. Estilos em `app/globals.css` sob `.cursor-cc`. Auto-desativa em touch/coarse pointer via media query — não precisa de feature detect no JS.

## Variáveis de ambiente

Copiar `.env.example` → `.env.local`:
- `NEXT_PUBLIC_SITE_URL` — usado em metadata SEO e JSON-LD
- `APPS_SCRIPT_WEBHOOK_URL` — URL do Web App publicado
- `APPS_SCRIPT_WEBHOOK_SECRET` — token HMAC, idêntico ao do `apps-script.gs`

Sem essas envs a rota `/api/inscricao` retorna 500 com mensagem "sistema não configurado".
