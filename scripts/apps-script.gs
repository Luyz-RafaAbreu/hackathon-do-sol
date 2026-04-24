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

    // Dedup — rejeita se o email já existe (coluna D / col 4).
    // Feito ANTES do upload pra não gastar cota do Drive à toa.
    const emailLower = String(data.email).trim().toLowerCase();
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const emailsRange = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
      const alreadyRegistered = emailsRange.some(function (row) {
        return String(row[0] || "").trim().toLowerCase() === emailLower;
      });
      if (alreadyRegistered) {
        return jsonResponse({ ok: false, error: "duplicate_email" });
      }
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
    subject: `Você está dentro — ${CONFIG.EVENT_NAME} confirmou sua vaga`,
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
  const rawFirstName = String(name || "").trim().split(/\s+/)[0] || "";
  const firstName = escapeHtml(rawFirstName);
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sua vaga está confirmada</title>
</head>
<body style="margin:0;padding:0;background:#0f0624;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased">
  <!-- preview text (aparece no inbox antes de abrir o email) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    Sua inscrição foi confirmada. 26 a 28 de junho em Natal/RN. Te vemos lá.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f0624">
    <tr>
      <td align="center" style="padding:32px 16px 48px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%">

          <!-- Brand: mini sun + wordmark -->
          <tr>
            <td align="center" style="padding:8px 0 28px">
              <div style="display:inline-block;width:38px;height:38px;border-radius:50%;background-color:#ff8c00;background:radial-gradient(circle,#fff7d4 0%,#ffd34f 28%,#ff8c00 68%,#ff6b00 100%);margin-bottom:14px"></div>
              <div style="font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.4px;color:#ffffff">
                Hackathon
                <span style="color:#ffa530;background:linear-gradient(90deg,#ffc830,#ff8c00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">&nbsp;do Sol</span>
              </div>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#180a34;background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%),#180a34;border:1px solid rgba(255,255,255,0.08);border-radius:18px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <!-- accent line top -->
                <tr>
                  <td style="height:3px;line-height:3px;font-size:3px;background:#ff8c00;background:linear-gradient(90deg,#ffc830,#ff8c00,#e879f9);border-top-left-radius:18px;border-top-right-radius:18px">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:40px 36px 36px">

                    <!-- Eyebrow -->
                    <div style="color:#ff8c00;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:18px">
                      ✦ &nbsp;Inscrição confirmada
                    </div>

                    <!-- Title -->
                    <h1 style="margin:0 0 18px;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:30px;line-height:1.15;letter-spacing:-0.6px;color:#ffffff">
                      Você está dentro, ${firstName}.
                    </h1>

                    <!-- Intro -->
                    <p style="margin:0 0 26px;color:rgba(255,255,255,0.8);font-size:15.5px;line-height:1.65">
                      Sua inscrição foi aprovada. Agora você faz parte de uma comunidade
                      que acredita que <strong style="color:#ffffff;font-weight:600">código, design e colaboração</strong> podem
                      transformar a realidade — e em três dias vamos provar isso juntos.
                    </p>

                    <!-- Event details card -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 32px">
                      <tr>
                        <td style="background-color:#1f0e3d;background:rgba(255,140,0,0.07);border-left:3px solid #ff8c00;border-radius:0 10px 10px 0;padding:20px 22px">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-bottom:14px">
                                <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:3px">Quando</div>
                                <div style="color:#ffffff;font-weight:600;font-size:15px">${CONFIG.EVENT_DATE}</div>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-bottom:14px">
                                <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:3px">Onde</div>
                                <div style="color:#ffffff;font-weight:600;font-size:15px">${CONFIG.EVENT_LOCATION}</div>
                              </td>
                            </tr>
                            <tr>
                              <td>
                                <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:3px">Prêmio</div>
                                <div style="color:#ffffff;font-weight:600;font-size:15px">${CONFIG.EVENT_PRIZE}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Next steps header -->
                    <div style="color:#ff8c00;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:18px">
                      — Próximos passos
                    </div>

                    <!-- Step 1 -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px">
                      <tr>
                        <td width="32" style="vertical-align:top;padding-top:1px">
                          <div style="width:26px;height:26px;border-radius:50%;background:#ff8c00;color:#0f0624;font-weight:800;font-size:12.5px;text-align:center;line-height:26px">1</div>
                        </td>
                        <td style="padding-left:12px;color:rgba(255,255,255,0.78);font-size:14.5px;line-height:1.6">
                          Em breve, um novo e-mail com o <strong style="color:#ffffff;font-weight:600">cronograma completo</strong>, instruções de check-in e a dinâmica de formação de equipes.
                        </td>
                      </tr>
                    </table>

                    <!-- Step 2 -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:14px">
                      <tr>
                        <td width="32" style="vertical-align:top;padding-top:1px">
                          <div style="width:26px;height:26px;border-radius:50%;background:#ff8c00;color:#0f0624;font-weight:800;font-size:12.5px;text-align:center;line-height:26px">2</div>
                        </td>
                        <td style="padding-left:12px;color:rgba(255,255,255,0.78);font-size:14.5px;line-height:1.6">
                          Comece a pensar nos <strong style="color:#ffffff;font-weight:600">desafios que te inspiram</strong> — e no tipo de gente com quem você gostaria de formar time. Vai rolar matching no primeiro dia.
                        </td>
                      </tr>
                    </table>

                    <!-- Step 3 -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="32" style="vertical-align:top;padding-top:1px">
                          <div style="width:26px;height:26px;border-radius:50%;background:#ff8c00;color:#0f0624;font-weight:800;font-size:12.5px;text-align:center;line-height:26px">3</div>
                        </td>
                        <td style="padding-left:12px;color:rgba(255,255,255,0.78);font-size:14.5px;line-height:1.6">
                          Prepare seu <strong style="color:#ffffff;font-weight:600">kit de sobrevivência</strong>: notebook, carregador, fones e uma boa dose de café. Três dias passam mais rápido do que parece.
                        </td>
                      </tr>
                    </table>

                    <!-- CTA -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:36px 0 0">
                      <tr>
                        <td align="center">
                          <a href="${CONFIG.SITE_URL}" style="display:inline-block;background:#ff8c00;color:#0f0624;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14.5px;letter-spacing:0.2px">
                            Acessar o site do evento &nbsp;→
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Support line -->
                    <p style="margin:32px 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.55);font-size:13px;line-height:1.65">
                      Dúvidas? <strong style="color:rgba(255,255,255,0.85);font-weight:600">Responda este e-mail</strong> —
                      a equipe da organização lê todas as mensagens.
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td align="center" style="padding:30px 24px 8px">
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.72);font-size:14px;line-height:1.5;font-style:italic">
                Até lá, ${firstName}. Que comece a contagem regressiva.
              </p>
              <p style="margin:0;color:rgba(255,255,255,0.55);font-size:13px;font-weight:600">
                — Equipe Hackathon do Sol
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 16px 8px;color:rgba(255,255,255,0.35);font-size:11px;line-height:1.75">
              ${CONFIG.EVENT_DATE}&nbsp; · &nbsp;${CONFIG.EVENT_LOCATION}<br>
              <a href="https://instagram.com/${instagramHandle}" style="color:rgba(255,165,48,0.75);text-decoration:none">${CONFIG.EVENT_INSTAGRAM}</a>
              &nbsp;·&nbsp;
              <span style="color:rgba(255,255,255,0.4)">hackathondosol@gmail.com</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRejectionHTML(name) {
  const rawFirstName = String(name || "").trim().split(/\s+/)[0] || "";
  const firstName = escapeHtml(rawFirstName);
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sobre sua inscrição no Hackathon do Sol</title>
</head>
<body style="margin:0;padding:0;background:#0f0624;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased">
  <!-- preview text (aparece no inbox antes de abrir o email) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">
    Obrigado pelo seu interesse no Hackathon do Sol 2026. Segue uma atualização sobre sua inscrição.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f0624">
    <tr>
      <td align="center" style="padding:32px 16px 48px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%">

          <!-- Brand: mini sun + wordmark -->
          <tr>
            <td align="center" style="padding:8px 0 28px">
              <div style="display:inline-block;width:38px;height:38px;border-radius:50%;background-color:#ff8c00;background:radial-gradient(circle,#fff7d4 0%,#ffd34f 28%,#ff8c00 68%,#ff6b00 100%);margin-bottom:14px"></div>
              <div style="font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:19px;letter-spacing:-0.4px;color:#ffffff">
                Hackathon
                <span style="color:#ffa530;background:linear-gradient(90deg,#ffc830,#ff8c00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">&nbsp;do Sol</span>
              </div>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#180a34;background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%),#180a34;border:1px solid rgba(255,255,255,0.08);border-radius:18px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <!-- accent line top: tom mais sóbrio que o approval -->
                <tr>
                  <td style="height:3px;line-height:3px;font-size:3px;background:#7c3aed;background:linear-gradient(90deg,#7c3aed,#e879f9,#7c3aed);border-top-left-radius:18px;border-top-right-radius:18px">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:40px 36px 36px">

                    <!-- Eyebrow -->
                    <div style="color:#ff8c00;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:18px">
                      ✦ &nbsp;Resultado da inscrição
                    </div>

                    <!-- Title -->
                    <h1 style="margin:0 0 18px;font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;font-weight:800;font-size:28px;line-height:1.2;letter-spacing:-0.5px;color:#ffffff">
                      Obrigado pelo interesse, ${firstName}.
                    </h1>

                    <!-- Para 1 — contextualiza com transparência -->
                    <p style="margin:0 0 18px;color:rgba(255,255,255,0.8);font-size:15.5px;line-height:1.65">
                      Recebemos um número de inscrições bem acima das
                      <strong style="color:#ffffff;font-weight:600">160 vagas</strong>
                      disponíveis nesta edição. Cada formulário foi lido com atenção,
                      e depois de analisar com cuidado, infelizmente não foi possível
                      confirmar sua vaga desta vez.
                    </p>

                    <!-- Para 2 — acolhe -->
                    <p style="margin:0 0 18px;color:rgba(255,255,255,0.8);font-size:15.5px;line-height:1.65">
                      Isso não reflete o valor do que você construiu até aqui —
                      é só uma questão de capacidade pra esta edição específica.
                      A gente valoriza demais o tempo que você tirou pra se inscrever.
                    </p>

                    <!-- Para 3 — convite pra comunidade -->
                    <p style="margin:0 0 26px;color:rgba(255,255,255,0.8);font-size:15.5px;line-height:1.65">
                      Se quiser continuar por perto, a comunidade tá sempre ativa.
                      Vem meetup, workshop e novas edições — e a gente adoraria ter
                      você junto.
                    </p>

                    <!-- Soft CTA: Instagram -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 4px">
                      <tr>
                        <td align="center">
                          <a href="https://instagram.com/${instagramHandle}" style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,140,0,0.4);color:#ff8c00;font-weight:600;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;letter-spacing:0.1px">
                            Seguir ${CONFIG.EVENT_INSTAGRAM} &nbsp;→
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Support line -->
                    <p style="margin:32px 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);font-size:13px;line-height:1.65">
                      Se tiver qualquer feedback ou quiser conversar, pode responder
                      este e-mail — a gente lê tudo.
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td align="center" style="padding:30px 24px 8px">
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.72);font-size:14px;line-height:1.5;font-style:italic">
                Um abraço solar, e até breve.
              </p>
              <p style="margin:0;color:rgba(255,255,255,0.55);font-size:13px;font-weight:600">
                — Equipe Hackathon do Sol
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 16px 8px;color:rgba(255,255,255,0.35);font-size:11px;line-height:1.75">
              <a href="https://instagram.com/${instagramHandle}" style="color:rgba(255,165,48,0.75);text-decoration:none">${CONFIG.EVENT_INSTAGRAM}</a>
              &nbsp;·&nbsp;
              <span style="color:rgba(255,255,255,0.4)">hackathondosol@gmail.com</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
