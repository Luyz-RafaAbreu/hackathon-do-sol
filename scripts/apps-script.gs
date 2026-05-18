/**
 * ============================================================================
 *  HACKATHON DO SOL 2026 — Sistema de Inscrições (V2 — por EQUIPE)
 *  Google Apps Script
 * ----------------------------------------------------------------------------
 *  O que este script faz:
 *    1. Recebe inscrições de EQUIPES (4 integrantes) via POST do site Next.
 *    2. Salva cada equipe como UMA linha na aba "Inscricoes" (143 colunas:
 *       4 meta + 8 equipe + 6 proposta + 1 aceites coletivos + 31 × 4 integrantes).
 *    3. Dedup por CPF (item 3.2 do Edital) e por e-mail (oficial + 4 pessoais).
 *    4. Envia e-mail de confirmação imediato aos 4 integrantes.
 *    5. Quando o admin muda o Status da equipe na planilha pra Aprovado ou
 *       Reprovado, envia e-mail correspondente aos 4 integrantes.
 *
 *  Importante: o site Next envia um envelope `{ v: 2, ts, payload, signature }`
 *  assinado por HMAC-SHA256(`${ts}.${payload}`, WEBHOOK_SECRET). Aqui
 *  recalculamos e comparamos em constant-time. Requests com timestamp fora de
 *  uma janela de 5 min são rejeitados (anti-replay).
 *
 *  SETUP (passo a passo):
 *    1. Abra a planilha do Google Sheets que vai armazenar as inscrições
 *    2. Menu: Extensões → Apps Script
 *    3. Apague o código padrão e cole TUDO deste arquivo
 *    4. Configure WEBHOOK_SECRET nas Script Properties (⚙ Project Settings)
 *    5. Salve (Ctrl+S) e dê um nome ao projeto
 *    6. Execute a função `setup` uma vez (autoriza Planilhas, Drive e Gmail)
 *    7. Menu: Implantar → Nova implantação → tipo "Aplicativo da Web"
 *         - Executar como: "Eu (seu-email@gmail.com)"
 *         - Quem tem acesso: "Qualquer pessoa"
 *    8. Copie a URL e coloque no `.env.local` do Next:
 *         APPS_SCRIPT_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
 *         APPS_SCRIPT_WEBHOOK_SECRET=mesmo-valor-definido-aqui
 *
 *  ATUALIZAÇÕES DESTE SCRIPT (pós-setup):
 *    Sempre que mudar o código aqui, cole de novo no editor do Apps Script e
 *    use Implantar → Gerenciar implantações → ✏️ Editar → Nova versão.
 *    NÃO crie uma "Nova implantação" — isso muda a URL e quebra o `.env.local`.
 * ============================================================================
 */

// ============================================================================
// CONFIG — edite aqui
// ----------------------------------------------------------------------------
// IMPORTANTE: o WEBHOOK_SECRET é lido das Script Properties do projeto,
// NÃO está no código. Configure uma vez via:
//   Apps Script editor → ⚙ Project Settings → Script Properties → + Add
//     Property: WEBHOOK_SECRET
//     Value:    (o mesmo valor de APPS_SCRIPT_WEBHOOK_SECRET do .env.local)
// Assim, push do clasp não afeta o secret e ele nunca vai pro git.
// ============================================================================
function getWebhookSecret_() {
  return PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
}

const CONFIG = {
  EVENT_NAME: "Hackathon do Sol",
  EVENT_DATE: "26 a 28 de junho de 2026",
  EVENT_LOCATION: "Praiamar Arena, Natal/RN",
  EVENT_PRIZE: "R$ 10 mil em premiação",
  EVENT_INSTAGRAM: "@hackathondosol",
  SITE_URL: "https://hackathondosol.com.br",
  EMAIL_FROM_NAME: "Hackathon do Sol",

  SHEET_NAME: "Inscricoes",
  CONFIG_SHEET_NAME: "Configurações",
  TIMEZONE: "America/Recife",
};

// ============================================================================
// LIMITES DE TAMANHO POR CAMPO
// ----------------------------------------------------------------------------
// Defesa em profundidade caso o WEBHOOK_SECRET vaze e alguém chame este
// endpoint direto sem passar pelo Next. Mantenha sincronizado com
// `lib/inscricao-schema.ts` no projeto Next.
// ============================================================================
const FIELD_MAX = {
  equipeNome: 60, equipeSlogan: 120, equipeCidade: 60, equipeEstado: 2,
  equipeEmail: 254, equipeTelefone: 20, equipeTrilha: 120,
  nomeCompleto: 120, nomeSocial: 120, cpf: 14, rg: 30, dataNascimento: 10,
  nacionalidade: 50, naturalidade: 100, cidade: 60, estado: 2,
  enderecoCompleto: 250, emailPessoal: 254, telefoneCelular: 20,
  contatoEmergenciaNome: 120,
  contatoEmergenciaTelefone: 20, contatoEmergenciaParentesco: 50,
  genero: 120, ocupacaoAtual: 150, tempoExperiencia: 50,
  nivelFormacao: 60, cursoFormacao: 80, anoFormacao: 4,
  instituicao: 200, instituicaoUF: 2, instituicaoMunicipio: 80,
  projetoAcademico: 1000,
  linkedin: 200, portfolio: 200, outrasRedes: 250,
  experienciaRelevante: 1500, restricoesAlimentares: 500,
  alergias: 500, medicamentos: 500, acessibilidade: 500,
  outrasObservacoes: 1000, comoSoube: 60,
  propostaIdeiaDiferencial: 2500, propostaProblemaPublico: 1500,
  propostaAderencia: 1000, propostaTecnologias: 1000,
};

// ============================================================================
// ESTRUTURA DA PLANILHA
// ----------------------------------------------------------------------------
// COLUNAS são definidas em blocos pra ficar legível. A ordem final é:
//   [Status, Data, Email enviado em, Observações]
//   + TEAM_COLUMNS (equipe)
//   + PROPOSTA_COLUMNS
//   + ACEITES_COLETIVOS_COLUMN
//   + INTEGRANTE_COLUMNS × 4 (Integrante 1..4 com prefixo no nome)
//
// STATUS_COL = 1 (coluna A) — usado pelo trigger `handleStatusChange`.
// EMAIL_SENT_COL = 3 (coluna C) — onde escrevemos "Aprovação · ..." ou
// "Reprovação · ..." depois de disparar o email.
// ============================================================================
const META_COLUMNS = [
  "Status",            // A — dropdown: Pendente / Aprovado / Reprovado
  "Data inscrição",    // B
  "Email enviado em",  // C — marcado automaticamente pelo trigger
  "Observações",       // D — campo livre pra anotações internas
];
const STATUS_COL = 1;
const EMAIL_SENT_COL = 3;

const TEAM_COLUMNS = [
  "Equipe — Nome",
  "Equipe — Slogan",
  "Equipe — Cidade",
  "Equipe — Estado",
  "Equipe — E-mail oficial",
  "Equipe — Telefone",
  "Trilha temática",
  "Líder (índice 1-4)",
];

const PROPOSTA_COLUMNS = [
  "Proposta — Ideia e diferencial",
  "Proposta — Problema e público",
  "Proposta — Aderência à trilha",
  "Proposta — Tecnologias",
];

const ACEITES_COLETIVOS_COLUMN = "Aceites coletivos (todos OK)";

const INTEGRANTE_FIELDS = [
  "Nome completo",
  "Nome social",
  "CPF",
  "RG",
  "Data de nascimento",
  "Nacionalidade",
  "Naturalidade",
  "Cidade",
  "Estado",
  "Endereço",
  "E-mail",
  "Telefone",
  "Contato emergência — Nome",
  "Contato emergência — Telefone",
  "Contato emergência — Parentesco",
  "Gênero",
  "Áreas de conhecimento",
  "Ocupação atual",
  "Tempo de experiência",
  "Nível de formação",
  "Curso / Área de formação",
  "Ano de ingresso/formatura",
  "Instituição de ensino",
  "Instituição — UF",
  "Instituição — Município",
  "Projeto acadêmico relevante",
  "LinkedIn",
  "Portfólio",
  "Outras redes sociais",
  "Experiência relevante",
  "Restrições alimentares",
  "Alergias",
  "Medicamentos contínuos",
  "Acessibilidade",
  "Outras observações",
  "Como soube",
  "Aceites individuais (todos OK)",
];

function integranteColumns(n) {
  const prefix = "Int " + n + " — ";
  return INTEGRANTE_FIELDS.map(function (f) { return prefix + f; });
}

const COLUMNS = (function () {
  let cols = META_COLUMNS.concat(TEAM_COLUMNS).concat(PROPOSTA_COLUMNS);
  cols.push(ACEITES_COLETIVOS_COLUMN);
  cols = cols
    .concat(integranteColumns(1))
    .concat(integranteColumns(2))
    .concat(integranteColumns(3))
    .concat(integranteColumns(4));
  return cols;
})();

// Aceites esperados (chaves) — sincronizado com inscricao-schema.ts.
const ACEITES_INDIVIDUAIS_KEYS = [
  "maioridade","edital","lgpd","imagem","acomodacao","presenca","hotel","bens","veracidade",
];
const ACEITES_COLETIVOS_KEYS = [
  "originalidade","maioridade_equipe","transporte","decisoes","solidaria","confirmacao","credenciamento",
];

// ============================================================================
// ABA TRIAGEM — view compacta pra aprovação
// ----------------------------------------------------------------------------
// Cada equipe vira um "card" de 8 linhas × 9 colunas, empilhados verticalmente.
// Admin trabalha aqui em vez de rolar 143 colunas da Inscricoes. Status é
// editável no card e sincroniza com a Inscricoes via trigger bidirecional.
//
// Estrutura do card (linhas relativas a um startRow):
//   +0 [Status] [Equipe nome]    [Trilha] [Data]    [Email ofic] [Tel ofic]  [    ]           [    ]    [↗ detalhes]
//   +1 [LÍDER]  [Nome (idade)]   [CPF]    [Cidade]  [Email pess] [Tel cel]   [Ocup. · tempo]  [Áreas]   [LinkedIn]
//   +2 [Int 2]  [Nome (idade)]   [CPF]    [Cidade]  [Email pess] [Tel cel]   [Ocup. · tempo]  [Áreas]   [LinkedIn]
//   +3 [Int 3]  ... idem
//   +4 [Int 4]  ... idem
//   +5 [PROPOSTA]   [resumo merged B:I, wrap, alt. 72px]
//   +6 [ADERÊNCIA]  [aderência merged B:I, wrap, alt. 72px]
//   +7 spacer (gray bg, 3px)
//
// Coluna J (oculta) guarda o número da linha equivalente na Inscricoes,
// pra mapeamento bidirecional no trigger.
// ============================================================================
const TRIAGEM_SHEET_NAME = "Triagem";
const TRIAGEM_CARD_ROWS = 8;
const TRIAGEM_HEADER_ROWS = 1;
const TRIAGEM_STATUS_COL = 1;  // coluna A do card
const TRIAGEM_CARD_COLS = 9;   // colunas visíveis (A..I)
const TRIAGEM_HIDDEN_COL = 10; // coluna J (oculta) — referência pra linha na Inscricoes
// Data do credenciamento (item 2.1 do Edital) usada como referência pra
// calcular idade — bate com o critério legal de "≥ 18 até 24/06/2026".
const CRED_DATE = new Date(2026, 5, 24); // mês 5 = junho (0-indexed)

