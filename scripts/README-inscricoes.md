# Sistema de Inscrições — Guia de Setup

Pipeline: **Formulário → API Next → Apps Script → Google Sheets + Drive + Gmail**

- Toda inscrição aparece como uma linha numa planilha do Google Sheets
- Arquivos anexados (comprovantes) ficam no Google Drive, linkados na planilha
- Quando você muda o **Status** da linha pra "Aprovado" ou "Reprovado",
  automaticamente vai um e-mail personalizado pra pessoa

---

## Passo 1 — Criar a planilha do Google

1. Acesse <https://sheets.google.com> com a conta que será a organização
   (sugestão: `hackathondosol@gmail.com`)
2. Clique em **+ Em branco** pra criar uma nova planilha
3. Dê um nome: "Hackathon do Sol — Inscrições"
4. **Menu: Extensões → Apps Script** (abre um editor novo)

## Passo 2 — Colar o script

1. No editor do Apps Script, apague qualquer código que estiver lá
2. Abra o arquivo [`apps-script.gs`](./apps-script.gs) do projeto (mesma pasta
   deste README)
3. Copie TODO o conteúdo e cole no editor
4. No topo do código tem uma seção `CONFIG` — edite principalmente o
   `WEBHOOK_SECRET`. Gere um token aleatório:
   - No console do navegador (F12): cole `crypto.randomUUID()` e copie o resultado
   - Ou qualquer string longa e imprevisível (32+ caracteres)
5. Salve (Ctrl+S) e dê um nome ao projeto, ex: "Hackathon Sol — Inscrições"

## Passo 3 — Rodar o setup uma vez

1. No editor do Apps Script, no dropdown do topo onde tem um nome de função,
   selecione **`setup`**
2. Clique em **Executar**
3. Vai abrir um popup pedindo autorização:
   - "Este app não foi verificado" → clique em **Avançado** → **Acessar (não seguro)**
   - (É seguro — é o código que VOCÊ colou; o aviso é genérico do Google)
4. Autorize acesso a **Planilhas**, **Drive** e **Gmail**
5. Se tudo certo, aparece um alerta "✓ Planilha configurada!"
6. Volte pra sua planilha — já vai ter uma aba **"Inscricoes"** com cabeçalhos
   coloridos e dropdown de Status configurado

## Passo 4 — Publicar como Web App

1. No editor do Apps Script, menu: **Implantar → Nova implantação**
2. Clique no ⚙️ ao lado de "Selecionar tipo" → escolha **"Aplicativo da Web"**
3. Configure:
   - **Descrição**: "Hackathon do Sol — Inscrições" (opcional)
   - **Executar como**: Eu (seu email)
   - **Quem tem acesso**: **"Qualquer pessoa"** ⚠️ importante
4. Clique em **Implantar** e **Autorizar acesso** se pedir
5. Vai aparecer uma **URL do Web App** — algo como
   `https://script.google.com/macros/s/AKfycbxxxxxxx/exec`
6. **Copie essa URL** — você vai usar no próximo passo

> Se precisar alterar o script depois, use **Implantar → Gerenciar implantações**
> → editar a implantação existente (NÃO crie uma nova, senão a URL muda).

## Passo 5 — Configurar o Next.js

1. Na raiz do projeto, crie um arquivo `.env.local` (copie de `.env.example`):

   ```bash
   cp .env.example .env.local
   ```

2. Edite `.env.local` com os valores reais:

   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

   APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/AKfycbxxxxxxx/exec
   APPS_SCRIPT_WEBHOOK_SECRET=<mesmo-valor-do-WEBHOOK_SECRET-no-apps-script>
   ```

3. Reinicie o `npm run dev` pra carregar as novas envs

## Passo 6 — Testar

1. Abra o site em <http://localhost:3000>
2. Preencha o formulário de inscrição com dados de teste (use seu próprio e-mail)
3. Anexe qualquer arquivo (PDF ou imagem, até 5MB)
4. Envie
5. Verifique:
   - Deve aparecer a mensagem de sucesso no site
   - Na **planilha do Google Sheets**: uma nova linha com Status "Pendente"
   - No **Google Drive** (raiz): pasta "Hackathon do Sol — Comprovantes" com
     uma subpasta com o nome da pessoa e os arquivos dentro

## Passo 7 — Aprovar uma inscrição

1. Abra a planilha
2. Na coluna **Status** da pessoa, clique na célula
3. Escolha **"Aprovado"** no dropdown
4. Em alguns segundos, a coluna **"Email enviado em"** preenche automaticamente
5. A pessoa recebe um e-mail HTML com identidade visual do evento

O mesmo funciona pra **"Reprovado"** — envia um e-mail cortês dizendo que a
vaga não foi confirmada.

> **Anti-reenvio**: se você mudar o status de volta ("Aprovado" → "Reprovado"),
> o sistema NÃO reenvia email. Pra forçar reenvio, limpe manualmente a célula
> "Email enviado em" daquela linha.

---

## Produção (deploy do site)

Quando for fazer deploy (Vercel, Netlify, etc.), configure as mesmas envs no
painel do provedor:

- `NEXT_PUBLIC_SITE_URL` → URL pública final (ex: `https://hackathondosol.com.br`)
- `APPS_SCRIPT_WEBHOOK_URL` → mesma do dev
- `APPS_SCRIPT_WEBHOOK_SECRET` → mesma do dev

---

## Limites grátis — pra saber até onde aguenta

| Recurso | Limite grátis | Nosso cenário |
|---|---|---|
| **Gmail** (envio) | 100 e-mails/dia | 160 aprovações cabem em 2 dias |
| **Drive** | 15 GB (compartilhado) | 160 × 3 arquivos × 5MB = 2.4 GB max |
| **Sheets** | 10 milhões de células | 160 linhas × 13 cols = 2080 |
| **Apps Script** | 90 min execução/dia | Cada inscrição usa ~5 segundos |

Zero risco de estourar.

---

## Troubleshooting

**"E-mail enviado em" fica com "ERRO: ..."**
→ Verifique se autorizou o Apps Script a enviar e-mails. Rode `setup` de novo.

**Formulário dá erro "sistema não configurado"**
→ `.env.local` não está preenchido ou o Next não foi reiniciado.

**Apps Script retorna 401 Unauthorized**
→ `WEBHOOK_SECRET` no script é DIFERENTE do `APPS_SCRIPT_WEBHOOK_SECRET` no `.env.local`.
Precisam ser idênticos.

**Mudei o status e o email não saiu**
→ O trigger `onEdit` é nativo do Sheets, mas só dispara quando VOCÊ edita
manualmente. Edições via API não disparam. Se você usou um script pra editar,
use `onChange` em vez de `onEdit`.

**Como atualizar o script sem mudar a URL do Web App**
→ Menu: Implantar → Gerenciar implantações → edite a existente → versão "Nova versão" → Implantar. A URL permanece.
