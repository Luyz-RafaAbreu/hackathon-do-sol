# Hackathon SOL — Landing Page

Landing page oficial do evento **Hackathon SOL** (26 a 28 de junho — Praiamar Arena).
Stack: **Next.js 14 + React + Tailwind CSS + TypeScript**.

## 🚀 Rodar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

## 🏗️ Build de produção

```bash
npm run build
npm run start
```

## 📂 Estrutura

```
app/
  layout.tsx          # SEO + metadata
  page.tsx            # Home
  globals.css         # Estilos globais
  api/inscricao/      # API que recebe o formulário
components/           # Header, Hero, Sobre, Informacoes, Cronograma,
                      # Materiais, Inscricao, FAQ, Footer
public/materiais/     # PDFs (edital, regulamento, guia)
```

## ✏️ O que editar

- Textos: diretamente nos componentes em `components/`.
- Arquivos para download: coloque PDFs em `public/materiais/`.
- Links sociais e contato: `components/Footer.tsx`.
- API: `app/api/inscricao/route.ts` (integre com banco, planilha, e-mail).

## 🌐 Como publicar em um domínio real

Veja as instruções completas no final da conversa (deploy Vercel + domínio).