// ============================================================================
// ABA DETALHES — view estruturada vertical, 1 equipe por bloco (~50 linhas)
// ----------------------------------------------------------------------------
// Substitui o uso humano da aba Inscricoes (143 colunas) — ela vira hidden,
// só backend. Cada equipe vira um relatório legível de cabo a rabo, com os
// 4 integrantes lado a lado (cols B-E) e proposta merged. O admin que abre o
// link "↗ ver detalhes" da Triagem cai aqui, no bloco da equipe específica.
// ============================================================================
const DETALHES_SHEET_NAME = "Detalhes";
const DETALHES_BLOCK_ROWS = 50; // total por bloco (header + integrantes + 4 proposta + spacer)
const DETALHES_HEADER_ROWS = 1; // linha topo do sheet

// ============================================================================
// SETUP — rode 1x para preparar a planilha
// ============================================================================
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (sheet && sheet.getLastRow() > 1) {
    // Tenta dialog UI; se não tem contexto (rodando do editor sem planilha
    // ativa), loga aviso e prossegue — admin clicou Executar deliberadamente.
    try {
      const ui = SpreadsheetApp.getUi();
      const resposta = ui.alert(
        "⚠ Atenção",
        "A aba \"" + CONFIG.SHEET_NAME + "\" tem " + (sheet.getLastRow() - 1) +
          " linhas. Rodar setup() vai APAGAR TUDO. Tem certeza?",
        ui.ButtonSet.YES_NO
      );
      if (resposta !== ui.Button.YES) return;
    } catch (uiErr) {
      console.warn(
        "setup() rodando sem UI — vai apagar " + (sheet.getLastRow() - 1) +
        " linhas existentes sem confirmação."
      );
    }
  }

  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
  sheet.getRange(1, 1, 1, COLUMNS.length)
    .setFontWeight("bold")
    .setBackground("#4c1d95")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2); // congela Status + Data pra não perder ao rolar
  sheet.setRowHeight(1, 36);

  // Dropdown de Status
  const statusRange = sheet.getRange(2, STATUS_COL, 1000, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pendente", "Aprovado", "Reprovado"], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(rule);

  // Formatação condicional por status
  const rules = sheet.getConditionalFormatRules();
  rules.length = 0;
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Aprovado").setBackground("#d1fae5").setFontColor("#064e3b")
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Reprovado").setBackground("#fee2e2").setFontColor("#7f1d1d")
      .setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Pendente").setBackground("#fef3c7").setFontColor("#78350f")
      .setRanges([statusRange]).build()
  );
  sheet.setConditionalFormatRules(rules);

  // Larguras razoáveis — celulas de texto longo recebem mais espaço
  for (let i = 0; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    let w = 140;
    if (col.indexOf("Resumo") >= 0 || col.indexOf("Experiência relevante") >= 0) w = 280;
    else if (col.indexOf("Endereço") >= 0) w = 240;
    else if (col === "Status") w = 110;
    else if (col === "Observações") w = 200;
    sheet.setColumnWidth(i + 1, w);
  }

  setupConfigSheet();
  regenerarTriagem();   // cria aba Triagem + cards
  regenerarDetalhes();  // cria aba Detalhes + blocos
  tidyUpSheets_();      // esconde Inscricoes + reordena
  installStatusTrigger_();

  const finalMsg =
    "✓ Setup completo!\n\n" +
    "Foram feitos:\n" +
    "• Planilha \"Inscricoes\" reconstruída com 143 colunas (banco bruto, hidden)\n" +
    "• Aba \"Triagem\" criada com cards visuais por equipe\n" +
    "• Aba \"Detalhes\" criada com bloco por equipe (review profundo)\n" +
    "• Aba \"Configurações\" criada (controle aberto/fechado)\n" +
    "• Trigger handleStatusChange instalado\n\n" +
    "Workflow: admin trabalha na aba Triagem.\n" +
    "Mudar Status no card dispara o e-mail e sincroniza com a Inscricoes.\n\n" +
    "Falta só:\n" +
    "1. Confirmar WEBHOOK_SECRET em ⚙ Project Settings → Script Properties\n" +
    "2. Confirmar que o web app está implantado e a URL bate com\n" +
    "   APPS_SCRIPT_WEBHOOK_URL no .env.local";
  try {
    SpreadsheetApp.getUi().alert(finalMsg);
  } catch (uiErr) {
    console.log(finalMsg);
  }
}

// ============================================================================
// installStatusTrigger_ — cria o installable trigger handleStatusChange se
// ainda não existir. Idempotente: não cria duplicatas.
// ----------------------------------------------------------------------------
// Substitui o passo manual "ícone de relógio → + Adicionar acionador" da UI.
// Roda dentro do setup() — só precisa do user clicar Run uma vez.
// ============================================================================
// ============================================================================
// tidyUpSheets_ — remove abas órfãs (Página1 default do Google) e reordena
// na ordem usável: Triagem → Inscricoes → Configurações.
// ============================================================================
function tidyUpSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Remove "Página1" / "Sheet1" / "Página 1" — default órfã que o Google
  //    cria automaticamente quando o usuário abre o Sheets. Não usamos.
  ["Página1", "Página 1", "Sheet1"].forEach(function (name) {
    const orphan = ss.getSheetByName(name);
    if (orphan && ss.getSheets().length > 1) {
      ss.deleteSheet(orphan);
    }
  });

  // 2. Reordena: Triagem (aprovação) → Detalhes (review) → Configurações
  //    → Inscricoes (hidden no fim). Antes de mover, "showSheet" se estiver
  //    hidden — moveActiveSheet falha em sheet escondida. Usa contador de
  //    posição efetiva (`pos`) pra não tentar posição > qtd de sheets.
  const order = [TRIAGEM_SHEET_NAME, DETALHES_SHEET_NAME, CONFIG.CONFIG_SHEET_NAME, CONFIG.SHEET_NAME];
  let pos = 1;
  const totalSheets = ss.getSheets().length;
  for (let i = 0; i < order.length; i++) {
    const sh = ss.getSheetByName(order[i]);
    if (!sh) continue;
    try {
      sh.showSheet(); // se estava hidden, mostra (precisa pra setActiveSheet)
      ss.setActiveSheet(sh);
      if (pos <= totalSheets) {
        ss.moveActiveSheet(pos);
      }
    } catch (errMove) {
      console.warn("Não consegui mover '" + order[i] + "':", errMove);
    }
    pos++;
  }

  // 3. Agora esconde a Inscricoes — admin não precisa ver 143 colunas.
  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (inscricoes) {
    try { inscricoes.hideSheet(); } catch (errHide) {
      console.warn("Não consegui esconder Inscricoes:", errHide);
    }
  }

  // Deixa a Triagem como aba ativa
  const triagem = ss.getSheetByName(TRIAGEM_SHEET_NAME);
  if (triagem) {
    try { ss.setActiveSheet(triagem); } catch (_) { /* ignore */ }
  }
}

// ============================================================================
// apagarTodasInscricoes — utility pra limpar inscrições de teste rapidamente
// ----------------------------------------------------------------------------
// Apaga TODAS as linhas de dados das abas Inscricoes, Triagem e Detalhes,
// mantendo só os headers e estrutura. NÃO mexe em Configurações nem em
// Script Properties. Mais leve que rodar setup() de novo.
// ============================================================================
function apagarTodasInscricoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let total = 0;

  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (inscricoes && inscricoes.getLastRow() > 1) {
    const n = inscricoes.getLastRow() - 1;
    inscricoes.deleteRows(2, n);
    total += n;
  }

  const triagem = ss.getSheetByName(TRIAGEM_SHEET_NAME);
  if (triagem && triagem.getLastRow() > 1) {
    triagem.deleteRows(2, triagem.getLastRow() - 1);
  }

  const detalhes = ss.getSheetByName(DETALHES_SHEET_NAME);
  if (detalhes && detalhes.getLastRow() > 1) {
    detalhes.deleteRows(2, detalhes.getLastRow() - 1);
  }

  console.log("Apagadas " + total + " inscrições. Abas mantidas com headers.");
}

function installStatusTrigger_() {
  const existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === "handleStatusChange";
  });
  if (existing.length > 0) return; // já existe — sem duplicar
  ScriptApp.newTrigger("handleStatusChange")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
}

// ============================================================================
// SETUP CONFIG — aba "Configurações" (controle de inscrições abertas/fechadas)
// ============================================================================
function setupConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
  if (sheet) return;

  sheet = ss.insertSheet(CONFIG.CONFIG_SHEET_NAME);
  sheet.getRange("A1").setValue("Inscrições abertas?");
  sheet.getRange("A2").setValue("Mensagem quando fechado");
  sheet.getRange("A1:A2")
    .setFontWeight("bold").setBackground("#4c1d95").setFontColor("#ffffff")
    .setVerticalAlignment("middle");

  sheet.getRange("B1").setValue(true);
  sheet.getRange("B1").setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox().build()
  );
  sheet.getRange("B2").setValue(
    "Inscrições encerradas. Siga @hackathondosol pra ficar por dentro da próxima edição."
  );
  sheet.getRange("B2").setWrap(true);

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 480);
  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 60);

  sheet.getRange("A4").setValue(
    "ℹ Pra fechar/abrir inscrições, basta marcar/desmarcar a checkbox em B1."
  ).setFontColor("#666666").setFontStyle("italic");
}

// ============================================================================
// SETUP TRIAGEM — cria/limpa a aba Triagem e configura cabeçalho
// ============================================================================
function setupTriagemSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TRIAGEM_SHEET_NAME);
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  } else {
    sheet = ss.insertSheet(TRIAGEM_SHEET_NAME);
  }

  // Linha 1 — instrução topo (não é "header de colunas", já que cada coluna tem
  // múltiplos significados dependendo da linha do card). Mais útil deixar uma
  // dica de uso aqui.
  sheet.getRange(1, 1, 1, TRIAGEM_CARD_COLS).merge();
  sheet.getRange("A1").setValue(
    "Triagem de inscrições  ·  Mude o Status (coluna A) para Aprovado ou Reprovado e o e-mail é enviado automaticamente aos 4 integrantes."
  );
  sheet.getRange(1, 1, 1, TRIAGEM_CARD_COLS)
    .setBackground("#fafaf9")
    .setFontColor("#52525b")
    .setFontWeight("normal")
    .setFontSize(10)
    .setFontStyle("italic")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);

  // Larguras pensadas pra o conteúdo de cada coluna (header / integrante):
  //   A  — Status            / Label (LÍDER / Int N)
  //   B  — Equipe nome       / Nome (idade)
  //   C  — Trilha            / CPF
  //   D  — Data inscrição    / Cidade/UF
  //   E  — Email oficial     / Email pessoal
  //   F  — Telefone oficial  / Telefone celular
  //   G  — (vazio)           / Ocupação · tempo de experiência
  //   H  — (vazio)           / Áreas de conhecimento
  //   I  — ↗ ver detalhes    / LinkedIn (clicável)
  sheet.setColumnWidth(1, 95);
  sheet.setColumnWidth(2, 210);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 200);
  sheet.setColumnWidth(8, 180);
  sheet.setColumnWidth(9, 200);

  // Esconde coluna J (referência interna pra inscricoesRow).
  // Antes, desconde TUDO — necessário pra defesa contra estado herdado
  // de versões anteriores onde TRIAGEM_HIDDEN_COL era outro valor (F=6 antes
  // de virar J=10). `sheet.clear()` não toca em colunas hidden.
  if (sheet.getMaxColumns() < TRIAGEM_HIDDEN_COL) {
    sheet.insertColumnAfter(sheet.getMaxColumns());
  }
  sheet.showColumns(1, sheet.getMaxColumns());
  sheet.hideColumns(TRIAGEM_HIDDEN_COL);

  // Conditional formatting do Status (em qualquer linha da coluna A)
  const colA = sheet.getRange(2, 1, 5000, 1);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Aprovado").setBackground("#d1fae5").setFontColor("#064e3b").setBold(true)
      .setRanges([colA]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Reprovado").setBackground("#fee2e2").setFontColor("#7f1d1d").setBold(true)
      .setRanges([colA]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Pendente").setBackground("#fef3c7").setFontColor("#78350f").setBold(true)
      .setRanges([colA]).build(),
  ];
  sheet.setConditionalFormatRules(rules);

  return sheet;
}

