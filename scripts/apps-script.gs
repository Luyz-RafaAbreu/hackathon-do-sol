/**
 * ============================================================================
 *  HACKATHON DO SOL — Sistema de Inscrições
 *  Google Apps Script
 * ----------------------------------------------------------------------------
 *  O que este script faz:
 *    1. Recebe inscrições via POST do site (função `doPost`)
 *    2. Salva cada inscrição como uma linha na aba "Inscricoes"
 *    3. Sobe os arquivos anexados (comprovantes) para uma pasta do Drive
 *    4. Quando você muda o Status de "Pendente" → "Aprovado" ou "Reprovado"
 *       na planilha, automaticamente envia e-mail para a pessoa (função `onEdit`)
 *
 *  SETUP (passo a passo):
 *    1. Abra sua planilha do Google Sheets (ou crie uma nova)
 *    2. Menu: Extensões → Apps Script
 *    3. Apague qualquer código padrão e cole TUDO deste arquivo
 *    4. Edite a seção CONFIG abaixo (especialmente WEBHOOK_SECRET!)
 *    5. Salve (Ctrl+S) e dê um nome ao projeto
 *    6. Execute a função `setup` uma vez (clique em "Executar" com ela selecionada)
 *         - Autorize quando pedir (precisa de acesso a Planilhas, Drive e Gmail)
 *    7. Menu: Implantar → Nova implantação → tipo "Aplicativo da Web"
 *         - Executar como: "Eu (seu-email@gmail.com)"
 *         - Quem tem acesso: "Qualquer pessoa"
 *         - Clique em Implantar e AUTORIZE
 *    8. Copie a URL que aparece (algo tipo https://script.google.com/macros/s/AKfycb.../exec)
 *    9. Coloque essa URL + o WEBHOOK_SECRET no arquivo `.env.local` do projeto Next:
 *         APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
 *         APPS_SCRIPT_WEBHOOK_SECRET=o-mesmo-valor-definido-abaixo
 * ============================================================================
 */

// ============================================================================
// CONFIG — edite aqui
// ============================================================================
const CONFIG = {
  // Token secreto compartilhado com o Next.js — previne spam/chamadas externas.
  // Gere uma string aleatória (ex: abra o DevTools, cole: crypto.randomUUID())
  WEBHOOK_SECRET: "TROQUE-ISSO-POR-UM-TOKEN-SECRETO-ALEATORIO",

  // Informações do evento — usadas nos e-mails
  EVENT_NAME: "Hackathon do Sol",
  EVENT_DATE: "26 a 28 de junho de 2026",
  EVENT_LOCATION: "Praiamar Arena, Natal/RN",
  EVENT_PRIZE: "R$ 10 mil em premiação",
  EVENT_INSTAGRAM: "@hackathondosol",
  SITE_URL: "https://hackathondosol.com.br",

  // Remetente dos e-mails (aparece no inbox da pessoa)
  EMAIL_FROM_NAME: "Hackathon do Sol",

  // Nomes internos (só mude se souber o que tá fazendo)
  SHEET_NAME: "Inscricoes",
  DRIVE_FOLDER_NAME: "Hackathon do Sol — Comprovantes",
  TIMEZONE: "America/Recife",
};

// Colunas da planilha (A, B, C, ...). Não mude a ordem depois do setup!
const COLUMNS = [
  "Status",           // A  — dropdown: Pendente / Aprovado / Reprovado
  "Data inscrição",   // B
  "Nome",             // C
  "E-mail",           // D
  "Telefone",         // E
  "Cidade/UF",        // F
  "Instituição",      // G
  "Área",             // H
  "Experiência",      // I
  "Motivação",        // J
  "Comprovantes",     // K  — links pros arquivos no Drive
  "Email enviado em", // L  — marcado automaticamente
  "Observações",      // M  — campo livre pra anotações internas
];
const STATUS_COL = 1;      // A
const EMAIL_SENT_COL = 12; // L

// ============================================================================
// SETUP — rode 1x manualmente para preparar a planilha
// ============================================================================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  // Header
  sheet.clear();
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  sheet
    .getRange(1, 1, 1, COLUMNS.length)
    .setFontWeight("bold")
    .setBackground("#4c1d95")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);

  // Data validation (dropdown) na coluna Status
  const statusRange = sheet.getRange(2, STATUS_COL, 1000, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pendente", "Aprovado", "Reprovado"], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(rule);

  // Conditional formatting por status
  const rules = sheet.getConditionalFormatRules();
  rules.length = 0;
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Aprovado")
      .setBackground("#d1fae5")
      .setFontColor("#064e3b")
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Reprovado")
      .setBackground("#fee2e2")
      .setFontColor("#7f1d1d")
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Pendente")
      .setBackground("#fef3c7")
      .setFontColor("#78350f")
      .setRanges([statusRange])
      .build()
  );
  sheet.setConditionalFormatRules(rules);

  // Larguras aproximadas
  const widths = [110, 140, 180, 200, 130, 130, 160, 140, 130, 280, 200, 140, 200];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  SpreadsheetApp.getUi().alert(
    "✓ Planilha configurada!\n\n" +
      "Próximos passos:\n" +
      "1. Edite o WEBHOOK_SECRET no topo do script\n" +
      "2. Menu: Implantar → Nova implantação → Aplicativo da Web\n" +
      "3. Copie a URL gerada e coloque no .env.local do Next"
  );
}

