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
node scripts/generate-blur.mjs            # regenera lib/blur-data.ts a partir de public/imagens/
node scripts/optimize-images.mjs          # gera logo.{webp,png}, story.webp, og.jpg em public/imagens/
node scripts/generate-icons.mjs --preview # preview do crop do sol em tmp-sun-preview.png (ajustar SUN_* antes do gerar final)
node scripts/generate-icons.mjs           # gera app/icon.png, app/apple-icon.png, app/favicon.ico
```

Não há suíte de testes configurada.

## Arquitetura

### Stack
Next.js 14 (App Router) + React 18 + TypeScript estrito + Tailwind CSS. Alias `@/*` aponta pra raiz. Página única (`app/page.tsx`) que monta os componentes da landing em ordem.

### Pipeline de inscrição (parte mais não-óbvia do projeto)

`Wizard (Inscricao.tsx) → POST /api/inscricao (JSON) → Apps Script Web App → Google Sheets + Gmail`

A inscrição é **por equipe de 4 integrantes** (item 4.5 do Edital), não individual. O fluxo:

- **`lib/inscricao-schema.ts`** é a fonte canônica — tipos do FormState, opções de selects, limites por campo, validadores puros (CPF, idade ≥ 18 até 24/06/2026, LinkedIn, email, telefone BR) e a lista de aceites individuais (9 por integrante) e coletivos (7 pela equipe), com texto referenciando itens do Edital. Importado por client E API.
- **`components/Inscricao.tsx`** é um wizard de 9 etapas: Equipe → Trilha → Integrante 1..4 → Proposta → Aceites coletivos → Confirmação do líder. Salva rascunho em `localStorage` (`hackathon-sol-inscricao-draft-v1`) entre etapas, restaura no mount e limpa após envio bem-sucedido. Cache de cidades do IBGE (`useRef` no orquestrador) é compartilhado por todos os 5 selects de UF/Cidade do form.
- **`app/api/inscricao/route.ts`** é um proxy validador. Recebe JSON `{ state, turnstileToken, honeypot }`, valida via `validateAll()` do schema (defesa quando o front é burlado), normaliza com `normalizeForm()` e repassa ao Apps Script num envelope assinado por **HMAC-SHA256** sobre `${ts}.${payload}` com `v: 2`. Cap de 200 KB no payload.
- **`scripts/apps-script.gs`** é o backend real. Vive no Google Apps Script — **não é executado pelo Next**. Sincronizado via [clasp](https://github.com/google/clasp): `npm run apps-script:push` envia o código pro projeto remoto, `npm run apps-script:deploy` faz push + redeploy do web app mantendo a URL. O `.clasp.json` em `scripts/` aponta pro projeto correto; `.claspignore` evita que outros scripts do diretório (`.mjs`, etc) vão junto. Faz dedup por CPF (item 3.2 do Edital — 1 inscrição por CPF, checa todos os 4 CPFs contra todas as 4 colunas de CPF das equipes existentes) e por e-mail (oficial + 4 pessoais).
- A planilha tem **143 colunas** numa linha por equipe: meta (4) + equipe (8) + proposta (6) + aceites coletivos (1 concat) + integrante (31 colunas × 4). `setup()` cria tudo via `COLUMNS` array — se mudar campos no schema, atualizar tanto `lib/inscricao-schema.ts` quanto o `FIELD_MAX` no topo do `apps-script.gs`.
- E-mails de confirmação, aprovação e reprovação vão pros **4 integrantes simultaneamente** (todos no `to:`). O líder não recebe individualmente — recebe junto com os outros 3.
- Triggers de e-mail aprovação/reprovação rodam quando o admin muda manualmente a coluna Status (A) na planilha. É um **installable trigger** (`handleStatusChange`), não simple `onEdit` — edições via API não disparam. O EMAIL_SENT_COL (coluna C) guarda "Aprovação · timestamp" ou "Reprovação · timestamp" e bloqueia reenvio do mesmo tipo (mas permite Aprovado↔Reprovado).
- O `WEBHOOK_SECRET` vive nas **Script Properties** do projeto Apps Script (`⚙ Project Settings → Script Properties → WEBHOOK_SECRET`), NÃO no código. Isso desacopla o secret do versionamento — `clasp push` nunca afeta o valor. Tem que bater com `APPS_SCRIPT_WEBHOOK_SECRET` do `.env.local`.
- Mudanças em `apps-script.gs` se propagam via `npm run apps-script:deploy` (push + redeploy mantendo a URL do web app). Nunca usar "Nova implantação" pela UI — isso muda a URL e quebra o `.env.local`.

### Sem upload de arquivos
A inscrição V2 (por equipe) substituiu uploads por **links** (LinkedIn obrigatório + portfólio opcional por integrante). O LinkedIn é usado pra análise no processo seletivo (item 3.3.1.a do Edital). Sem uploads, o teto de 4.5 MB do Vercel Hobby deixa de ser preocupação — payload típico fica em ~30 KB.

### Rate limiting é por instância
`rateLimitStore` é um `Map` em memória. Em serverless (Vercel) cada instância tem o próprio store, então o limite real é maior que `RATE_LIMIT_MAX = 5/h`. Suficiente pro caso de uso, mas não confunda com proteção global. Pra defesa séria, migrar pra Upstash/Vercel KV.

### Single source of truth do evento
[lib/event.ts](lib/event.ts) — datas, local, prêmio, vagas. Importado por Hero, Countdown, layout (metadata + JSON-LD), OG image, Footer.

**Não cobertos pela constante** (textos narrativos embutidos): `Sobre.tsx`, `FAQ.tsx`, `Cronograma.tsx`, `Informacoes.tsx`, `NotFoundHero.tsx`, frase "160 vagas" em `Inscricao.tsx`, description em `app/not-found.tsx`, e o `CONFIG` do `apps-script.gs` (que vive separado no Google). Ao mudar data/local/prêmio, fazer busca por "26 a 28", "Praiamar", "10 mil", "160 vagas" pra cobrir o resto.

### Imagens OG/Twitter dinâmicas
`app/opengraph-image.tsx` e `app/twitter-image.tsx` rodam no edge runtime e geram PNG via `next/og` com countdown ao vivo (faltam X dias / acontecendo agora / edição passada). `revalidate = 3600` dá folga pro cache das redes sociais.

### Ícones e manifest
Next descobre por convenção em `app/`:
- `app/favicon.ico` — aba do navegador, **só o sol recortado** do logo (texto fica ilegível em 32x32)
- `app/icon.png` (512x512) — Android e browsers modernos
- `app/apple-icon.png` (180x180) — iOS "adicionar à tela inicial"
- `app/manifest.ts` — `name`, `theme_color`, ícones; usado quando o app é instalado

Os três bitmaps são gerados de `public/imagens/logo-hd.webp` por `scripts/generate-icons.mjs` (ver coordenadas `SUN_*` no topo). Rodar `--preview` antes do final pra inspecionar o crop. `viewport.themeColor` em [app/layout.tsx](app/layout.tsx) deve bater com `theme_color` do manifest.

### blur-data.ts é gerado
[lib/blur-data.ts](lib/blur-data.ts) é **auto-gerado** por `scripts/generate-blur.mjs` — não editar à mão. Rodar o script depois de adicionar/trocar imagens em `public/imagens/`.

### Escala 4K
- `html { font-size: clamp(16px, calc(1.35vw - 10px), 48px) }` em [app/globals.css](app/globals.css) escala a base 16px → 48px entre 1080p e 5K. Como tudo usa `rem`, layout, tipografia e espaçamento crescem juntos.
- [tailwind.config.ts](tailwind.config.ts) **sobrescreve** os valores default de `boxShadow` e `blur` (que vêm em px) pra `rem` — isso é proposital, pra que sombras e blur escalem em 4K. Não trocar pra px sem entender o impacto.

### CSP com nonce por request
[middleware.ts](middleware.ts) gera um nonce aleatório (16 bytes em base64) por request e monta o `Content-Security-Policy`. Scripts inline só rodam se carregarem aquele nonce — o Next aplica automaticamente nos `<script>` de hydration; pra inline scripts nossos (ex: JSON-LD em [app/layout.tsx](app/layout.tsx)), ler via `headers().get("x-nonce")` e passar pra prop `nonce`. `'strict-dynamic'` propaga a confiança pra scripts carregados pelos confiáveis (Turnstile, Vercel Analytics/Speed Insights). [next.config.js](next.config.js) cuida só dos headers estáticos (X-Frame-Options, etc.) que valem inclusive pra `/api`. Em dev, o middleware adiciona `'unsafe-eval'` e `ws:`/`wss:` pra HMR funcionar.

**Limitações:** páginas cobertas pelo middleware viram dinâmicas (nonce muda por request, sem SSG). Matcher exclui `/api`, `_next/static`, `_next/image`, `imagens`, `favicon.ico`, `robots.txt`, `sitemap.xml`. `style-src` segue com `'unsafe-inline'` — CSS injection é vetor estreito, Tailwind/styled-jsx dependem.

### Cursor custom
Componente client (`components/CustomCursor.tsx`) montado no `RootLayout`. Estilos em `app/globals.css` sob `.cursor-cc`. Auto-desativa em touch/coarse pointer via media query — não precisa de feature detect no JS.

## Variáveis de ambiente

Copiar `.env.example` → `.env.local`:
- `NEXT_PUBLIC_SITE_URL` — usado em metadata SEO e JSON-LD
- `APPS_SCRIPT_WEBHOOK_URL` — URL do Web App publicado
- `APPS_SCRIPT_WEBHOOK_SECRET` — token HMAC, idêntico ao do `apps-script.gs`

Sem essas envs a rota `/api/inscricao` retorna 500 com mensagem "sistema não configurado".