// ============================================================================
// appendCardToTriagem_ — adiciona um card no final da Triagem
// ----------------------------------------------------------------------------
// `data` é o payload de uma inscrição (mesma forma do doPost).
// `inscricoesRow` é o número da linha correspondente na Inscricoes (>=2).
// ============================================================================
function appendCardToTriagem_(data, inscricoesRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRIAGEM_SHEET_NAME);
  if (!sheet) return;
  // Não dá pra confiar em `sheet.getLastRow()` aqui — o spacer (linha 8 do card)
  // só tem formatação (background cinza), zero conteúdo. `getLastRow` ignora
  // formatação e retorna a linha do ADERÊNCIA (linha 7 do card), o que faria o
  // card seguinte sobrepor o spacer anterior. Conto os cards via coluna F oculta
  // (que SEMPRE tem o inscricoesRow gravado na primeira linha de cada card).
  const lastRow = sheet.getLastRow();
  let nextRow = 2; // 1º card começa na linha 2 (depois do header)
  if (lastRow >= 2) {
    const refs = sheet.getRange(2, TRIAGEM_HIDDEN_COL, lastRow - 1, 1).getValues();
    let cards = 0;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i][0]) cards++;
    }
    nextRow = 2 + cards * TRIAGEM_CARD_ROWS;
  }
  buildCardAt_(sheet, nextRow, data, inscricoesRow);
}

// Calcula idade na data do credenciamento (CRED_DATE). dataNascimento pode
// chegar em 3 formatos:
//   • Date object — quando `getValues()` lê da Inscricoes, o Sheets pode
//     auto-detectar "2000-01-15" e converter pra Date interno
//   • "YYYY-MM-DD" string — formato canônico do front (input type=date)
//   • "DD/MM/YYYY" string — se admin editar à mão
// Retorna "" se não conseguir parsear.
function computeAge_(dataNascimento) {
  if (!dataNascimento) return "";
  let birth = null;
  if (dataNascimento instanceof Date) {
    birth = dataNascimento;
  } else {
    const s = String(dataNascimento);
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      birth = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) birth = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
  }
  if (!birth || isNaN(birth.getTime())) return "";
  let age = CRED_DATE.getFullYear() - birth.getFullYear();
  const mDiff = CRED_DATE.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && CRED_DATE.getDate() < birth.getDate())) age--;
  return age;
}

function buildCardAt_(sheet, startRow, data, inscricoesRow) {
  const liderIdx = Number(data.equipe.liderIndex) || 0;
  const stamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");

  // Helper: monta a linha de cada integrante com info chave pra triagem
  // (Edital 3.3.1.a + perfil + contato). Campos completos ficam na Detalhes.
  const integranteRow = function (i) {
    const it = (data.integrantes && data.integrantes[i]) || {};
    const isLider = (i === liderIdx);
    const label = isLider ? "★  LÍDER" : "Int " + (i + 1);
    const age = computeAge_(it.dataNascimento);
    const nomeIdade = (it.nomeCompleto || "—") + (age !== "" ? "  (" + age + "a)" : "");
    const cidade = (it.cidade || "") + (it.estado ? "/" + it.estado : "");
    const ocupTempo = [it.ocupacaoAtual, it.tempoExperiencia]
      .filter(Boolean).join("  ·  ") || "—";
    const areas = Array.isArray(it.areasConhecimento)
      ? (it.areasConhecimento.length ? it.areasConhecimento.join(", ") : "—")
      : (it.areasConhecimento || "—");
    return [
      label,
      nomeIdade,
      it.cpf || "—",
      cidade || "—",
      it.emailPessoal || "—",
      it.telefoneCelular || "—",
      ocupTempo,
      areas,
      it.linkedin || "—",
    ];
  };

  const rows = [
    // Row 1: HEADER — equipe nome em destaque, trilha + data, contato oficial
    [
      "Pendente",
      data.equipe.nome || "(sem nome)",
      data.equipe.trilha || "",
      stamp,
      "✉  " + (data.equipe.emailOficial || ""),
      "☎  " + (data.equipe.telefone || ""),
      "",
      "",
      "",
    ],
    // Rows 2-5: 4 integrantes
    integranteRow(0),
    integranteRow(1),
    integranteRow(2),
    integranteRow(3),
    // Row 6: PROPOSTA — resumo
    ["PROPOSTA", (data.proposta && data.proposta.ideiaDiferencial) || "—",
      "", "", "", "", "", "", ""],
    // Row 7: ADERÊNCIA — à trilha escolhida
    ["ADERÊNCIA", (data.proposta && data.proposta.aderencia) || "—",
      "", "", "", "", "", "", ""],
    // Row 8: SPACER — visualmente delimita o card
    ["", "", "", "", "", "", "", "", ""],
  ];

  sheet.getRange(startRow, 1, TRIAGEM_CARD_ROWS, TRIAGEM_CARD_COLS)
    .setValues(rows.map(function (r) { return r.map(sanitizeCell_); }));

  // Coluna J oculta com referência da Inscricoes (na primeira linha do card)
  sheet.getRange(startRow, TRIAGEM_HIDDEN_COL).setValue(inscricoesRow);

  // Link "↗ ver detalhes" → aponta pra aba Detalhes (não pra Inscricoes,
  // que agora é hidden/backend only). Usa RichTextValue porque HYPERLINK
  // formula quebra com # na URL de ancoragem do Sheets (#ERROR!).
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const detalhes = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DETALHES_SHEET_NAME);
  const detalhesGid = detalhes ? detalhes.getSheetId() : 0;
  // Posição do bloco da equipe na Detalhes: depende da ordem em que ela foi
  // inserida. Como Triagem e Detalhes são paralelas (mesma ordem de inserção),
  // o bloco N na Detalhes corresponde ao card N na Triagem.
  // Linha = 2 + (inscricoesRow - 2) * DETALHES_BLOCK_ROWS
  const detalhesRow = 2 + (inscricoesRow - 2) * DETALHES_BLOCK_ROWS;
  const detailsUrl = 'https://docs.google.com/spreadsheets/d/' + ssId +
    '/edit?gid=' + detalhesGid + '#gid=' + detalhesGid + '&range=A' + detalhesRow;
  const detailsRich = SpreadsheetApp.newRichTextValue()
    .setText("↗ ver detalhes")
    .setLinkUrl(detailsUrl)
    .build();
  sheet.getRange(startRow, 9).setRichTextValue(detailsRich);

  // LinkedIn de cada integrante (coluna I) — display compacto, clicável.
  for (let i = 0; i < 4; i++) {
    const it = (data.integrantes && data.integrantes[i]) || {};
    const r = startRow + 1 + i;
    if (it.linkedin) {
      const liUrl = String(it.linkedin).trim().match(/^https?:\/\//)
        ? it.linkedin
        : "https://" + it.linkedin;
      const display = it.linkedin.replace(/^https?:\/\/(www\.)?/, "");
      sheet.getRange(r, 9).setRichTextValue(
        SpreadsheetApp.newRichTextValue()
          .setText(display)
          .setLinkUrl(liUrl)
          .build()
      );
    }
  }

  applyCardFormatting_(sheet, startRow, liderIdx);
}