// ============================================================================
// doPost — endpoint que recebe inscrições do Next.js
// ============================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Empty body" });
    }
    const data = JSON.parse(e.postData.contents);

    // Autenticação via token compartilhado
    if (data.secret !== CONFIG.WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    // Validação básica
    const required = [
      "nome",
      "email",
      "telefone",
      "cidadeEstado",
      "instituicao",
      "area",
      "experiencia",
      "motivacao",
    ];
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === "") {
        return jsonResponse({ ok: false, error: "Missing field: " + k });
      }
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      CONFIG.SHEET_NAME
    );
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: "Sheet not found. Run setup() first.",
      });
    }

    // Subir arquivos pro Drive
    let fileLinks = "";
    if (Array.isArray(data.comprovantes) && data.comprovantes.length > 0) {
      const rootFolder = getOrCreateFolder(CONFIG.DRIVE_FOLDER_NAME);
      const safeName = String(data.nome)
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .substring(0, 60);
      const stamp = Utilities.formatDate(
        new Date(),
        CONFIG.TIMEZONE,
        "yyyyMMdd-HHmmss"
      );
      const personFolder = rootFolder.createFolder(`${safeName} — ${stamp}`);

      const links = [];
      for (const f of data.comprovantes) {
        try {
          const bytes = Utilities.base64Decode(f.data);
          const blob = Utilities.newBlob(bytes, f.type || "application/octet-stream", f.name);
          const file = personFolder.createFile(blob);
          links.push(`${f.name}: ${file.getUrl()}`);
        } catch (errFile) {
          links.push(`${f.name}: ERRO ao salvar (${errFile.message})`);
        }
      }
      fileLinks = links.join("\n");
    }

    // Adiciona row
    const now = new Date();
    sheet.appendRow([
      "Pendente",
      Utilities.formatDate(now, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"),
      data.nome,
      data.email,
      data.telefone,
      data.cidadeEstado,
      data.instituicao,
      data.area,
      data.experiencia,
      data.motivacao,
      fileLinks,
      "",
      "",
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ============================================================================
// onEdit — trigger nativo, dispara quando você muda o Status
// ============================================================================
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();

    if (sheet.getName() !== CONFIG.SHEET_NAME) return;
    if (range.getColumn() !== STATUS_COL) return;
    if (range.getRow() < 2) return;

    const newStatus = String(range.getValue()).trim();
    const oldStatus = String(e.oldValue || "").trim();

    if (newStatus === oldStatus) return;
    if (!["Aprovado", "Reprovado"].includes(newStatus)) return;

    const row = range.getRow();
    const rowData = sheet.getRange(row, 1, 1, COLUMNS.length).getValues()[0];
    const nome = rowData[2];
    const email = rowData[3];

    if (!email) {
      sheet.getRange(row, EMAIL_SENT_COL).setValue("ERRO: sem e-mail");
      return;
    }

    // Se já foi enviado, não reenvia
    const already = String(rowData[EMAIL_SENT_COL - 1] || "").trim();
    if (already && !already.startsWith("ERRO")) return;

    if (newStatus === "Aprovado") {
      sendApprovalEmail(email, nome);
    } else {
      sendRejectionEmail(email, nome);
    }

    sheet
      .getRange(row, EMAIL_SENT_COL)
      .setValue(
        Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm")
      );
  } catch (err) {
    console.error(err);
    try {
      e.range
        .getSheet()
        .getRange(e.range.getRow(), EMAIL_SENT_COL)
        .setValue("ERRO: " + err.message);
    } catch (_) {}
  }
}

// ============================================================================
// Envio dos e-mails
// ============================================================================
function sendApprovalEmail(to, name) {
  MailApp.sendEmail({
    to: to,
    subject: `Sua inscrição no ${CONFIG.EVENT_NAME} foi aprovada!`,
    htmlBody: buildApprovalHTML(name),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}

function sendRejectionEmail(to, name) {
  MailApp.sendEmail({
    to: to,
    subject: `Sobre sua inscrição no ${CONFIG.EVENT_NAME}`,
    htmlBody: buildRejectionHTML(name),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}

// ============================================================================
// Templates HTML dos e-mails
// ============================================================================
function buildApprovalHTML(name) {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0f0624;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#ffffff">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:20px 0">
      <div style="font-weight:bold;font-size:20px;letter-spacing:-0.5px">
        Hackathon <span style="background:linear-gradient(90deg,#ffc830,#ff8c00);-webkit-background-clip:text;background-clip:text;color:transparent">do Sol</span>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:32px 28px">
      <div style="color:#ff8c00;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;font-weight:600">
        — Inscrição aprovada
      </div>
      <h1 style="font-weight:bold;font-size:26px;line-height:1.2;margin:0 0 18px">
        Bem-vindo(a) ao <span style="background:linear-gradient(90deg,#ffc830,#ff8c00,#e879f9);-webkit-background-clip:text;background-clip:text;color:transparent">Hackathon do Sol</span>, ${escapeHtml(name)}!
      </h1>
      <p style="color:rgba(255,255,255,0.8);line-height:1.65;margin:16px 0;font-size:15px">
        Sua inscrição foi aprovada e você está oficialmente confirmado(a) no evento.
        Três dias intensos de inovação, código e colaboração pela frente — e
        <strong style="color:#ffc830">${CONFIG.EVENT_PRIZE}</strong> em disputa.
      </p>
      <div style="background:rgba(255,140,0,0.08);border-left:3px solid #ff8c00;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0">
        <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Quando</div>
        <div style="font-weight:600;margin-bottom:12px;font-size:15px">${CONFIG.EVENT_DATE}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Onde</div>
        <div style="font-weight:600;font-size:15px">${CONFIG.EVENT_LOCATION}</div>
      </div>
      <p style="color:rgba(255,255,255,0.7);line-height:1.65;font-size:14px;margin:16px 0">
        Em breve enviamos mais detalhes: cronograma completo, instruções de check-in,
        dinâmica de formação de equipes e o que trazer. Fique atento(a) a este e-mail.
      </p>
      <div style="text-align:center;margin-top:28px">
        <a href="${CONFIG.SITE_URL}" style="display:inline-block;background:#ff8c00;color:#000000;font-weight:600;padding:13px 28px;border-radius:999px;text-decoration:none;font-size:14px">
          Acessar o site do evento
        </a>
      </div>
    </div>
    <div style="text-align:center;padding:22px 8px;color:rgba(255,255,255,0.4);font-size:11px;line-height:1.6">
      Hackathon do Sol · ${CONFIG.EVENT_DATE} · ${CONFIG.EVENT_LOCATION}<br>
      Instagram: ${CONFIG.EVENT_INSTAGRAM}
    </div>
  </div>
</body>
</html>`;
}

function buildRejectionHTML(name) {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#0f0624;font-family:'Segoe UI',Inter,Arial,sans-serif;color:#ffffff">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:20px 0">
      <div style="font-weight:bold;font-size:20px;letter-spacing:-0.5px">
        Hackathon <span style="background:linear-gradient(90deg,#ffc830,#ff8c00);-webkit-background-clip:text;background-clip:text;color:transparent">do Sol</span>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:32px 28px">
      <h1 style="font-weight:bold;font-size:22px;line-height:1.3;margin:0 0 16px">
        Olá, ${escapeHtml(name)}
      </h1>
      <p style="color:rgba(255,255,255,0.8);line-height:1.65;margin:16px 0;font-size:15px">
        Agradecemos muito o seu interesse em participar do Hackathon do Sol 2026.
        Recebemos um número de inscrições bem acima das 160 vagas disponíveis, e
        infelizmente não foi possível confirmar sua vaga nesta edição.
      </p>
      <p style="color:rgba(255,255,255,0.8);line-height:1.65;margin:16px 0;font-size:15px">
        Vamos ficar felizes em te ver nas próximas edições. Acompanhe nosso Instagram
        <a href="https://instagram.com/${CONFIG.EVENT_INSTAGRAM.replace("@", "")}" style="color:#ff8c00;text-decoration:none">${CONFIG.EVENT_INSTAGRAM}</a>
        pra novidades sobre a comunidade e os próximos eventos.
      </p>
      <p style="color:rgba(255,255,255,0.65);line-height:1.65;font-size:14px;margin-top:24px">
        Um forte abraço,<br>
        <strong style="color:rgba(255,255,255,0.85)">Equipe Hackathon do Sol</strong>
      </p>
    </div>
    <div style="text-align:center;padding:22px 8px;color:rgba(255,255,255,0.4);font-size:11px;line-height:1.6">
      Hackathon do Sol · ${CONFIG.EVENT_DATE}
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// Utilitários
// ============================================================================
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}