// ============================================================================
// applyCardFormatting_ — estilo limpo/leve, inspirado em apps tipo Notion/Linear.
// ----------------------------------------------------------------------------
// Princípios:
//   • Fundo branco (sem cores escuras opressivas)
//   • Hierarquia por TAMANHO de fonte, não saturação de cor
//   • Acentos discretos (laranja sol-orange só em pontos focais)
//   • Líder destacado com bg amarelo bem suave (#fef9c3)
//   • Separador entre cards é UMA linha fina, não barra grossa
//   • Bordas externas quase imperceptíveis
//
// Paleta:
//   bg card:           #ffffff
//   bg líder:          #fef9c3 (amber-100)
//   bg proposta:       #fafaf9 (stone-50)
//   txt principal:     #18181b (zinc-900)
//   txt secundário:    #71717a (zinc-500)
//   txt terciário:     #a1a1aa (zinc-400)
//   accent sol-orange: #f97316
//   border subtle:     #e4e4e7 (zinc-200)
//   border emph:       #d4d4d8 (zinc-300)
// ============================================================================
function applyCardFormatting_(sheet, startRow, liderIdx) {
  // ── Row 1: HEADER do card (branco, limpo) ──
  const headerRange = sheet.getRange(startRow, 1, 1, TRIAGEM_CARD_COLS);
  headerRange.setBackground("#ffffff").setVerticalAlignment("middle");
  sheet.setRowHeight(startRow, 54);

  // A: Status dropdown (cor vem do conditional formatting global)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pendente", "Aprovado", "Reprovado"], true)
    .setAllowInvalid(false).build();
  sheet.getRange(startRow, 1)
    .setDataValidation(statusRule)
    .setFontWeight("bold").setFontSize(10).setFontColor("#18181b")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  // B: Equipe nome — TÍTULO bem destacado
  sheet.getRange(startRow, 2)
    .setFontWeight("bold").setFontSize(16).setFontColor("#18181b")
    .setHorizontalAlignment("left").setVerticalAlignment("middle");

  // C: Trilha — italic, secundário
  sheet.getRange(startRow, 3)
    .setFontStyle("italic").setFontSize(10).setFontColor("#71717a")
    .setVerticalAlignment("middle");

  // D: Data inscrição — pequeno, terciário
  sheet.getRange(startRow, 4)
    .setFontSize(9).setFontColor("#a1a1aa").setVerticalAlignment("middle");

  // E: Email oficial — pequeno, terciário
  sheet.getRange(startRow, 5)
    .setFontSize(9).setFontColor("#a1a1aa").setVerticalAlignment("middle");

  // F: Tel oficial — pequeno, terciário, mono pra alinhar dígitos
  sheet.getRange(startRow, 6)
    .setFontFamily("Roboto Mono").setFontSize(9).setFontColor("#a1a1aa")
    .setVerticalAlignment("middle");

  // I: link ↗ ver detalhes — accent laranja
  sheet.getRange(startRow, 9)
    .setFontSize(10).setFontWeight("normal").setFontColor("#f97316")
    .setHorizontalAlignment("right").setVerticalAlignment("middle");

  // ── Rows 2-5: INTEGRANTES ──
  for (let i = 0; i < 4; i++) {
    const r = startRow + 1 + i;
    // 44px acomoda 2 linhas de wrap em Ocupação·tempo e Áreas.
    sheet.setRowHeight(r, 44);
    const isLider = (i === liderIdx);
    const rowRange = sheet.getRange(r, 1, 1, TRIAGEM_CARD_COLS);
    rowRange.setVerticalAlignment("middle");
    rowRange.setBackground(isLider ? "#fef9c3" : "#ffffff");

    // A: label "Int N" ou "★ LÍDER"
    sheet.getRange(r, 1)
      .setFontFamily("Roboto Mono").setFontSize(9)
      .setFontColor(isLider ? "#854d0e" : "#a1a1aa")
      .setFontWeight(isLider ? "bold" : "normal")
      .setHorizontalAlignment("center");

    // B: Nome (idade) — destaque
    sheet.getRange(r, 2)
      .setFontSize(11).setFontColor("#18181b")
      .setFontWeight(isLider ? "bold" : "normal");

    // C: CPF — mono, leitura rápida
    sheet.getRange(r, 3)
      .setFontFamily("Roboto Mono").setFontSize(10).setFontColor("#52525b");

    // D: Cidade/UF
    sheet.getRange(r, 4)
      .setFontSize(10).setFontColor("#27272a");

    // E: Email pessoal
    sheet.getRange(r, 5)
      .setFontSize(10).setFontColor("#52525b").setWrap(true);

    // F: Telefone celular — mono
    sheet.getRange(r, 6)
      .setFontFamily("Roboto Mono").setFontSize(10).setFontColor("#52525b");

    // G: Ocupação · tempo de experiência (wrap em 2 linhas)
    sheet.getRange(r, 7)
      .setFontSize(10).setFontColor("#27272a").setWrap(true);

    // H: Áreas de conhecimento (wrap)
    sheet.getRange(r, 8)
      .setFontSize(10).setFontColor("#52525b").setWrap(true);

    // I: LinkedIn (richTextValue já aplicado se URL existir)
    sheet.getRange(r, 9).setFontSize(10).setFontColor("#2563eb").setWrap(true);
  }

  // Linha divisória entre integrantes e proposta
  sheet.getRange(startRow + 5, 1, 1, TRIAGEM_CARD_COLS)
    .setBorder(true, null, null, null, null, null, "#e4e4e7", SpreadsheetApp.BorderStyle.SOLID);

  // ── Rows 6-7: PROPOSTA & ADERÊNCIA ──
  for (let r = startRow + 5; r <= startRow + 6; r++) {
    sheet.getRange(r, 2, 1, TRIAGEM_CARD_COLS - 1).merge(); // B..I
    sheet.getRange(r, 2)
      .setWrap(true).setFontSize(10).setFontColor("#27272a")
      .setVerticalAlignment("top").setBackground("#fafaf9");
    sheet.setRowHeight(r, 72);
  }
  // Label column A — chip pequeno, mono, sol-orange
  sheet.getRange(startRow + 5, 1, 2, 1)
    .setFontFamily("Roboto Mono").setFontWeight("bold").setFontSize(8)
    .setBackground("#fafaf9").setFontColor("#f97316")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  // ── Row 8: SPACER (linha sutil, não barra grossa) ──
  sheet.getRange(startRow + 7, 1, 1, TRIAGEM_CARD_COLS).setBackground("#e4e4e7");
  sheet.setRowHeight(startRow + 7, 3);

  // ── Borders do card inteiro ──
  // Borda externa quase imperceptível
  sheet.getRange(startRow, 1, TRIAGEM_CARD_ROWS - 1, TRIAGEM_CARD_COLS)
    .setBorder(true, true, true, true, false, false, "#e4e4e7", SpreadsheetApp.BorderStyle.SOLID);
  // Linha mais marcada SOB o header (separa título do conteúdo)
  sheet.getRange(startRow, 1, 1, TRIAGEM_CARD_COLS)
    .setBorder(null, null, true, null, null, null, "#d4d4d8", SpreadsheetApp.BorderStyle.SOLID);
}

// ============================================================================
// regenerarTriagem — reconstrói toda a aba Triagem a partir da Inscricoes
// ----------------------------------------------------------------------------
// Função utilitária — se algo desalinhar (admin deletou linhas, etc), basta
// rodar setup() ou esta função para refazer tudo a partir do banco bruto.
// ============================================================================
function regenerarTriagem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!inscricoes) return;

  setupTriagemSheet_(); // recreate header
  tidyUpSheets_();      // remove órfãs + reordena

  const lastRow = inscricoes.getLastRow();
  if (lastRow < 2) return;

  const allData = inscricoes.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  const triagem = ss.getSheetByName(TRIAGEM_SHEET_NAME);

  for (let r = 0; r < allData.length; r++) {
    const inscricoesRow = r + 2;
    const card = parseRowToCardData_(allData[r]);
    const cardStartRow = 2 + r * TRIAGEM_CARD_ROWS;
    buildCardAt_(triagem, cardStartRow, card, inscricoesRow);

    // Replica o Status atual da Inscricoes pro card (se for Aprovado/Reprovado)
    const status = String(allData[r][STATUS_COL - 1] || "Pendente").trim();
    if (status && status !== "Pendente") {
      triagem.getRange(cardStartRow, 1).setValue(status);
    }
  }
}

// Reconstrói o objeto `data` completo (mesma forma do payload do doPost) a
// partir de uma linha da aba Inscricoes. Usado por regenerarTriagem e por
// regenerarDetalhes pra reidratar todas as informações.
function parseRowToCardData_(row) {
  function idx(name) { return COLUMNS.indexOf(name); }
  function val(name) { return row[idx(name)] || ""; }

  const integrantes = [];
  for (let i = 1; i <= 4; i++) {
    integrantes.push({
      nomeCompleto: val("Int " + i + " — Nome completo"),
      nomeSocial: val("Int " + i + " — Nome social"),
      cpf: val("Int " + i + " — CPF"),
      rg: val("Int " + i + " — RG"),
      dataNascimento: val("Int " + i + " — Data de nascimento"),
      nacionalidade: val("Int " + i + " — Nacionalidade"),
      naturalidade: val("Int " + i + " — Naturalidade"),
      cidade: val("Int " + i + " — Cidade"),
      estado: val("Int " + i + " — Estado"),
      enderecoCompleto: val("Int " + i + " — Endereço"),
      emailPessoal: val("Int " + i + " — E-mail"),
      telefoneCelular: val("Int " + i + " — Telefone"),
      contatoEmergenciaNome: val("Int " + i + " — Contato emergência — Nome"),
      contatoEmergenciaTelefone: val("Int " + i + " — Contato emergência — Telefone"),
      contatoEmergenciaParentesco: val("Int " + i + " — Contato emergência — Parentesco"),
      genero: val("Int " + i + " — Gênero"),
      ocupacaoAtual: val("Int " + i + " — Ocupação atual"),
      tempoExperiencia: val("Int " + i + " — Tempo de experiência"),
      nivelFormacao: val("Int " + i + " — Nível de formação"),
      cursoFormacao: val("Int " + i + " — Curso / Área de formação"),
      anoFormacao: val("Int " + i + " — Ano de ingresso/formatura"),
      instituicao: val("Int " + i + " — Instituição de ensino"),
      instituicaoUF: val("Int " + i + " — Instituição — UF"),
      instituicaoMunicipio: val("Int " + i + " — Instituição — Município"),
      projetoAcademico: val("Int " + i + " — Projeto acadêmico relevante"),
      linkedin: val("Int " + i + " — LinkedIn"),
      portfolio: val("Int " + i + " — Portfólio"),
      outrasRedes: val("Int " + i + " — Outras redes sociais"),
      experienciaRelevante: val("Int " + i + " — Experiência relevante"),
      restricoesAlimentares: val("Int " + i + " — Restrições alimentares"),
      alergias: val("Int " + i + " — Alergias"),
      medicamentos: val("Int " + i + " — Medicamentos contínuos"),
      acessibilidade: val("Int " + i + " — Acessibilidade"),
      outrasObservacoes: val("Int " + i + " — Outras observações"),
      comoSoube: val("Int " + i + " — Como soube"),
      areasConhecimento: String(val("Int " + i + " — Áreas de conhecimento"))
        .split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      aceitesIndividuaisOk: String(val("Int " + i + " — Aceites individuais (todos OK)") || ""),
    });
  }

  return {
    equipe: {
      nome: val("Equipe — Nome"),
      slogan: val("Equipe — Slogan"),
      cidade: val("Equipe — Cidade"),
      estado: val("Equipe — Estado"),
      emailOficial: val("Equipe — E-mail oficial"),
      telefone: val("Equipe — Telefone"),
      trilha: val("Trilha temática"),
      liderIndex: Math.max(0, (Number(val("Líder (índice 1-4)")) || 1) - 1),
    },
    integrantes: integrantes,
    proposta: {
      ideiaDiferencial: val("Proposta — Ideia e diferencial"),
      problemaPublico: val("Proposta — Problema e público"),
      aderencia: val("Proposta — Aderência à trilha"),
      tecnologias: val("Proposta — Tecnologias"),
    },
    aceitesColetivosOk: String(val("Aceites coletivos (todos OK)") || ""),
    dataInscricao: val("Data inscrição"),
    status: val("Status") || "Pendente",
  };
}

// ============================================================================
// SETUP DETALHES — aba estruturada com 1 bloco vertical por equipe
// ============================================================================
function setupDetalhesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DETALHES_SHEET_NAME);
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  } else {
    sheet = ss.insertSheet(DETALHES_SHEET_NAME);
  }

  // Topo (linha 1) — instrução simples
  sheet.getRange("A1:E1").merge();
  sheet.getRange("A1").setValue(
    "Detalhes das inscrições  ·  1 bloco por equipe  ·  Use a aba Triagem para aprovar/reprovar."
  );
  sheet.getRange("A1:E1")
    .setBackground("#fafaf9").setFontColor("#52525b")
    .setFontSize(10).setFontStyle("italic")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);

  // Larguras: A=label estreito, B-E = 1 coluna por integrante
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 220);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 220);

  // Esconde coluna F (referência interna pra inscricoesRow no header de cada bloco)
  if (sheet.getMaxColumns() < 6) sheet.insertColumnAfter(sheet.getMaxColumns());
  sheet.hideColumns(6);

  return sheet;
}

// ============================================================================
// buildDetalhesBlockAt_ — escreve um bloco de equipe na aba Detalhes
// ============================================================================
function buildDetalhesBlockAt_(sheet, startRow, data, inscricoesRow) {
  const liderIdx = Number(data.equipe.liderIndex) || 0;

  // Conta as áreas marcadas vs total (9 ind + 7 col por equipe)
  function aceitesSummary(s) {
    const ok = String(s || "").split(",").filter(Boolean).length;
    return ok ? ok + " marcados" : "—";
  }

  // Helper: pega o valor de um campo do integrante (string ou "—")
  function f(it, key) {
    const v = it && it[key];
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    return v ? String(v) : "—";
  }

  const integrantes = data.integrantes || [{}, {}, {}, {}];
  const rows = [];

  // ── Header do bloco (linha 0) ──
  // Col E é um link "↩ voltar pra Triagem" — Status real fica visível na
  // Triagem; ter aqui era snapshot estático que ficava stale após aprovação.
  rows.push([
    "EQUIPE",
    data.equipe.nome || "(sem nome)",
    data.equipe.trilha || "",
    data.dataInscricao || "",
    "↩  voltar pra Triagem",
  ]);

  // ── Equipe info (linhas 1-6) ──
  rows.push(["Slogan", data.equipe.slogan || "—", "", "", ""]);
  rows.push(["Cidade base", (data.equipe.cidade || "") + (data.equipe.estado ? "/" + data.equipe.estado : ""), "", "", ""]);
  rows.push(["E-mail oficial", data.equipe.emailOficial || "—", "", "", ""]);
  rows.push(["Telefone equipe", data.equipe.telefone || "—", "", "", ""]);
  rows.push(["Líder", "Integrante " + (liderIdx + 1), "", "", ""]);
  rows.push(["Aceites coletivos", aceitesSummary(data.aceitesColetivosOk), "", "", ""]);

  // ── Separador (linha 7) ──
  rows.push(["", "", "", "", ""]);

  // ── Header dos integrantes (linha 8) ──
  rows.push([
    "INTEGRANTES",
    (0 === liderIdx ? "★ Int 1 (LÍDER)" : "Int 1"),
    (1 === liderIdx ? "★ Int 2 (LÍDER)" : "Int 2"),
    (2 === liderIdx ? "★ Int 3 (LÍDER)" : "Int 3"),
    (3 === liderIdx ? "★ Int 4 (LÍDER)" : "Int 4"),
  ]);

  // ── Linhas de dados dos integrantes (linhas 9-39, 31 linhas) ──
  // Cada linha: [label, valor int 1, valor int 2, valor int 3, valor int 4]
  const fields = [
    ["Nome completo", "nomeCompleto"],
    ["Nome social", "nomeSocial"],
    ["CPF", "cpf"],
    ["RG", "rg"],
    ["Data de nascimento", "dataNascimento"],
    ["Nacionalidade", "nacionalidade"],
    ["Naturalidade", "naturalidade"],
    ["Cidade de residência", "cidade"],
    ["Estado de residência", "estado"],
    ["Endereço completo", "enderecoCompleto"],
    ["E-mail pessoal", "emailPessoal"],
    ["Telefone celular", "telefoneCelular"],
    ["Contato emerg. — Nome", "contatoEmergenciaNome"],
    ["Contato emerg. — Tel", "contatoEmergenciaTelefone"],
    ["Contato emerg. — Parentesco", "contatoEmergenciaParentesco"],
    ["Gênero", "genero"],
    ["Áreas de conhecimento", "areasConhecimento"],
    ["Ocupação atual", "ocupacaoAtual"],
    ["Tempo de experiência", "tempoExperiencia"],
    ["Nível de formação", "nivelFormacao"],
    ["Curso / Área de formação", "cursoFormacao"],
    ["Ano de ingresso/formatura", "anoFormacao"],
    ["Instituição de ensino", "instituicao"],
    ["Instituição — UF", "instituicaoUF"],
    ["Instituição — Município", "instituicaoMunicipio"],
    ["Projeto acadêmico relevante", "projetoAcademico"],
    ["LinkedIn", "linkedin"],
    ["Portfólio", "portfolio"],
    ["Outras redes sociais", "outrasRedes"],
    ["Experiência relevante", "experienciaRelevante"],
    ["Restrições alimentares", "restricoesAlimentares"],
    ["Alergias", "alergias"],
    ["Medicamentos contínuos", "medicamentos"],
    ["Acessibilidade", "acessibilidade"],
    ["Outras observações", "outrasObservacoes"],
    ["Como soube", "comoSoube"],
    ["Aceites individuais", "aceitesIndividuaisOk"],
  ];

  fields.forEach(function (pair) {
    const label = pair[0];
    const key = pair[1];
    if (key === "aceitesIndividuaisOk") {
      rows.push([label].concat(integrantes.map(function (it) { return aceitesSummary(it[key]); })));
    } else {
      rows.push([label].concat(integrantes.map(function (it) { return f(it, key); })));
    }
  });

  // ── Separador (linha 40) ──
  rows.push(["", "", "", "", ""]);

  // ── Header da proposta (linha 41) ──
  rows.push(["PROPOSTA", "", "", "", ""]);

  // ── 4 campos da proposta (linhas 42-45) ──
  const propostaFields = [
    ["Ideia e diferencial", "ideiaDiferencial"],
    ["Problema e público", "problemaPublico"],
    ["Aderência à trilha", "aderencia"],
    ["Tecnologias", "tecnologias"],
  ];
  propostaFields.forEach(function (pair) {
    const v = (data.proposta && data.proposta[pair[1]]) || "—";
    rows.push([pair[0], v, "", "", ""]);
  });

  // ── Spacer (linhas 48-51, 4 linhas — separa bem do próximo bloco) ──
  rows.push(["", "", "", "", ""]);
  rows.push(["", "", "", "", ""]);
  rows.push(["", "", "", "", ""]);
  rows.push(["", "", "", "", ""]);

  // Escreve
  sheet.getRange(startRow, 1, rows.length, 5)
    .setValues(rows.map(function (r) { return r.map(sanitizeCell_); }));

  // Coluna F (oculta): referência inscricoesRow no header do bloco
  sheet.getRange(startRow, 6).setValue(inscricoesRow);

  // Link "↩ voltar pra Triagem" no header (col E) — aponta pra LINHA EXATA
  // do card daquela equipe na Triagem (não pra topo). Card N começa em
  // 2 + (N-1)*TRIAGEM_CARD_ROWS, onde N é a ordem de inserção.
  const ssId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const triagem = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRIAGEM_SHEET_NAME);
  const triagemGid = triagem ? triagem.getSheetId() : 0;
  const triagemRow = 2 + (inscricoesRow - 2) * TRIAGEM_CARD_ROWS;
  const backUrl = 'https://docs.google.com/spreadsheets/d/' + ssId +
    '/edit?gid=' + triagemGid + '#gid=' + triagemGid + '&range=A' + triagemRow;
  sheet.getRange(startRow, 5).setRichTextValue(
    SpreadsheetApp.newRichTextValue()
      .setText("↩  voltar pra Triagem")
      .setLinkUrl(backUrl)
      .build()
  );

  // LinkedIn e Portfólio como links clicáveis
  const liRow = startRow + 8 + 20; // row de "LinkedIn"
  const portRow = startRow + 8 + 21; // row de "Portfólio"
  for (let i = 0; i < 4; i++) {
    const it = integrantes[i] || {};
    if (it.linkedin && String(it.linkedin).trim() !== "—") {
      const url = String(it.linkedin).trim().match(/^https?:\/\//)
        ? it.linkedin : "https://" + it.linkedin;
      sheet.getRange(liRow, 2 + i).setRichTextValue(
        SpreadsheetApp.newRichTextValue()
          .setText(String(it.linkedin).replace(/^https?:\/\/(www\.)?/, ""))
          .setLinkUrl(url).build()
      );
    }
    if (it.portfolio && String(it.portfolio).trim() !== "—") {
      const url = String(it.portfolio).trim().match(/^https?:\/\//)
        ? it.portfolio : "https://" + it.portfolio;
      sheet.getRange(portRow, 2 + i).setRichTextValue(
        SpreadsheetApp.newRichTextValue()
          .setText(String(it.portfolio).replace(/^https?:\/\/(www\.)?/, ""))
          .setLinkUrl(url).build()
      );
    }
  }

  applyDetalhesBlockFormatting_(sheet, startRow, liderIdx);
}

// ============================================================================
// applyDetalhesBlockFormatting_ — estilo do bloco
// ============================================================================
function applyDetalhesBlockFormatting_(sheet, startRow, liderIdx) {
  // Row 0 — header EQUIPE
  const eqHeader = sheet.getRange(startRow, 1, 1, 5);
  eqHeader.setBackground("#18181b").setFontColor("#ffffff")
    .setFontWeight("bold").setVerticalAlignment("middle");
  sheet.setRowHeight(startRow, 38);
  sheet.getRange(startRow, 1).setFontSize(9).setHorizontalAlignment("center");
  sheet.getRange(startRow, 2).setFontSize(14);
  sheet.getRange(startRow, 3).setFontSize(10).setFontStyle("italic").setFontColor("#a1a1aa");
  sheet.getRange(startRow, 4).setFontSize(9).setFontColor("#a1a1aa");
  // col E — link "↩ voltar pra Triagem" (accent laranja, à direita)
  sheet.getRange(startRow, 5)
    .setFontSize(10).setFontWeight("normal").setFontColor("#f97316")
    .setHorizontalAlignment("right");

  // Rows 1-6 — Equipe info (label A bold pequeno, valor B merged B:E)
  for (let r = startRow + 1; r <= startRow + 6; r++) {
    sheet.getRange(r, 2, 1, 4).merge();
    sheet.setRowHeight(r, 24);
    sheet.getRange(r, 1)
      .setFontWeight("bold").setFontSize(9).setFontColor("#71717a")
      .setHorizontalAlignment("right").setVerticalAlignment("middle")
      .setBackground("#fafaf9");
    sheet.getRange(r, 2)
      .setFontSize(11).setFontColor("#18181b").setVerticalAlignment("middle");
  }

  // Row 7 — Separator
  sheet.getRange(startRow + 7, 1, 1, 5).setBackground("#f4f4f5");
  sheet.setRowHeight(startRow + 7, 6);

  // Row 8 — Header dos integrantes (col labels)
  const intHeader = sheet.getRange(startRow + 8, 1, 1, 5);
  intHeader.setBackground("#fafaf9").setFontWeight("bold")
    .setFontSize(10).setFontColor("#52525b").setVerticalAlignment("middle");
  sheet.setRowHeight(startRow + 8, 32);
  sheet.getRange(startRow + 8, 1).setHorizontalAlignment("right");
  for (let c = 2; c <= 5; c++) {
    const isLider = ((c - 2) === liderIdx);
    sheet.getRange(startRow + 8, c)
      .setHorizontalAlignment("center")
      .setFontColor(isLider ? "#a16207" : "#52525b")
      .setBackground(isLider ? "#fef9c3" : "#fafaf9");
  }

  // Rows 9-39 — Linhas de dados (31 linhas)
  for (let i = 0; i < 31; i++) {
    const r = startRow + 9 + i;
    sheet.setRowHeight(r, 26);
    sheet.getRange(r, 1)
      .setFontWeight("normal").setFontSize(9).setFontColor("#71717a")
      .setHorizontalAlignment("right").setVerticalAlignment("middle")
      .setBackground("#fafaf9");
    for (let c = 2; c <= 5; c++) {
      const isLider = ((c - 2) === liderIdx);
      sheet.getRange(r, c)
        .setFontSize(10).setFontColor("#18181b")
        .setVerticalAlignment("middle")
        .setBackground(isLider ? "#fefce8" : "#ffffff")
        .setWrap(true);
    }
  }

  // Row 40 — Separator
  sheet.getRange(startRow + 40, 1, 1, 5).setBackground("#f4f4f5");
  sheet.setRowHeight(startRow + 40, 6);

  // Row 41 — Header da proposta
  sheet.getRange(startRow + 41, 1, 1, 5)
    .setBackground("#18181b").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(startRow + 41, 32);
  sheet.getRange(startRow + 41, 2, 1, 4).merge();

  // Rows 42-45 — 4 campos da proposta (label A, valor B:E merged, wrap)
  // Wrap explícito via WrapStrategy.WRAP — setWrap(true) é ambíguo em alguns
  // contextos de merged cells. Aplicado na range merged INTEIRA pra garantir
  // que o estado wrap se propague na cell consolidada.
  for (let i = 0; i < 4; i++) {
    const r = startRow + 42 + i;
    sheet.getRange(r, 2, 1, 4)
      .merge()
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    sheet.getRange(r, 1)
      .setFontWeight("bold").setFontSize(9).setFontColor("#a16207")
      .setHorizontalAlignment("right").setVerticalAlignment("top")
      .setBackground("#fefce8");
    sheet.getRange(r, 2)
      .setFontSize(10).setFontColor("#18181b").setVerticalAlignment("top")
      .setBackground("#fffbeb");
  }
  // Auto-resize das 4 linhas pra altura crescer com o conteúdo.
  // autoResizeRows precisa que o wrap já tenha sido aplicado (acima).
  sheet.autoResizeRows(startRow + 42, 4);

  // Rows 46-49 — Spacer 4-linha (delimitação forte entre blocos)
  sheet.getRange(startRow + 46, 1, 4, 5).setBackground("#e4e4e7");
  for (let i = 0; i < 4; i++) sheet.setRowHeight(startRow + 46 + i, 4);

  // Borders externos do bloco inteiro
  sheet.getRange(startRow, 1, DETALHES_BLOCK_ROWS - 4, 5)
    .setBorder(true, true, true, true, false, false, "#d4d4d8", SpreadsheetApp.BorderStyle.SOLID);
}

// ============================================================================
// appendDetalhesBlock_ — adiciona um bloco no final da Detalhes
// ============================================================================
function appendDetalhesBlock_(data, inscricoesRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DETALHES_SHEET_NAME);
  if (!sheet) return;
  // Próximo bloco — calcula via coluna F oculta (que tem inscricoesRow no header
  // de cada bloco existente). Não usa getLastRow pq spacers vazios bagunçam.
  const lastRow = sheet.getLastRow();
  let nextRow = 2;
  if (lastRow >= 2) {
    const refs = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
    let blocks = 0;
    for (let i = 0; i < refs.length; i++) if (refs[i][0]) blocks++;
    nextRow = 2 + blocks * DETALHES_BLOCK_ROWS;
  }
  buildDetalhesBlockAt_(sheet, nextRow, data, inscricoesRow);
}

// ============================================================================
// regenerarDetalhes — wipe & rebuild da Detalhes a partir da Inscricoes
// ============================================================================
function regenerarDetalhes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!inscricoes) return;

  setupDetalhesSheet_();

  const lastRow = inscricoes.getLastRow();
  if (lastRow < 2) return;

  const allData = inscricoes.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  const detalhes = ss.getSheetByName(DETALHES_SHEET_NAME);

  for (let r = 0; r < allData.length; r++) {
    const inscricoesRow = r + 2;
    const data = parseRowToCardData_(allData[r]);
    const startRow = 2 + r * DETALHES_BLOCK_ROWS;
    buildDetalhesBlockAt_(detalhes, startRow, data, inscricoesRow);
  }
}

// ============================================================================
// doGet — status público (aberto/fechado) consultado pelo site
// ============================================================================
function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
    if (!sheet) return jsonResponse({ open: true, message: "" });
    const open = sheet.getRange("B1").getValue() === true;
    const message = String(sheet.getRange("B2").getValue() || "");
    return jsonResponse({ open: open, message: message });
  } catch (err) {
    console.error("doGet falhou:", err);
    return jsonResponse({ open: true, message: "" });
  }
}

// ============================================================================
// doPost — recebe inscrições do Next.js
// ============================================================================
function doPost(e) {
  try {
    const secret = getWebhookSecret_();
    if (!secret) {
      console.error("WEBHOOK_SECRET não configurado nas Script Properties");
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Empty body" });
    }

    let envelope;
    try { envelope = JSON.parse(e.postData.contents); }
    catch (err) {
      console.error("Envelope JSON inválido:", err && err.message ? err.message : err);
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }
    if (!envelope || envelope.v !== 2 ||
        typeof envelope.ts !== "number" ||
        typeof envelope.payload !== "string" ||
        typeof envelope.signature !== "string") {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const skewMs = Math.abs(Date.now() - envelope.ts);
    if (!isFinite(skewMs) || skewMs > 5 * 60 * 1000) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const expected = computeHmacHex_(
      String(envelope.ts) + "." + envelope.payload, secret
    );
    if (!constantTimeEqual_(expected, envelope.signature)) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    let data;
    try { data = JSON.parse(envelope.payload); }
    catch (err) {
      console.error("Payload JSON inválido:", err && err.message ? err.message : err);
      return jsonResponse({ ok: false, error: "Bad request" });
    }

    // Validação estrutural mínima — defesa caso o Next seja burlado
    if (!data || !data.equipe || !Array.isArray(data.integrantes) ||
        data.integrantes.length !== 4 || !data.proposta ||
        !data.aceitesColetivos || !data.liderConfirmacao) {
      return jsonResponse({ ok: false, error: "Bad request" });
    }

    // Length checks
    const overflowEq = checkEquipeLengths_(data.equipe);
    if (overflowEq) return jsonResponse({ ok: false, error: overflowEq });
    for (let i = 0; i < 4; i++) {
      const overflowInt = checkIntegranteLengths_(data.integrantes[i], i + 1);
      if (overflowInt) return jsonResponse({ ok: false, error: overflowInt });
    }
    const overflowProp = checkPropostaLengths_(data.proposta);
    if (overflowProp) return jsonResponse({ ok: false, error: overflowProp });

    // Aceites obrigatórios — todos os 9 individuais por integrante + 7 coletivos + 1 do líder
    for (let i = 0; i < 4; i++) {
      const a = data.integrantes[i].aceites || {};
      for (let k = 0; k < ACEITES_INDIVIDUAIS_KEYS.length; k++) {
        if (a[ACEITES_INDIVIDUAIS_KEYS[k]] !== true) {
          return jsonResponse({ ok: false, error: "Aceite individual faltando: integrante " + (i+1) + " / " + ACEITES_INDIVIDUAIS_KEYS[k] });
        }
      }
    }
    for (let k = 0; k < ACEITES_COLETIVOS_KEYS.length; k++) {
      if (data.aceitesColetivos[ACEITES_COLETIVOS_KEYS[k]] !== true) {
        return jsonResponse({ ok: false, error: "Aceite coletivo faltando: " + ACEITES_COLETIVOS_KEYS[k] });
      }
    }
    if (data.liderConfirmacao.aceiteFinal !== true) {
      return jsonResponse({ ok: false, error: "Aceite final do líder faltando" });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      console.error("Sheet '" + CONFIG.SHEET_NAME + "' não encontrada. Rode setup().");
      return jsonResponse({ ok: false, error: "internal_error" });
    }

    // ---------- DEDUP por CPF (item 3.2 do Edital) ----------
    // Coleta CPFs dos novos integrantes, normalizados pra dígitos.
    const novosCPFs = data.integrantes.map(function (i) {
      return String(i.cpf || "").replace(/\D/g, "");
    });
    // Coleta e-mails (oficial + 4 pessoais) pra dedup também.
    const novosEmails = [String(data.equipe.emailOficial || "").trim().toLowerCase()]
      .concat(data.integrantes.map(function (i) {
        return String(i.emailPessoal || "").trim().toLowerCase();
      }));

    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const allData = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
      // Índices das colunas que contêm CPF e e-mail (em todos os 4 blocos)
      const cpfColIdxs = [], emailColIdxs = [];
      for (let i = 0; i < COLUMNS.length; i++) {
        if (COLUMNS[i].indexOf("— CPF") >= 0) cpfColIdxs.push(i);
        if (COLUMNS[i].indexOf("E-mail oficial") >= 0 || COLUMNS[i].indexOf("— E-mail") >= 0) emailColIdxs.push(i);
      }
      for (let r = 0; r < allData.length; r++) {
        for (let c = 0; c < cpfColIdxs.length; c++) {
          const existing = String(allData[r][cpfColIdxs[c]] || "").replace(/\D/g, "").replace(/^'/, "");
          if (existing && novosCPFs.indexOf(existing) >= 0) {
            return jsonResponse({ ok: false, error: "duplicate_cpf" });
          }
        }
        for (let c = 0; c < emailColIdxs.length; c++) {
          const existing = String(allData[r][emailColIdxs[c]] || "").trim().toLowerCase().replace(/^'/, "");
          if (existing && novosEmails.indexOf(existing) >= 0) {
            return jsonResponse({ ok: false, error: "duplicate_email" });
          }
        }
      }
    }

    // Monta a row na ordem das COLUMNS, com .map(sanitizeCell_) pra neutralizar
    // formula injection.
    const row = buildRow_(data);
    sheet.appendRow(row.map(sanitizeCell_));
    const inscricoesRow = sheet.getLastRow();

    // Adiciona card na aba Triagem (best-effort — não quebra se falhar)
    try {
      appendCardToTriagem_(data, inscricoesRow);
    } catch (errTriagem) {
      console.error("Falha ao adicionar card na Triagem:", errTriagem);
    }

    // Adiciona bloco completo na aba Detalhes (best-effort)
    try {
      // Enriquece o `data` com os campos que parseRowToCardData_ adiciona
      // (dataInscricao, status, aceitesColetivosOk, aceitesIndividuaisOk).
      // doPost recebe o `data` direto do payload — preciso construir.
      const fullData = Object.assign({}, data, {
        dataInscricao: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"),
        status: "Pendente",
        aceitesColetivosOk: ACEITES_COLETIVOS_KEYS.filter(function (k) {
          return data.aceitesColetivos && data.aceitesColetivos[k] === true;
        }).join(", "),
      });
      // Anota aceites individuais por integrante (campo derivado)
      fullData.integrantes = (data.integrantes || []).map(function (it) {
        const okList = ACEITES_INDIVIDUAIS_KEYS.filter(function (k) {
          return it && it.aceites && it.aceites[k] === true;
        }).join(", ");
        return Object.assign({}, it, { aceitesIndividuaisOk: okList });
      });
      appendDetalhesBlock_(fullData, inscricoesRow);
    } catch (errDetalhes) {
      console.error("Falha ao adicionar bloco na Detalhes:", errDetalhes);
    }

    // Confirma por e-mail pros 4 integrantes (best-effort)
    try {
      sendConfirmationEmail_(
        data.integrantes.map(function (i) { return i.emailPessoal; }),
        data.equipe.nome
      );
    } catch (errMail) {
      console.error("Falha ao enviar e-mail de confirmação:", errMail);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("doPost falhou:", err && err.stack ? err.stack : err);
    return jsonResponse({ ok: false, error: "internal_error" });
  }
}

// ============================================================================
// buildRow_ — monta a linha da planilha na ordem de COLUMNS
// ============================================================================
function buildRow_(data) {
  const now = new Date();
  const stamp = Utilities.formatDate(now, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");

  const row = [];
  // Meta (4 colunas)
  row.push("Pendente");
  row.push(stamp);
  row.push(""); // Email enviado em
  row.push(""); // Observações

  // Equipe (8 colunas)
  const eq = data.equipe;
  row.push(String(eq.nome || ""));
  row.push(String(eq.slogan || ""));
  row.push(String(eq.cidade || ""));
  row.push(String(eq.estado || ""));
  row.push(String(eq.emailOficial || ""));
  row.push(String(eq.telefone || ""));
  row.push(String(eq.trilha || ""));
  row.push(Number(eq.liderIndex || 0) + 1); // armazena como 1-4

  // Proposta (4 colunas) — ordem precisa bater com PROPOSTA_COLUMNS
  const p = data.proposta;
  row.push(String(p.ideiaDiferencial || ""));
  row.push(String(p.problemaPublico || ""));
  row.push(String(p.aderencia || ""));
  row.push(String(p.tecnologias || ""));

  // Aceites coletivos (1 coluna) — concat das chaves marcadas
  const colTrue = ACEITES_COLETIVOS_KEYS.filter(function (k) {
    return data.aceitesColetivos[k] === true;
  });
  row.push(colTrue.join(", "));

  // Integrantes (30 colunas × 4)
  for (let i = 0; i < 4; i++) {
    const it = data.integrantes[i];
    row.push(String(it.nomeCompleto || ""));
    row.push(String(it.nomeSocial || ""));
    row.push(String(it.cpf || ""));
    row.push(String(it.rg || ""));
    row.push(String(it.dataNascimento || ""));
    row.push(String(it.nacionalidade || ""));
    row.push(String(it.naturalidade || ""));
    row.push(String(it.cidade || ""));
    row.push(String(it.estado || ""));
    row.push(String(it.enderecoCompleto || ""));
    row.push(String(it.emailPessoal || ""));
    row.push(String(it.telefoneCelular || ""));
    row.push(String(it.contatoEmergenciaNome || ""));
    row.push(String(it.contatoEmergenciaTelefone || ""));
    row.push(String(it.contatoEmergenciaParentesco || ""));
    row.push(String(it.genero || ""));
    row.push((it.areasConhecimento || []).join(", "));
    row.push(String(it.ocupacaoAtual || ""));
    row.push(String(it.tempoExperiencia || ""));
    row.push(String(it.nivelFormacao || ""));
    row.push(String(it.cursoFormacao || ""));
    row.push(String(it.anoFormacao || ""));
    row.push(String(it.instituicao || ""));
    row.push(String(it.instituicaoUF || ""));
    row.push(String(it.instituicaoMunicipio || ""));
    row.push(String(it.projetoAcademico || ""));
    row.push(String(it.linkedin || ""));
    row.push(String(it.portfolio || ""));
    row.push(String(it.outrasRedes || ""));
    row.push(String(it.experienciaRelevante || ""));
    row.push(String(it.restricoesAlimentares || ""));
    row.push(String(it.alergias || ""));
    row.push(String(it.medicamentos || ""));
    row.push(String(it.acessibilidade || ""));
    row.push(String(it.outrasObservacoes || ""));
    row.push(String(it.comoSoube || ""));
    const indTrue = ACEITES_INDIVIDUAIS_KEYS.filter(function (k) {
      return it.aceites && it.aceites[k] === true;
    });
    row.push(indTrue.join(", "));
  }
  return row;
}

// ============================================================================
// Length checks — devolvem string descritiva quando ultrapassa o limite
// ============================================================================
function checkEquipeLengths_(eq) {
  const map = [
    ["nome", FIELD_MAX.equipeNome],
    ["slogan", FIELD_MAX.equipeSlogan],
    ["cidade", FIELD_MAX.equipeCidade],
    ["estado", FIELD_MAX.equipeEstado],
    ["emailOficial", FIELD_MAX.equipeEmail],
    ["telefone", FIELD_MAX.equipeTelefone],
    ["trilha", FIELD_MAX.equipeTrilha],
  ];
  for (let i = 0; i < map.length; i++) {
    if (String(eq[map[i][0]] || "").length > map[i][1]) {
      return "Equipe — campo muito longo: " + map[i][0];
    }
  }
  return null;
}
function checkIntegranteLengths_(it, num) {
  const map = [
    ["nomeCompleto", FIELD_MAX.nomeCompleto],
    ["nomeSocial", FIELD_MAX.nomeSocial],
    ["cpf", FIELD_MAX.cpf],
    ["rg", FIELD_MAX.rg],
    ["dataNascimento", FIELD_MAX.dataNascimento],
    ["nacionalidade", FIELD_MAX.nacionalidade],
    ["naturalidade", FIELD_MAX.naturalidade],
    ["cidade", FIELD_MAX.cidade],
    ["estado", FIELD_MAX.estado],
    ["enderecoCompleto", FIELD_MAX.enderecoCompleto],
    ["emailPessoal", FIELD_MAX.emailPessoal],
    ["telefoneCelular", FIELD_MAX.telefoneCelular],
    ["contatoEmergenciaNome", FIELD_MAX.contatoEmergenciaNome],
    ["contatoEmergenciaTelefone", FIELD_MAX.contatoEmergenciaTelefone],
    ["contatoEmergenciaParentesco", FIELD_MAX.contatoEmergenciaParentesco],
    ["genero", FIELD_MAX.genero],
    ["ocupacaoAtual", FIELD_MAX.ocupacaoAtual],
    ["tempoExperiencia", FIELD_MAX.tempoExperiencia],
    ["nivelFormacao", FIELD_MAX.nivelFormacao],
    ["cursoFormacao", FIELD_MAX.cursoFormacao],
    ["anoFormacao", FIELD_MAX.anoFormacao],
    ["instituicao", FIELD_MAX.instituicao],
    ["instituicaoUF", FIELD_MAX.instituicaoUF],
    ["instituicaoMunicipio", FIELD_MAX.instituicaoMunicipio],
    ["projetoAcademico", FIELD_MAX.projetoAcademico],
    ["linkedin", FIELD_MAX.linkedin],
    ["portfolio", FIELD_MAX.portfolio],
    ["outrasRedes", FIELD_MAX.outrasRedes],
    ["experienciaRelevante", FIELD_MAX.experienciaRelevante],
    ["restricoesAlimentares", FIELD_MAX.restricoesAlimentares],
    ["alergias", FIELD_MAX.alergias],
    ["medicamentos", FIELD_MAX.medicamentos],
    ["acessibilidade", FIELD_MAX.acessibilidade],
    ["outrasObservacoes", FIELD_MAX.outrasObservacoes],
    ["comoSoube", FIELD_MAX.comoSoube],
  ];
  for (let i = 0; i < map.length; i++) {
    if (String(it[map[i][0]] || "").length > map[i][1]) {
      return "Integrante " + num + " — campo muito longo: " + map[i][0];
    }
  }
  return null;
}
function checkPropostaLengths_(p) {
  const map = [
    ["ideiaDiferencial", FIELD_MAX.propostaIdeiaDiferencial],
    ["problemaPublico", FIELD_MAX.propostaProblemaPublico],
    ["aderencia", FIELD_MAX.propostaAderencia],
    ["tecnologias", FIELD_MAX.propostaTecnologias],
  ];
  for (let i = 0; i < map.length; i++) {
    if (String(p[map[i][0]] || "").length > map[i][1]) {
      return "Proposta — campo muito longo: " + map[i][0];
    }
  }
  return null;
}

// ============================================================================
// handleStatusChange — dispara quando o admin muda o Status na planilha
// ----------------------------------------------------------------------------
// Trigger MANUAL (installable). Instalação:
//   1. No editor do Apps Script → ícone de relógio "Acionadores"
//   2. + Adicionar acionador → handleStatusChange / Head / Da planilha / Ao editar
//   3. Autoriza permissões (Gmail incluso)
// ============================================================================
function handleStatusChange(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const name = sheet.getName();

    if (name === CONFIG.SHEET_NAME) {
      // Edit veio da Inscricoes (admin trabalhou direto no banco bruto)
      if (range.getColumn() !== STATUS_COL) return;
      if (range.getRow() < 2) return;
      processStatusEdit_(range.getRow(), e.oldValue, "inscricoes");
    } else if (name === TRIAGEM_SHEET_NAME) {
      // Edit veio da Triagem (workflow normal de aprovação)
      if (range.getColumn() !== TRIAGEM_STATUS_COL) return;
      const row = range.getRow();
      if (row < 2) return; // cabeçalho
      // Status só é editável na PRIMEIRA linha de cada card (linhas 2, 10, 18, ...)
      if ((row - 2) % TRIAGEM_CARD_ROWS !== 0) return;
      // Lê a inscricoesRow da coluna F oculta
      const inscricoesRow = Number(sheet.getRange(row, TRIAGEM_HIDDEN_COL).getValue());
      if (!inscricoesRow || inscricoesRow < 2) return;
      processStatusEdit_(inscricoesRow, e.oldValue, "triagem", row);
    }
  } catch (err) {
    console.error("handleStatusChange falhou:", err && err.stack ? err.stack : err);
  }
}

// ============================================================================
// processStatusEdit_ — lógica central de mudança de status
// ----------------------------------------------------------------------------
// `inscricoesRow` — linha na aba Inscricoes (sempre o banco bruto)
// `oldValueRaw` — valor anterior (do evento de trigger)
// `source` — "inscricoes" ou "triagem" — pra saber qual aba já está atualizada
// `triagemRow` — opcional, se source === "triagem", a linha do card
// ============================================================================
function processStatusEdit_(inscricoesRow, oldValueRaw, source, triagemRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  const triagem = ss.getSheetByName(TRIAGEM_SHEET_NAME);
  if (!inscricoes) return;

  // Pega o novo status (canonical) — da fonte que sofreu o edit
  let newStatus;
  if (source === "triagem" && triagem && triagemRow) {
    newStatus = String(triagem.getRange(triagemRow, 1).getValue()).trim();
  } else {
    newStatus = String(inscricoes.getRange(inscricoesRow, STATUS_COL).getValue()).trim();
  }
  const oldStatus = String(oldValueRaw || "").trim();

  // Sincroniza o status pra outra aba (sem disparar trigger recursivamente —
  // edits programáticos não disparam onEdit instalável)
  if (source === "triagem") {
    inscricoes.getRange(inscricoesRow, STATUS_COL).setValue(newStatus);
  } else if (source === "inscricoes" && triagem) {
    syncStatusToTriagemCard_(triagem, inscricoesRow, newStatus);
  }

  if (newStatus === oldStatus) return;
  if (["Aprovado", "Reprovado"].indexOf(newStatus) < 0) return;

  // Recupera dados da linha pra montar o e-mail
  const rowData = inscricoes.getRange(inscricoesRow, 1, 1, COLUMNS.length).getValues()[0];
  function colIdx(name) {
    for (let i = 0; i < COLUMNS.length; i++) if (COLUMNS[i] === name) return i;
    return -1;
  }
  const equipeNome = String(rowData[colIdx("Equipe — Nome")] || "");
  const liderIdx = Number(rowData[colIdx("Líder (índice 1-4)")] || 1);
  const emails = [
    String(rowData[colIdx("Int 1 — E-mail")] || ""),
    String(rowData[colIdx("Int 2 — E-mail")] || ""),
    String(rowData[colIdx("Int 3 — E-mail")] || ""),
    String(rowData[colIdx("Int 4 — E-mail")] || ""),
  ].filter(function (x) { return x.length > 0; })
   .map(function (x) { return x.replace(/^'/, "").trim(); });
  const liderNome = String(rowData[colIdx("Int " + liderIdx + " — Nome completo")] || "");

  if (emails.length === 0) {
    inscricoes.getRange(inscricoesRow, EMAIL_SENT_COL).setValue("ERRO: sem e-mails");
    return;
  }

  // Bloqueia reenvio do MESMO tipo
  const already = String(rowData[EMAIL_SENT_COL - 1] || "").trim();
  if (already && already.indexOf("ERRO") !== 0) {
    const lastType = already.indexOf("Aprovação") === 0 ? "Aprovado" :
                     already.indexOf("Reprovação") === 0 ? "Reprovado" : null;
    if (lastType === newStatus) return;
  }

  if (newStatus === "Aprovado") sendApprovalEmail_(emails, equipeNome, liderNome);
  else sendRejectionEmail_(emails, equipeNome, liderNome);

  const tipo = newStatus === "Aprovado" ? "Aprovação" : "Reprovação";
  inscricoes.getRange(inscricoesRow, EMAIL_SENT_COL).setValue(
    tipo + " · " + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm")
  );
}

// Acha o card da Triagem que aponta pra essa inscricoesRow e atualiza o Status
function syncStatusToTriagemCard_(triagem, inscricoesRow, newStatus) {
  const lastRow = triagem.getLastRow();
  if (lastRow < 2) return;
  // Coluna F (oculta) tem inscricoesRow no PRIMEIRO linha de cada card.
  // Cards começam em linhas 2, 10, 18, ... (intervalo de TRIAGEM_CARD_ROWS).
  const cardCount = Math.floor((lastRow - 2 + TRIAGEM_CARD_ROWS) / TRIAGEM_CARD_ROWS);
  for (let i = 0; i < cardCount; i++) {
    const row = 2 + i * TRIAGEM_CARD_ROWS;
    const ref = Number(triagem.getRange(row, TRIAGEM_HIDDEN_COL).getValue());
    if (ref === inscricoesRow) {
      triagem.getRange(row, 1).setValue(newStatus);
      return;
    }
  }
}

// ============================================================================
// Envio dos e-mails
// ----------------------------------------------------------------------------
// Os 4 integrantes recebem juntos (todos no `to:`). Como são uma equipe, ver
// o e-mail dos colegas é esperado.
// ============================================================================
function sendConfirmationEmail_(emails, equipeNome) {
  const to = emails.join(",");
  MailApp.sendEmail({
    to: to,
    subject: "Recebemos a inscrição da equipe " + equipeNome + " — " + CONFIG.EVENT_NAME,
    htmlBody: buildConfirmationHTML_(equipeNome),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}
function sendApprovalEmail_(emails, equipeNome, liderNome) {
  MailApp.sendEmail({
    to: emails.join(","),
    subject: "Equipe " + equipeNome + " está dentro — " + CONFIG.EVENT_NAME,
    htmlBody: buildApprovalHTML_(equipeNome, liderNome),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}
function sendRejectionEmail_(emails, equipeNome, liderNome) {
  MailApp.sendEmail({
    to: emails.join(","),
    subject: "Sobre a inscrição da equipe " + equipeNome + " — " + CONFIG.EVENT_NAME,
    htmlBody: buildRejectionHTML_(equipeNome, liderNome),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}

// ============================================================================
// Templates HTML dos e-mails
// ============================================================================
function buildConfirmationHTML_(equipeNome) {
  const team = escapeHtml(equipeNome);
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");
  return emailShell_(
    "Recebemos a inscrição da equipe",
    "✦ Inscrição recebida",
    "Obrigado, equipe " + team + "!",
    [
      "A inscrição da equipe <strong>" + team + "</strong> foi recebida com sucesso. Vocês estão oficialmente na lista de análise.",
      "A organização vai ler cada inscrição com atenção e, em breve, todos os integrantes recebem um novo e-mail com o resultado. Não precisa fazer nada agora.",
    ],
    "Só pra lembrar",
    CONFIG.EVENT_DATE + " · " + CONFIG.EVENT_LOCATION,
    {
      ctaText: "Seguir " + CONFIG.EVENT_INSTAGRAM + " →",
      ctaHref: "https://instagram.com/" + instagramHandle,
      ctaStyle: "soft",
    }
  );
}

function buildApprovalHTML_(equipeNome, liderNome) {
  const team = escapeHtml(equipeNome);
  const firstLider = escapeHtml(String(liderNome || "").trim().split(/\s+/)[0] || "líder");
  return emailShell_(
    "Vocês estão dentro",
    "✦ Inscrição confirmada",
    "Equipe " + team + ", vocês estão dentro!",
    [
      "A inscrição da equipe <strong>" + team + "</strong> foi aprovada. Agora vocês fazem parte de uma comunidade que acredita que código, design e colaboração podem transformar a realidade.",
      "<strong>Próximos passos:</strong> em breve, um novo e-mail com cronograma completo, instruções de check-in e dinâmica do evento. " + firstLider + ", como líder, você é o ponto focal de comunicação com a organização.",
      "<strong>Lembretes importantes:</strong> credenciamento presencial em 24/06/2026 das 10h às 14h no Hotel Praiamar Arena (item 3.3.3 do Edital). Confirmação de presença até 16/06/2026 pelo e-mail oficial.",
    ],
    "Detalhes do evento",
    CONFIG.EVENT_DATE + " · " + CONFIG.EVENT_LOCATION + " · " + CONFIG.EVENT_PRIZE,
    {
      ctaText: "Acessar o site do evento →",
      ctaHref: CONFIG.SITE_URL,
      ctaStyle: "solid",
    }
  );
}

function buildRejectionHTML_(equipeNome /*, liderNome */) {
  const team = escapeHtml(equipeNome);
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");
  return emailShell_(
    "Sobre a inscrição da equipe",
    "✦ Resultado da inscrição",
    "Obrigado pelo interesse, equipe " + team + ".",
    [
      "Recebemos um número de inscrições bem acima das <strong>160 vagas</strong> disponíveis. Cada formulário foi lido com atenção, e infelizmente não foi possível confirmar a vaga da equipe <strong>" + team + "</strong> desta vez.",
      "Isso não reflete o valor do que vocês construíram — é só uma questão de capacidade pra esta edição específica. Valorizamos demais o tempo investido na inscrição.",
      "Se quiserem continuar por perto, a comunidade tá sempre ativa. Vem meetup, workshop e novas edições — e adoraríamos ter vocês juntos.",
    ],
    null, null,
    {
      ctaText: "Seguir " + CONFIG.EVENT_INSTAGRAM + " →",
      ctaHref: "https://instagram.com/" + instagramHandle,
      ctaStyle: "soft",
    }
  );
}

// Shell visual compartilhado pros 3 e-mails — reduz duplicação e mantém
// identidade visual consistente.
function emailShell_(preview, eyebrow, title, paragraphs, infoTitle, infoText, cta) {
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");
  const accent = cta && cta.ctaStyle === "solid"
    ? "background:#ff8c00;color:#0f0624;font-weight:700;padding:14px 32px;border-radius:999px;text-decoration:none;font-size:14.5px"
    : "background:rgba(255,255,255,0.06);border:1px solid rgba(255,140,0,0.4);color:#ff8c00;font-weight:600;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px";
  const infoBlock = (infoTitle && infoText)
    ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px"><tr><td style="background:rgba(255,140,0,0.06);border-left:3px solid #ff8c00;border-radius:0 10px 10px 0;padding:18px 22px"><div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:3px">' + escapeHtml(infoTitle) + '</div><div style="color:#ffffff;font-weight:600;font-size:14.5px;line-height:1.55">' + infoText + '</div></td></tr></table>'
    : '';
  const paras = paragraphs.map(function (p, idx) {
    const mb = idx === paragraphs.length - 1 ? "26px" : "18px";
    return '<p style="margin:0 0 ' + mb + ';color:rgba(255,255,255,0.8);font-size:15.5px;line-height:1.65">' + p + '</p>';
  }).join("");
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(preview) + '</title></head><body style="margin:0;padding:0;background:#0f0624;font-family:\'Inter\',\'Segoe UI\',Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escapeHtml(preview) + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f0624"><tr><td align="center" style="padding:32px 16px 48px">' +
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%">' +
    '<tr><td align="center" style="padding:8px 0 28px">' +
    '<div style="display:inline-block;width:38px;height:38px;border-radius:50%;background:radial-gradient(circle,#fff7d4 0%,#ffd34f 28%,#ff8c00 68%,#ff6b00 100%);margin-bottom:14px"></div>' +
    '<div style="font-weight:800;font-size:19px;letter-spacing:-0.4px;color:#ffffff">Hackathon<span style="background:linear-gradient(90deg,#ffc830,#ff8c00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">&nbsp;do Sol</span></div>' +
    '</td></tr>' +
    '<tr><td style="background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%),#180a34;border:1px solid rgba(255,255,255,0.08);border-radius:18px">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">' +
    '<tr><td style="height:3px;line-height:3px;font-size:3px;background:linear-gradient(90deg,#ffd34f,#ffc830,#ff8c00);border-top-left-radius:18px;border-top-right-radius:18px">&nbsp;</td></tr>' +
    '<tr><td style="padding:40px 36px 36px">' +
    '<div style="color:#ff8c00;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-bottom:18px">' + escapeHtml(eyebrow) + '</div>' +
    '<h1 style="margin:0 0 18px;font-weight:800;font-size:28px;line-height:1.2;letter-spacing:-0.5px;color:#ffffff">' + escapeHtml(title) + '</h1>' +
    paras + infoBlock +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><a href="' + cta.ctaHref + '" style="display:inline-block;' + accent + '">' + escapeHtml(cta.ctaText) + '</a></td></tr></table>' +
    '<p style="margin:30px 0 0;padding-top:22px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.55);font-size:13px;line-height:1.65">Dúvidas? <strong style="color:rgba(255,255,255,0.85);font-weight:600">Respondam este e-mail</strong> — a organização lê todas as mensagens.</p>' +
    '</td></tr></table></td></tr>' +
    '<tr><td align="center" style="padding:30px 24px 8px"><p style="margin:0;color:rgba(255,255,255,0.55);font-size:13px;font-weight:600">— Equipe Hackathon do Sol</p></td></tr>' +
    '<tr><td align="center" style="padding:20px 16px 8px;color:rgba(255,255,255,0.35);font-size:11px;line-height:1.75">' +
    CONFIG.EVENT_DATE + ' · ' + CONFIG.EVENT_LOCATION + '<br>' +
    '<a href="https://instagram.com/' + instagramHandle + '" style="color:rgba(255,165,48,0.75);text-decoration:none">' + CONFIG.EVENT_INSTAGRAM + '</a> · <span style="color:rgba(255,255,255,0.4)">hackathondosol@gmail.com</span>' +
    '</td></tr></table></td></tr></table></body></html>';
}

// ============================================================================
// Utilitários
// ============================================================================
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Neutraliza CSV/formula injection no Google Sheets. Valores começando com
// =, +, -, @, TAB ou CR seriam avaliados como fórmula pelo Sheets. Prefixar
// com apóstrofo força texto literal (o ' fica oculto na célula).
function sanitizeCell_(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function computeHmacHex_(text, secret) {
  const bytes = Utilities.computeHmacSha256Signature(
    text, secret, Utilities.Charset.UTF_8
  );
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    if (b < 16) hex += "0";
    hex += b.toString(16);
  }
  return hex;
}

function constantTimeEqual_(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
