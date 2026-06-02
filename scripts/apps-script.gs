/**
 * ============================================================================
 *  HACKATHON DO SOL 2026 — Sistema de Inscrições (V2 — por EQUIPE)
 *  Google Apps Script
 * ----------------------------------------------------------------------------
 *  O que este script faz:
 *    1. Recebe inscrições de EQUIPES (4 integrantes) via POST do site Next.
 *    2. Salva cada equipe como UMA linha na aba "Inscricoes" (183 colunas:
 *       6 meta + 8 equipe + 4 proposta + 1 aceites coletivos + 41 × 4 integrantes).
 *    3. Dedup por CPF (item 5.2 do Edital) e por e-mail (oficial + 4 pessoais).
 *    4. Envia e-mail de confirmação imediato pro líder (conta Google do submit).
 *    5. Quando o admin muda o Status da equipe na planilha pra Aprovado ou
 *       Reprovado, envia e-mail correspondente pro líder.
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
  EVENT_PRIZE: "R$ 21 mil em prêmios",
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
  cep: 9, logradouro: 150, numero: 15, complemento: 60, bairro: 80,
  emailPessoal: 254, telefoneCelular: 20,
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
  "Google ID líder",   // E — ID estável da conta Google do líder; preenchido
                       //     automaticamente no submit pra linkar a inscrição
                       //     com a sessão do site (usado em /api/inscricao/status)
  "E-mail Google líder", // F — e-mail da conta Google que fez o submit. Único
                       //     destinatário das notificações (confirmação,
                       //     aprovação, reprovação). Os emails pessoais dos
                       //     4 integrantes ficam só pra registro na planilha.
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
  "CEP",
  "Logradouro",
  "Número",
  "Complemento",
  "Bairro",
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
// Data do credenciamento (item 5.3.3 do Edital) usada como referência pra
// calcular idade — bate com o critério legal de "≥ 18 até 24/06/2026".
const CRED_DATE = new Date(2026, 5, 24); // mês 5 = junho (0-indexed)

// ============================================================================
// ABA DETALHES — view estruturada vertical, 1 equipe por bloco (~56 linhas)
// ----------------------------------------------------------------------------
// Substitui o uso humano da aba Inscricoes (143 colunas) — ela vira hidden,
// só backend. Cada equipe vira um relatório legível de cabo a rabo, com os
// 4 integrantes lado a lado (cols B-E) e proposta merged. O admin que abre o
// link "↗ ver detalhes" da Triagem cai aqui, no bloco da equipe específica.
// ============================================================================
const DETALHES_SHEET_NAME = "Detalhes";
const DETALHES_HEADER_ROWS = 1; // linha topo do sheet

// Campos dos integrantes exibidos no bloco Detalhes, na ordem [label, chave].
// FONTE ÚNICA do layout: o nº de linhas de dados e a posição do rodapé do
// bloco (separador, PROPOSTA, proposta, spacer) são derivados do tamanho
// deste array. Adicionar/remover um campo aqui reajusta o bloco inteiro.
const DETALHES_FIELDS = [
  ["Nome completo", "nomeCompleto"],
  ["Nome social", "nomeSocial"],
  ["CPF", "cpf"],
  ["RG", "rg"],
  ["Data de nascimento", "dataNascimento"],
  ["Nacionalidade", "nacionalidade"],
  ["Naturalidade", "naturalidade"],
  ["Cidade de residência", "cidade"],
  ["Estado de residência", "estado"],
  ["Endereço", "__endereco__"],
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

// Linhas fixas por bloco = 1 EQUIPE + 6 equipe + 1 sep + 1 INTEGRANTES
//                        + 1 sep + 1 PROPOSTA + 4 proposta + 4 spacer = 19.
const DETALHES_BLOCK_ROWS = 19 + DETALHES_FIELDS.length;

// Aba "Aprovados" — lista das equipes aprovadas, alimentada automaticamente
// (ver processStatusEdit_ / addToAprovados_). Coluna H (oculta) guarda a
// linha correspondente na aba Inscricoes, pra localizar/remover.
const APROVADOS_SHEET_NAME = "Aprovados";
const APROVADOS_HEADERS = [
  "Data de aprovação", "Equipe", "Trilha",
  "Integrante 1", "Integrante 2", "Integrante 3", "Integrante 4",
];
const APROVADOS_REF_COL = 8; // coluna H (oculta) — linha na aba Inscricoes

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
    else if (col.indexOf("Logradouro") >= 0) w = 220;
    else if (col === "Status") w = 110;
    else if (col === "Observações") w = 200;
    sheet.setColumnWidth(i + 1, w);
  }

  setupConfigSheet();
  setupAprovadosSheet_(); // cria aba Aprovados (idempotente)
  setupIndividualSheet(); // cria aba "Inscricoes Individuais" (idempotente)
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
    "• Aba \"Aprovados\" criada (lista automática de equipes aprovadas)\n" +
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
  const order = [TRIAGEM_SHEET_NAME, DETALHES_SHEET_NAME, CONFIG.CONFIG_SHEET_NAME, APROVADOS_SHEET_NAME, CONFIG.SHEET_NAME];
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
// MONITOR DE COTA DE E-MAIL + FILA DE REENVIO
// ----------------------------------------------------------------------------
// Conta Gmail comum tem cota de 100 e-mails/dia. Cada inscrição dispara 1
// e-mail de confirmação; aprovação/reprovação disparam mais 1 cada. Duas
// peças trabalham juntas:
//   • Painel na aba Configurações — quantos e-mails restam hoje e quantos
//     estão na fila de reenvio. Atualiza sozinho de hora em hora.
//   • Fila de reenvio (aba oculta "Fila de e-mails") — se a cota estourar,
//     o e-mail entra na fila em vez de se perder, e um gatilho a cada 4h
//     reenvia tudo assim que a cota liberar. Nenhum e-mail é perdido.
// Rode instalarMonitorCotaEmail() 1x pra montar tudo.
// ============================================================================
const COTA_LABEL_ROW = 6; // Configurações!A6/B6 — "E-mails restantes hoje"
const COTA_FILA_ROW = 7;  // Configurações!A7/B7 — "Na fila p/ reenvio"
const COTA_TIME_ROW = 8;  // Configurações!A8/B8 — "Atualizado em"

const FILA_SHEET_NAME = "Fila de e-mails";
const FILA_HEADERS = [
  "Status", "Tipo", "Destinatário", "Equipe", "Líder",
  "Enfileirado em", "Tentativas", "Resultado",
];

// Pega (ou cria) a aba oculta da fila de reenvio.
function getOrCreateFilaSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FILA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FILA_SHEET_NAME);
    sheet.getRange(1, 1, 1, FILA_HEADERS.length).setValues([FILA_HEADERS]);
    sheet.getRange(1, 1, 1, FILA_HEADERS.length)
      .setFontWeight("bold").setBackground("#7c2d12").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  return sheet;
}

// Dispara o e-mail do tipo certo. Lança exceção se o envio falhar (cota/erro).
//
// Para os tipos "*_individual", `equipeNome` carrega o NOME da pessoa (a
// fila de e-mails reaproveita as mesmas colunas — não há equipe no modo
// individual, então usamos o slot pra nome).
function despacharEmail_(tipo, email, equipeNome, liderNome) {
  if (tipo === "confirmacao") {
    sendConfirmationEmail_([email], equipeNome);
  } else if (tipo === "aprovacao") {
    sendApprovalEmail_([email], equipeNome, liderNome);
  } else if (tipo === "reprovacao") {
    sendRejectionEmail_([email], equipeNome, liderNome);
  } else if (tipo === "confirmacao_individual") {
    sendIndividualConfirmationEmail_(email, equipeNome);
  } else if (tipo === "aprovacao_individual") {
    sendIndividualApprovalEmail_(email, equipeNome);
  } else if (tipo === "reprovacao_individual") {
    sendIndividualRejectionEmail_(email, equipeNome);
  } else {
    throw new Error("Tipo de e-mail desconhecido: " + tipo);
  }
}

// Acrescenta um e-mail à fila de reenvio.
function enfileirarEmail_(tipo, email, equipeNome, liderNome, erro) {
  getOrCreateFilaSheet_().appendRow([
    "Pendente",
    tipo,
    email,
    equipeNome || "",
    liderNome || "",
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"),
    1,
    "Falhou no 1º envio: " + (erro || ""),
  ]);
}

// Envia um e-mail; se falhar (cota estourada ou erro transitório), guarda na
// fila pra reenvio automático. NUNCA lança — garante que o fluxo que chamou
// (inscrição, mudança de status) não quebre e que o e-mail não se perca.
function enviarComFila_(tipo, email, equipeNome, liderNome) {
  if (!email) return;
  try {
    despacharEmail_(tipo, email, equipeNome, liderNome);
  } catch (errEnvio) {
    console.error("Envio de e-mail falhou (" + tipo + "), enfileirando:", errEnvio);
    try {
      enfileirarEmail_(tipo, email, equipeNome, liderNome, String(errEnvio));
    } catch (errFila) {
      console.error("CRÍTICO: falha ao enfileirar e-mail:", errFila);
    }
  }
}

// Conta quantos e-mails estão "Pendente" na fila.
function contarFilaPendentes_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILA_SHEET_NAME);
  if (!sheet) return 0;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const status = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let n = 0;
  for (let i = 0; i < status.length; i++) {
    if (String(status[i][0]).trim() === "Pendente") n++;
  }
  return n;
}

// Esvazia a fila — reenvia os e-mails pendentes até a cota do dia acabar.
// Roda por gatilho (a cada 4h) e pelo menu. Os que não couberem na cota de
// hoje continuam "Pendente" e saem no próximo ciclo. É seguro rodar enquanto
// chegam inscrições: appendRow só acrescenta no fim e não desloca as linhas
// já lidas — uma linha nova entra no ciclo seguinte.
function processarFilaEmails() {
  // Lock de DOCUMENTO — separado do getScriptLock que o doPost usa, pra não
  // travar inscrições. Garante que dois drains nunca rodem juntos: sem isso,
  // o gatilho de 4h e um clique no menu poderiam pegar a mesma linha
  // "Pendente" e enviar o mesmo e-mail 2x. Se não conseguir o lock, é porque
  // já tem um drain rodando — então só sai (o outro já está fazendo o trabalho).
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    console.log("processarFilaEmails: outra execução em andamento — pulando.");
    return;
  }
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILA_SHEET_NAME);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const dados = sheet.getRange(2, 1, lastRow - 1, FILA_HEADERS.length).getValues();
        let cota = MailApp.getRemainingDailyQuota();
        for (let i = 0; i < dados.length; i++) {
          if (String(dados[i][0]).trim() !== "Pendente") continue;
          if (cota < 1) break; // cota do dia acabou — resto fica pro próximo ciclo
          const linha = i + 2;
          try {
            despacharEmail_(
              String(dados[i][1]).trim(),
              String(dados[i][2]).trim(),
              String(dados[i][3]),
              String(dados[i][4])
            );
            cota--;
            // Marca "Enviado" logo após o envio — a partir daqui o próximo
            // drain pula essa linha (não reenvia).
            sheet.getRange(linha, 1).setValue("Enviado");
            sheet.getRange(linha, 8).setValue(
              "Enviado em " +
                Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm")
            );
          } catch (err) {
            sheet.getRange(linha, 7).setValue((Number(dados[i][6]) || 0) + 1);
            sheet.getRange(linha, 8).setValue("Falhou: " + err);
            // segue "Pendente" — tenta de novo no próximo ciclo
          }
        }
      }
    }
    atualizarCotaEmail(); // reflete o resultado no painel
  } finally {
    lock.releaseLock();
  }
}

// Rode 1x pra montar o painel na aba Configurações, criar a aba da fila e
// instalar os gatilhos. Idempotente — pode rodar de novo sem efeito colateral.
function instalarMonitorCotaEmail() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
  if (!sheet) {
    const aviso = "Aba \"" + CONFIG.CONFIG_SHEET_NAME +
      "\" não encontrada — rode setup() antes.";
    try { SpreadsheetApp.getUi().alert(aviso); } catch (e) { console.log(aviso); }
    return;
  }

  // Rótulos na coluna A — mesmo estilo roxo das linhas 1-2.
  sheet.getRange("A" + COTA_LABEL_ROW).setValue("E-mails restantes hoje");
  sheet.getRange("A" + COTA_FILA_ROW).setValue("Na fila p/ reenvio");
  sheet.getRange("A" + COTA_TIME_ROW).setValue("Atualizado em");
  sheet.getRange("A" + COTA_LABEL_ROW + ":A" + COTA_TIME_ROW)
    .setFontWeight("bold").setBackground("#4c1d95").setFontColor("#ffffff")
    .setVerticalAlignment("middle");

  // Nota explicativa (mesclada A:B pra o texto caber e quebrar bonito).
  const notaRow = COTA_TIME_ROW + 1;
  sheet.getRange("A" + notaRow + ":B" + notaRow).merge();
  sheet.getRange("A" + notaRow).setValue(
    "ℹ Cota do Gmail comum: 100 e-mails/dia, renova ~24h após o 1º e-mail do " +
    "dia (não é meia-noite fixa). Se a cota estourar, a inscrição é salva " +
    "normalmente e o e-mail entra na fila — reenviado automaticamente assim " +
    "que a cota liberar. Nenhum e-mail é perdido."
  ).setFontColor("#666666").setFontStyle("italic")
    .setWrap(true).setVerticalAlignment("top");
  sheet.setRowHeight(notaRow, 80);

  getOrCreateFilaSheet_(); // cria a aba oculta da fila

  // Gatilhos (1x cada, sem duplicar): painel de hora em hora, fila a cada 4h.
  const triggers = ScriptApp.getProjectTriggers();
  const temTrigger = function (nome) {
    return triggers.some(function (t) { return t.getHandlerFunction() === nome; });
  };
  if (!temTrigger("atualizarCotaEmail")) {
    ScriptApp.newTrigger("atualizarCotaEmail").timeBased().everyHours(1).create();
  }
  if (!temTrigger("processarFilaEmails")) {
    ScriptApp.newTrigger("processarFilaEmails").timeBased().everyHours(4).create();
  }

  atualizarCotaEmail(); // popula o painel agora

  const msg =
    "✓ Monitor de cota + fila de reenvio prontos.\n\n" +
    "Na aba \"" + CONFIG.CONFIG_SHEET_NAME + "\" você vê quantos e-mails restam " +
    "hoje e quantos estão na fila de reenvio.\n\n" +
    "Se a cota de 100/dia estourar, os e-mails entram na fila (aba oculta " +
    "\"" + FILA_SHEET_NAME + "\") e são reenviados sozinhos — nenhum se perde.\n\n" +
    "Recarregue a planilha pra o menu \"Hackathon do Sol\" aparecer.";
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

// Atualiza o painel da aba Configurações: e-mails restantes hoje + quantos
// estão na fila + horário. Chamada pelo gatilho horário, pelo menu, pelo
// instalador e ao fim de processarFilaEmails.
function atualizarCotaEmail() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.CONFIG_SHEET_NAME);
  if (!sheet) return;

  const restantes = MailApp.getRemainingDailyQuota();
  const naFila = contarFilaPendentes_();
  const quando = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");

  // E-mails restantes — verde/laranja/vermelho conforme a folga.
  // setNumberFormat("0") força exibição como número inteiro — sem isso a
  // célula pode herdar formato de data e mostrar "30/12/1899" no lugar do 0.
  const corCota = restantes >= 30 ? "#15803d" : restantes >= 10 ? "#b45309" : "#b91c1c";
  sheet.getRange("B" + COTA_LABEL_ROW)
    .setValue(restantes)
    .setNumberFormat("0")
    .setFontWeight("bold").setFontSize(14).setFontColor(corCota)
    .setHorizontalAlignment("center");

  // Na fila — 0 é verde (nada pendente); >0 laranja (tem reenvio em espera).
  sheet.getRange("B" + COTA_FILA_ROW)
    .setValue(naFila)
    .setNumberFormat("0")
    .setFontWeight("bold").setFontSize(14)
    .setFontColor(naFila === 0 ? "#15803d" : "#b45309")
    .setHorizontalAlignment("center");

  sheet.getRange("B" + COTA_TIME_ROW).setValue(quando);
}

// Menu custom da planilha. onOpen é simple trigger: roda ao abrir e só monta
// o menu (não precisa de autorização). Os itens, quando clicados, rodam com
// permissão total.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Hackathon do Sol")
    .addItem("Atualizar cota de e-mail", "atualizarCotaEmail")
    .addItem("Reenviar e-mails pendentes agora", "processarFilaEmails")
    .addToUi();
}

// ============================================================================
// TESTE MANUAL DA FILA — rode no editor do Apps Script pra verificar, de
// ponta a ponta, que a fila funciona. Enfileira um e-mail de teste pro SEU
// próprio endereço e processa a fila. Esperado: a fila volta a 0 pendentes e
// você recebe 1 e-mail. Não afeta inscrições reais.
// ============================================================================
function testarFilaEmails() {
  const ui = (function () {
    try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
  })();
  const aviso = function (m) { if (ui) ui.alert(m); else console.log(m); };

  const meuEmail = Session.getActiveUser().getEmail();
  if (!meuEmail) {
    aviso("Não consegui detectar seu e-mail. Rode esta função pelo editor, " +
      "logado na conta dona da planilha.");
    return;
  }

  const pendentesAntes = contarFilaPendentes_();
  // Simula um e-mail que falhou no envio e foi parar na fila.
  enfileirarEmail_("confirmacao", meuEmail, "EQUIPE TESTE — pode ignorar", "");
  const aposEnfileirar = contarFilaPendentes_();

  // Processa a fila — envia o que a cota permitir.
  processarFilaEmails();
  const pendentesDepois = contarFilaPendentes_();

  const enviou = pendentesDepois < aposEnfileirar;
  aviso(
    "TESTE DA FILA DE E-MAILS\n\n" +
    "1. Pendentes antes:           " + pendentesAntes + "\n" +
    "2. Depois de enfileirar 1:    " + aposEnfileirar +
      (aposEnfileirar === pendentesAntes + 1 ? "  (subiu 1 — enfileirar OK)" : "  (!)") + "\n" +
    "3. Depois de processar:       " + pendentesDepois + "\n\n" +
    (enviou
      ? "✓ FUNCIONOU. O e-mail saiu da fila e foi enviado.\n" +
        "Confira a caixa de entrada de " + meuEmail + " — deve chegar um\n" +
        "e-mail de confirmação da \"EQUIPE TESTE\". Pode ignorar/apagar."
      : "⚠ O e-mail NÃO saiu da fila. Causa provável: a cota de e-mail de hoje\n" +
        "já zerou (veja \"E-mails restantes hoje\" na aba Configurações).\n" +
        "Isso não é erro da fila — o e-mail segue \"Pendente\" e será enviado\n" +
        "sozinho quando a cota renovar. Rode o teste de novo amanhã pra ver.") +
    "\n\nObs.: o teste deixa 1 linha na aba oculta \"" + FILA_SHEET_NAME +
    "\" — inofensiva, pode apagar se quiser."
  );
}

// ============================================================================
// ABA APROVADOS — lista das equipes aprovadas, alimentada automaticamente
// ----------------------------------------------------------------------------
// Sempre que uma equipe vira "Aprovado" (ver processStatusEdit_), ela entra
// aqui; se o status deixar de ser "Aprovado", ela sai. Rode criarAbaAprovados()
// uma vez pra adicionar a aba a uma planilha que já está em uso.
// ============================================================================

// Rode 1x pra adicionar a aba "Aprovados" a uma planilha JÁ em uso, sem tocar
// nas inscrições existentes. Equipes que já estão com Status "Aprovado" são
// listadas retroativamente.
function criarAbaAprovados() {
  setupAprovadosSheet_();
  backfillAprovados_();
  tidyUpSheets_();
  const msg =
    "✓ Aba \"Aprovados\" pronta.\n\n" +
    "Ela fica ao lado da aba \"Configurações\". A partir de agora, sempre que " +
    "você mudar o Status de uma equipe para \"Aprovado\", ela entra nessa aba " +
    "automaticamente — e sai se você desfizer a aprovação.";
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

// Cria a aba "Aprovados" com cabeçalho. Idempotente: se já existe, não mexe.
function setupAprovadosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(APROVADOS_SHEET_NAME)) return;
  const sheet = ss.insertSheet(APROVADOS_SHEET_NAME);
  sheet.getRange(1, 1, 1, APROVADOS_HEADERS.length).setValues([APROVADOS_HEADERS]);
  sheet.getRange(1, 1, 1, APROVADOS_HEADERS.length)
    .setFontWeight("bold").setBackground("#065f46").setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  sheet.setColumnWidth(1, 150); // Data de aprovação
  sheet.setColumnWidth(2, 210); // Equipe
  sheet.setColumnWidth(3, 250); // Trilha
  for (let c = 4; c <= 7; c++) sheet.setColumnWidth(c, 180); // Integrantes
  sheet.hideColumns(APROVADOS_REF_COL); // coluna de referência interna
}

// Localiza a linha da aba Aprovados que referencia `inscricoesRow`. -1 se não há.
function findAprovadosRow_(sheet, inscricoesRow) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const refs = sheet.getRange(2, APROVADOS_REF_COL, last - 1, 1).getValues();
  for (let i = 0; i < refs.length; i++) {
    if (Number(refs[i][0]) === inscricoesRow) return i + 2;
  }
  return -1;
}

// Adiciona a equipe da linha `inscricoesRow` na aba Aprovados (idempotente).
function addToAprovados_(inscricoesRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(APROVADOS_SHEET_NAME);
  if (!sheet) { setupAprovadosSheet_(); sheet = ss.getSheetByName(APROVADOS_SHEET_NAME); }
  if (!sheet) return;
  if (findAprovadosRow_(sheet, inscricoesRow) > 0) return; // já está na lista

  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!inscricoes) return;
  const rowData = inscricoes.getRange(inscricoesRow, 1, 1, COLUMNS.length).getValues()[0];
  function colVal(name) {
    const i = COLUMNS.indexOf(name);
    return i >= 0 ? String(rowData[i] || "").replace(/^'/, "") : "";
  }
  function nomeInt(i) {
    return (colVal("Int " + i + " — Nome social").trim() ||
            colVal("Int " + i + " — Nome completo").trim());
  }
  const linha = [
    Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"),
    colVal("Equipe — Nome"),
    colVal("Trilha temática"),
    nomeInt(1), nomeInt(2), nomeInt(3), nomeInt(4),
    inscricoesRow,
  ];
  sheet.appendRow(linha.map(sanitizeCell_));
}

// Remove a equipe da linha `inscricoesRow` da aba Aprovados, se estiver lá.
function removeFromAprovados_(inscricoesRow) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(APROVADOS_SHEET_NAME);
  if (!sheet) return;
  const row = findAprovadosRow_(sheet, inscricoesRow);
  if (row > 0) sheet.deleteRow(row);
}

// Popula a aba Aprovados com as equipes que já estão com Status "Aprovado".
function backfillAprovados_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inscricoes = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!inscricoes || inscricoes.getLastRow() < 2) return;
  const statuses = inscricoes
    .getRange(2, STATUS_COL, inscricoes.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0]).trim() === "Aprovado") addToAprovados_(i + 2);
  }
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
    "Triagem de inscrições  ·  Mude o Status (coluna A) para Aprovado ou Reprovado e o e-mail é enviado automaticamente ao líder da equipe."
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
  // (Edital 5.3.1.a + perfil + contato). Campos completos ficam na Detalhes.
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

  // ── Row 8: SPACER — banda cinza-média que delimita cada equipe ──
  sheet.getRange(startRow + 7, 1, 1, TRIAGEM_CARD_COLS).setBackground("#9ca3af");
  sheet.setRowHeight(startRow + 7, 14);

  // ── Borders do card inteiro ──
  // Borda externa média — separa claramente um card do outro
  sheet.getRange(startRow, 1, TRIAGEM_CARD_ROWS - 1, TRIAGEM_CARD_COLS)
    .setBorder(true, true, true, true, false, false, "#9ca3af", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
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
      cep: val("Int " + i + " — CEP"),
      logradouro: val("Int " + i + " — Logradouro"),
      numero: val("Int " + i + " — Número"),
      complemento: val("Int " + i + " — Complemento"),
      bairro: val("Int " + i + " — Bairro"),
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
    // breakApart antes do clear: clear() não desfaz mesclagens. Sem isso,
    // blocos antigos deixariam células mescladas órfãs nas linhas erradas
    // quando o layout muda (ex.: nº de campos diferente do build anterior).
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
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

// Compõe o endereço estruturado (cep/logradouro/numero/complemento/bairro)
// numa linha legível pra exibir na Detalhes. Pula partes vazias.
function composeEndereco_(it) {
  const ruaNum = [it.logradouro, it.numero]
    .filter(function (x) { return x && String(x).trim(); })
    .join(", ");
  return [ruaNum, it.complemento, it.bairro, it.cep]
    .filter(function (x) { return x && String(x).trim(); })
    .join(" · ");
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

  // ── Linhas de dados dos integrantes (uma por campo de DETALHES_FIELDS) ──
  // Cada linha: [label, valor int 1, valor int 2, valor int 3, valor int 4]
  DETALHES_FIELDS.forEach(function (pair) {
    const label = pair[0];
    const key = pair[1];
    if (key === "aceitesIndividuaisOk") {
      rows.push([label].concat(integrantes.map(function (it) { return aceitesSummary(it[key]); })));
    } else if (key === "__endereco__") {
      // Endereço é estruturado em 5 campos (cep/logradouro/numero/
      // complemento/bairro); na Detalhes mostramos composto numa linha só.
      rows.push([label].concat(integrantes.map(function (it) { return composeEndereco_(it); })));
    } else {
      rows.push([label].concat(integrantes.map(function (it) { return f(it, key); })));
    }
  });

  // ── Separador (após os campos dos integrantes) ──
  rows.push(["", "", "", "", ""]);

  // ── Header da proposta ──
  rows.push(["PROPOSTA", "", "", "", ""]);

  // ── 4 campos da proposta ──
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

  // ── Spacer (4 linhas — separa bem do próximo bloco) ──
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

  // LinkedIn e Portfólio como links clicáveis — linha derivada do índice do
  // campo em DETALHES_FIELDS (1ª linha de dados dos integrantes = startRow+9).
  const liRow = startRow + 9 +
    DETALHES_FIELDS.findIndex(function (p) { return p[1] === "linkedin"; });
  const portRow = startRow + 9 +
    DETALHES_FIELDS.findIndex(function (p) { return p[1] === "portfolio"; });
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
// estimateWrapHeight_ — altura (px) de uma célula mesclada com wrap
// ----------------------------------------------------------------------------
// autoResizeRows é ignorado em células mescladas, então a altura tem que ser
// calculada na mão. Estima nº de linhas a partir do comprimento do texto
// (respeitando quebras \n explícitas) e converte pra pixels.
// ============================================================================
function estimateWrapHeight_(text, charsPerLine, lineHeight, padding) {
  const s = String(text == null ? "" : text);
  if (!s) return 40;
  let lines = 0;
  s.split("\n").forEach(function (seg) {
    lines += Math.max(1, Math.ceil(seg.length / charsPerLine));
  });
  return Math.min(600, Math.max(40, lines * lineHeight + padding));
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

  // Linhas de dados dos integrantes — N linhas a partir de startRow + 9
  const N = DETALHES_FIELDS.length;
  for (let i = 0; i < N; i++) {
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

  // Rodapé do bloco — posições derivadas de N pra acompanhar mudanças em
  // DETALHES_FIELDS. Antes eram offsets fixos (40/41/42/46) e desalinhavam
  // quando o array de campos crescia (era o que fazia a PROPOSTA vazar).
  const sepRow = startRow + 9 + N;        // separador
  const propHeaderRow = sepRow + 1;        // cabeçalho PROPOSTA
  const propFirstRow = propHeaderRow + 1;  // 1ª das 4 linhas da proposta
  const spacerFirstRow = propFirstRow + 4;

  // Separador
  sheet.getRange(sepRow, 1, 1, 5).setBackground("#f4f4f5");
  sheet.setRowHeight(sepRow, 6);

  // Cabeçalho da proposta
  sheet.getRange(propHeaderRow, 1, 1, 5)
    .setBackground("#18181b").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(11)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(propHeaderRow, 32);
  sheet.getRange(propHeaderRow, 2, 1, 4).merge();

  // 4 campos da proposta (label A, valor B:E mesclado, wrap)
  // Texto da proposta é longo. Mescla B:E pra dar largura, ativa wrap e
  // calcula a altura na mão — autoResizeRows é ignorado em células mescladas,
  // então a linha ficava na altura mínima e o texto vazava pra fora.
  const propostaVals = sheet.getRange(propFirstRow, 2, 4, 1).getValues();
  for (let i = 0; i < 4; i++) {
    const r = propFirstRow + i;
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
    // B:E mesclada ≈ 880px de largura → ~125 chars/linha a 10pt (com folga).
    sheet.setRowHeight(r, estimateWrapHeight_(propostaVals[i][0], 125, 16, 14));
  }

  // Spacer 4-linha — banda cinza-média que separa os blocos
  sheet.getRange(spacerFirstRow, 1, 4, 5).setBackground("#9ca3af");
  for (let i = 0; i < 4; i++) sheet.setRowHeight(spacerFirstRow + i, 4);

  // Borders externos do bloco inteiro — média, delimita cada equipe
  sheet.getRange(startRow, 1, DETALHES_BLOCK_ROWS - 4, 5)
    .setBorder(true, true, true, true, false, false, "#9ca3af", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
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

// Lê o flag de inscrições abertas/fechadas (checkbox B1 da aba Configurações)
// — mesma fonte que o doGet expõe pro site. Em caso de erro de leitura,
// devolve true (fail-open): não bloqueia inscrição legítima por um problema
// transitório da planilha; o proxy Next e o prazo do Edital são as outras
// camadas de defesa.
function inscricoesAbertas_() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(CONFIG.CONFIG_SHEET_NAME);
    if (!sheet) return true;
    return sheet.getRange("B1").getValue() === true;
  } catch (err) {
    console.error("inscricoesAbertas_ falhou:", err);
    return true;
  }
}

// ============================================================================
// doPost — recebe inscrições do Next.js
// ============================================================================
function doPost(e) {
  // Declarado fora do try interno pra estar disponível no catch geral.
  // Permanece undefined se a exception ocorrer antes do parse do payload.
  let _leaderInfo;
  try {
    const secret = getWebhookSecret_();
    if (!secret) {
      console.error("WEBHOOK_SECRET não configurado nas Script Properties");
      logDebug_({ action: "unauth_secret_missing", detail: "WEBHOOK_SECRET ausente nas Script Properties" });
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    if (!e || !e.postData || !e.postData.contents) {
      logDebug_({ action: "unauth_empty_body", detail: "request chegou sem body" });
      return jsonResponse({ ok: false, error: "Empty body" });
    }

    let envelope;
    try { envelope = JSON.parse(e.postData.contents); }
    catch (err) {
      console.error("Envelope JSON inválido:", err && err.message ? err.message : err);
      logDebug_({ action: "unauth_envelope_invalid_json", detail: String(err && err.message ? err.message : err).slice(0, 200) });
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }
    if (!envelope || envelope.v !== 2 ||
        typeof envelope.ts !== "number" ||
        typeof envelope.payload !== "string" ||
        typeof envelope.signature !== "string") {
      logDebug_({ action: "unauth_envelope_malformed", detail: "v != 2 ou ts/payload/signature faltando" });
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const skewMs = Math.abs(Date.now() - envelope.ts);
    if (!isFinite(skewMs) || skewMs > 5 * 60 * 1000) {
      logDebug_({ action: "unauth_timestamp_skew", detail: "skew = " + skewMs + "ms (limite 300000)" });
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const expected = computeHmacHex_(
      String(envelope.ts) + "." + envelope.payload, secret
    );
    if (!constantTimeEqual_(expected, envelope.signature)) {
      logDebug_({ action: "unauth_hmac_mismatch", detail: "signature do envelope não bate com a calculada" });
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    let data;
    try { data = JSON.parse(envelope.payload); }
    catch (err) {
      console.error("Payload JSON inválido:", err && err.message ? err.message : err);
      logDebug_({ action: "rejeitado_payload_invalid_json", detail: String(err && err.message ? err.message : err).slice(0, 200) });
      return jsonResponse({ ok: false, error: "Bad request" });
    }

    // Action routing — payload novo pode incluir `action: "status"` pra
    // consultar status da inscrição pelo e-mail (usado pelo UserMenu).
    // Sem action ou action="submit" cai no fluxo de submissão (default
    // pra manter compat com payloads antigos).
    if (data && data.action === "status") {
      return handleStatusQuery_({ googleId: data.googleId, email: data.email });
    }

    // Modo INDIVIDUAL — payload com `kind: "individual"` veio da rota
    // /api/inscricao-individual. Roteia pro handler dedicado, que grava
    // na aba "Inscricoes Individuais" e roda dedup cruzado contra a aba
    // de equipes.
    if (data && data.kind === "individual") {
      return handleIndividual_(data);
    }

    // Info do líder pra logar nas decisões abaixo. Try/catch silencioso em
    // logDebug_ garante que log nunca derruba inscrição. Variável declarada
    // no topo da função pra estar visível no catch geral também.
    _leaderInfo = {
      email: (data && data.leaderGoogleEmail) || "",
      googleId: (data && data.leaderGoogleId) || "",
      equipeNome: (data && data.equipe && data.equipe.nome) || "",
    };

    // Inscrições encerradas? Barra aqui — esta é a fonte autoritativa
    // (checkbox B1 da aba Configurações). O proxy Next também checa, mas esta
    // camada não dá pra burlar nem fica defasada por cache.
    if (!inscricoesAbertas_()) {
      logDebug_({ action: "rejeitado_inscricoes_fechadas", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome });
      return jsonResponse({ ok: false, error: "inscriptions_closed" });
    }

    // Validação estrutural mínima — defesa caso o Next seja burlado
    if (!data || !data.equipe || !Array.isArray(data.integrantes) ||
        data.integrantes.length !== 4 || !data.proposta ||
        !data.aceitesColetivos || !data.liderConfirmacao) {
      logDebug_({ action: "rejeitado_estrutura_invalida", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome });
      return jsonResponse({ ok: false, error: "Bad request" });
    }

    // Length checks
    const overflowEq = checkEquipeLengths_(data.equipe);
    if (overflowEq) {
      logDebug_({ action: "rejeitado_overflow", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: overflowEq });
      return jsonResponse({ ok: false, error: overflowEq });
    }
    for (let i = 0; i < 4; i++) {
      const overflowInt = checkIntegranteLengths_(data.integrantes[i], i + 1);
      if (overflowInt) {
        logDebug_({ action: "rejeitado_overflow", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: overflowInt });
        return jsonResponse({ ok: false, error: overflowInt });
      }
    }
    const overflowProp = checkPropostaLengths_(data.proposta);
    if (overflowProp) {
      logDebug_({ action: "rejeitado_overflow", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: overflowProp });
      return jsonResponse({ ok: false, error: overflowProp });
    }

    // Aceites obrigatórios — todos os 9 individuais por integrante + 7 coletivos + 1 do líder
    for (let i = 0; i < 4; i++) {
      const a = data.integrantes[i].aceites || {};
      for (let k = 0; k < ACEITES_INDIVIDUAIS_KEYS.length; k++) {
        if (a[ACEITES_INDIVIDUAIS_KEYS[k]] !== true) {
          const reason = "Aceite individual faltando: integrante " + (i+1) + " / " + ACEITES_INDIVIDUAIS_KEYS[k];
          logDebug_({ action: "rejeitado_aceite_faltando", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: reason });
          return jsonResponse({ ok: false, error: reason });
        }
      }
    }
    for (let k = 0; k < ACEITES_COLETIVOS_KEYS.length; k++) {
      if (data.aceitesColetivos[ACEITES_COLETIVOS_KEYS[k]] !== true) {
        const reason = "Aceite coletivo faltando: " + ACEITES_COLETIVOS_KEYS[k];
        logDebug_({ action: "rejeitado_aceite_faltando", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: reason });
        return jsonResponse({ ok: false, error: reason });
      }
    }
    if (data.liderConfirmacao.aceiteFinal !== true) {
      logDebug_({ action: "rejeitado_aceite_faltando", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: "Aceite final do líder faltando" });
      return jsonResponse({ ok: false, error: "Aceite final do líder faltando" });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      console.error("Sheet '" + CONFIG.SHEET_NAME + "' não encontrada. Rode setup().");
      logDebug_({ action: "internal_error_sheet_not_found", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: "aba '" + CONFIG.SHEET_NAME + "' ausente" });
      return jsonResponse({ ok: false, error: "internal_error" });
    }

    // ---------- LOCK ----------
    // Serializa execuções concorrentes do doPost: dois envios simultâneos
    // (ex.: retry) poderiam passar pelo dedup ao mesmo tempo e gravar duas
    // linhas. Liberado logo após a gravação da linha (ou no fim da execução).
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(25000);
    } catch (errLock) {
      console.error("doPost: não conseguiu o lock:", errLock);
      logDebug_({ action: "internal_error_lock_fail", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: String(errLock && errLock.message ? errLock.message : errLock).slice(0, 200) });
      return jsonResponse({ ok: false, error: "internal_error" });
    }

    // ---------- DEDUP por CPF (item 5.2 do Edital) ----------
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
      // IDEMPOTÊNCIA: se já existe linha do mesmo líder (Google ID ou e-mail
      // da conta Google), a inscrição já está registrada — ex.: retry após
      // timeout do cliente, com o Apps Script ainda rodando. Devolve ok:true
      // sem regravar; senão o dedup por CPF abaixo acusaria "duplicate_cpf"
      // da própria linha recém-criada.
      const googleIdColIdx = COLUMNS.indexOf("Google ID líder");
      const googleEmailColIdx = COLUMNS.indexOf("E-mail Google líder");
      const leaderGoogleId = String(data.leaderGoogleId || "").replace(/^'/, "").trim();
      const leaderGoogleEmail = String(data.leaderGoogleEmail || "").replace(/^'/, "").trim().toLowerCase();
      for (let r = 0; r < allData.length; r++) {
        if (leaderGoogleId && googleIdColIdx >= 0) {
          const existingGid = String(allData[r][googleIdColIdx] || "").replace(/^'/, "").trim();
          if (existingGid && existingGid === leaderGoogleId) {
            logDebug_({ action: "idempotencia_googleid", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome });
            return jsonResponse({ ok: true });
          }
        }
        if (leaderGoogleEmail && googleEmailColIdx >= 0) {
          const existingGem = String(allData[r][googleEmailColIdx] || "").replace(/^'/, "").trim().toLowerCase();
          if (existingGem && existingGem === leaderGoogleEmail) {
            logDebug_({ action: "idempotencia_email", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome });
            return jsonResponse({ ok: true });
          }
        }
        for (let c = 0; c < cpfColIdxs.length; c++) {
          const existing = String(allData[r][cpfColIdxs[c]] || "").replace(/\D/g, "").replace(/^'/, "");
          if (existing && novosCPFs.indexOf(existing) >= 0) {
            logDebug_({ action: "rejeitado_duplicate_cpf", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome });
            return jsonResponse({ ok: false, error: "duplicate_cpf" });
          }
        }
        for (let c = 0; c < emailColIdxs.length; c++) {
          const existing = String(allData[r][emailColIdxs[c]] || "").trim().toLowerCase().replace(/^'/, "");
          if (existing && novosEmails.indexOf(existing) >= 0) {
            logDebug_({ action: "rejeitado_duplicate_email", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome });
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
    // Linha gravada — o dedup não pode mais colidir; libera o lock antes das
    // partes lentas (cards na Triagem/Detalhes, e-mail de confirmação).
    lock.releaseLock();

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

    // Confirma por e-mail SÓ pro líder, no e-mail da conta Google que ele
    // usou pra logar no site. Decisão deliberada: emails do form ficam só
    // pra registro; comunicação oficial vai 1:1 pro líder.
    // enviarComFila_: se a cota de e-mail estourar, entra na fila de reenvio
    // automático em vez de se perder. O try/catch é só defesa extra — um
    // e-mail jamais pode derrubar uma inscrição que já foi gravada.
    try {
      const leaderEmail = String(data.leaderGoogleEmail || "").trim();
      if (leaderEmail) {
        enviarComFila_("confirmacao", leaderEmail, data.equipe.nome, "");
      }
    } catch (errMail) {
      console.error("Falha inesperada no e-mail de confirmação:", errMail);
    }

    logDebug_({ action: "inscricao_gravada", email: _leaderInfo.email, googleId: _leaderInfo.googleId, equipeNome: _leaderInfo.equipeNome, detail: "linha " + inscricoesRow });
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("doPost falhou:", err && err.stack ? err.stack : err);
    // _leaderInfo pode estar undefined se a exception ocorreu antes do parse
    // do payload — coalesce pra objeto vazio pra não derrubar o log.
    const li = _leaderInfo || {};
    logDebug_({
      action: "internal_error_unhandled_exception",
      email: li.email,
      googleId: li.googleId,
      equipeNome: li.equipeNome,
      detail: String(err && err.message ? err.message : err).slice(0, 250),
    });
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
  // Meta (6 colunas)
  row.push("Pendente");
  row.push(stamp);
  row.push(""); // Email enviado em
  row.push(""); // Observações
  row.push(String(data.leaderGoogleId || ""));     // Google ID do líder
  row.push(String(data.leaderGoogleEmail || ""));  // E-mail Google do líder

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

  // Integrantes (41 colunas × 4)
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
    row.push(String(it.cep || ""));
    row.push(String(it.logradouro || ""));
    row.push(String(it.numero || ""));
    row.push(String(it.complemento || ""));
    row.push(String(it.bairro || ""));
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
    ["cep", FIELD_MAX.cep],
    ["logradouro", FIELD_MAX.logradouro],
    ["numero", FIELD_MAX.numero],
    ["complemento", FIELD_MAX.complemento],
    ["bairro", FIELD_MAX.bairro],
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
// handleStatusQuery_ — retorna status da inscrição
// ----------------------------------------------------------------------------
// Chamado pelo doPost quando o payload tem `action: "status"`. Identifica
// a inscrição em DUAS estratégias, em ordem:
//
//   1. Por Google ID do líder (coluna E "Google ID líder")
//      → SEMPRE encontra o líder que se inscreveu logado com aquela conta,
//        mesmo se ele tiver mudado o e-mail oficial depois
//   2. Por e-mail (5 colunas — oficial + 4 pessoais dos integrantes)
//      → cobre os 3 integrantes não-líderes (que não logam pra preencher)
//        + inscrições antigas que não têm googleId gravado
//
// Match case-insensitive. Retorna { ok: true, status: "Pendente|Aprovado|Reprovado" }
// ou { ok: true, status: null } se não encontrar.
// ============================================================================
function handleStatusQuery_(payloadInput) {
  try {
    // Aceita {googleId, email} (formato novo) ou string solta (formato antigo,
    // pra manter compat caso algum caller velho ainda exista).
    let googleId = "", email = "";
    if (typeof payloadInput === "string") {
      email = payloadInput;
    } else if (payloadInput && typeof payloadInput === "object") {
      googleId = String(payloadInput.googleId || "").trim();
      email = String(payloadInput.email || "").trim().toLowerCase();
    }
    if (!googleId && !email) return jsonResponse({ ok: true, status: null });

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) return jsonResponse({ ok: true, status: null });

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonResponse({ ok: true, status: null });

    const allData = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();

    // Status é coluna A (idx 0). Google ID é coluna E (idx 4, META_COLUMNS[4]).
    const statusColIdx = 0;
    const googleIdColIdx = META_COLUMNS.indexOf("Google ID líder");
    const emailColIdxs = [];
    for (let i = 0; i < COLUMNS.length; i++) {
      if (COLUMNS[i].indexOf("E-mail oficial") >= 0 || COLUMNS[i].indexOf("— E-mail") >= 0) {
        emailColIdxs.push(i);
      }
    }

    // 1ª passada: busca por Google ID (match exato)
    if (googleId && googleIdColIdx >= 0) {
      for (let r = 0; r < allData.length; r++) {
        const existing = String(allData[r][googleIdColIdx] || "")
          .trim().replace(/^'/, "");
        if (existing && existing === googleId) {
          const status = String(allData[r][statusColIdx] || "").trim() || "Pendente";
          return jsonResponse({ ok: true, status: status, kind: "equipe" });
        }
      }
    }

    // 2ª passada: fallback por e-mail
    if (email) {
      for (let r = 0; r < allData.length; r++) {
        for (let c = 0; c < emailColIdxs.length; c++) {
          const existing = String(allData[r][emailColIdxs[c]] || "")
            .trim().toLowerCase().replace(/^'/, "");
          if (existing && existing === email) {
            const status = String(allData[r][statusColIdx] || "").trim() || "Pendente";
            return jsonResponse({ ok: true, status: status, kind: "equipe" });
          }
        }
      }
    }

    // 3ª passada: aba "Inscricoes Individuais" — quem se inscreveu pelo modo
    // individual não aparece na aba de equipes. Mesma estratégia (googleId
    // primeiro, e-mail depois). Status fica na coluna A da aba individual.
    const indSheet = ss.getSheetByName(INDIVIDUAL_SHEET_NAME);
    if (indSheet) {
      const indLast = indSheet.getLastRow();
      if (indLast >= 2) {
        const indCols = INDIVIDUAL_COLUMNS;
        const indData = indSheet.getRange(2, 1, indLast - 1, indCols.length).getValues();
        const indGoogleIdIdx = indCols.indexOf("Google ID");
        const indGoogleEmailIdx = indCols.indexOf("E-mail Google");
        // "E-mail" do integrante (single) está nos INTEGRANTE_FIELDS.
        const indEmailFieldIdx = indCols.indexOf("E-mail");
        for (let r = 0; r < indData.length; r++) {
          if (googleId && indGoogleIdIdx >= 0) {
            const existing = String(indData[r][indGoogleIdIdx] || "")
              .trim().replace(/^'/, "");
            if (existing && existing === googleId) {
              const status = String(indData[r][0] || "").trim() || "Pendente";
              return jsonResponse({ ok: true, status: status, kind: "individual" });
            }
          }
          if (email) {
            const candidates = [];
            if (indGoogleEmailIdx >= 0) candidates.push(indData[r][indGoogleEmailIdx]);
            if (indEmailFieldIdx >= 0) candidates.push(indData[r][indEmailFieldIdx]);
            for (let k = 0; k < candidates.length; k++) {
              const existing = String(candidates[k] || "")
                .trim().toLowerCase().replace(/^'/, "");
              if (existing && existing === email) {
                const status = String(indData[r][0] || "").trim() || "Pendente";
                return jsonResponse({ ok: true, status: status, kind: "individual" });
              }
            }
          }
        }
      }
    }

    return jsonResponse({ ok: true, status: null });
  } catch (err) {
    console.error("handleStatusQuery_ falhou:", err && err.message ? err.message : err);
    return jsonResponse({ ok: false, error: "internal_error" });
  }
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
    } else if (name === INDIVIDUAL_SHEET_NAME) {
      // Edit veio da aba "Inscricoes Individuais" — workflow paralelo ao de
      // equipe. Mesmo padrão: muda Status → dispara e-mail correspondente
      // pra pessoa.
      if (range.getColumn() !== STATUS_COL) return;
      if (range.getRow() < 2) return;
      processIndividualStatusEdit_(range.getRow(), e.oldValue);
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

  // Sincroniza a aba "Aprovados" (best-effort): entra ao virar Aprovado,
  // sai ao deixar de ser (Reprovado/Pendente).
  try {
    if (newStatus === "Aprovado") addToAprovados_(inscricoesRow);
    else removeFromAprovados_(inscricoesRow);
  } catch (errAprov) {
    console.error("Falha ao sincronizar aba Aprovados:", errAprov);
  }

  if (["Aprovado", "Reprovado"].indexOf(newStatus) < 0) return;

  // Recupera dados da linha pra montar o e-mail
  const rowData = inscricoes.getRange(inscricoesRow, 1, 1, COLUMNS.length).getValues()[0];
  function colIdx(name) {
    for (let i = 0; i < COLUMNS.length; i++) if (COLUMNS[i] === name) return i;
    return -1;
  }
  const equipeNome = String(rowData[colIdx("Equipe — Nome")] || "");
  const liderIdx = Number(rowData[colIdx("Líder (índice 1-4)")] || 1);
  // Único destinatário: o e-mail Google da conta que fez o submit
  // (gravado na col F "E-mail Google líder" no submit).
  const leaderGoogleEmail = String(rowData[colIdx("E-mail Google líder")] || "")
    .replace(/^'/, "").trim();
  const emails = leaderGoogleEmail ? [leaderGoogleEmail] : [];
  const liderNome = String(rowData[colIdx("Int " + liderIdx + " — Nome completo")] || "");

  if (emails.length === 0) {
    inscricoes.getRange(inscricoesRow, EMAIL_SENT_COL).setValue("ERRO: sem e-mail Google");
    return;
  }

  // Bloqueia reenvio do MESMO tipo
  const already = String(rowData[EMAIL_SENT_COL - 1] || "").trim();
  if (already && already.indexOf("ERRO") !== 0) {
    const lastType = already.indexOf("Aprovação") === 0 ? "Aprovado" :
                     already.indexOf("Reprovação") === 0 ? "Reprovado" : null;
    if (lastType === newStatus) return;
  }

  // enviarComFila_: se a cota de e-mail estourar, o e-mail de aprovação/
  // reprovação entra na fila de reenvio automático em vez de se perder.
  if (newStatus === "Aprovado") {
    enviarComFila_("aprovacao", emails[0], equipeNome, liderNome);
  } else {
    enviarComFila_("reprovacao", emails[0], equipeNome, liderNome);
  }

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
// Notificações (confirmação, aprovação, reprovação) vão SÓ pro líder, no
// e-mail da conta Google que fez o submit. Os e-mails pessoais dos 4
// integrantes ficam só pra registro na planilha. `emails` chega sempre como
// array de um único endereço.
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
      "<strong>Lembretes importantes:</strong> credenciamento presencial em 24/06/2026 das 10h às 14h no Hotel Praiamar Arena (item 5.3.3 do Edital). Confirmação de presença até 16/06/2026 pelo e-mail oficial.",
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

// ============================================================================
// DIAGNÓSTICO / DEBUG — aditivos, nunca derrubam o fluxo principal
// ============================================================================
// Duas peças complementares:
//   1) logDebug_({...})  — chamado pelo doPost a cada decisão (idempotência,
//      duplicate_cpf, gravação, etc). Grava na aba "Debug Log" com TRY/CATCH
//      silencioso: se Logging falhar, doPost segue normal.
//   2) atualizarEmAndamento() — função invocável (e via trigger time-based) que
//      lê drafts do Upstash e popula a aba "Em andamento" com etapa atual de
//      cada equipe que começou mas ainda não finalizou.
//
// Setup necessário (uma vez):
//   • Script Properties: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
//     (mesmos valores do .env.local do projeto Next)
//   • Rodar manualmente `_instalarTriggerEmAndamento` uma vez pra autorizar
//     permissões + criar trigger de 30min
// ============================================================================

const DEBUG_LOG_SHEET_NAME = "Debug Log";
const EM_ANDAMENTO_SHEET_NAME = "Em andamento";

// Limite de linhas mantidas na aba Debug Log. Quando cresce além disso, joga
// fora as mais antigas no próximo log. Evita planilha gigante com o tempo.
const DEBUG_LOG_MAX_ROWS = 2000;

function logDebug_(info) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(DEBUG_LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(DEBUG_LOG_SHEET_NAME);
      sheet.appendRow([
        "Timestamp",
        "Ação",
        "E-mail líder",
        "Google ID líder",
        "Equipe",
        "Detalhe",
      ]);
      sheet.setFrozenRows(1);
      sheet
        .getRange(1, 1, 1, 6)
        .setFontWeight("bold")
        .setBackground("#1c1135")
        .setFontColor("#ffffff");
      sheet.setColumnWidth(1, 160);
      sheet.setColumnWidth(2, 220);
      sheet.setColumnWidth(3, 260);
      sheet.setColumnWidth(4, 220);
      sheet.setColumnWidth(5, 180);
      sheet.setColumnWidth(6, 320);
    }

    // Trim de antiguidade quando passa do teto. Mantém apenas as últimas
    // DEBUG_LOG_MAX_ROWS — apaga da linha 2 pra cima até bater o teto.
    const cur = sheet.getLastRow();
    if (cur > DEBUG_LOG_MAX_ROWS + 1) {
      const toDelete = cur - DEBUG_LOG_MAX_ROWS - 1;
      sheet.deleteRows(2, toDelete);
    }

    sheet.appendRow([
      new Date(),
      String(info.action || ""),
      String(info.email || ""),
      String(info.googleId || ""),
      String(info.equipeNome || ""),
      String(info.detail || ""),
    ]);
  } catch (err) {
    // Sem console.error pra não poluir Stackdriver — o ponto de logDebug_ é
    // best-effort. Falha aqui não pode afetar a inscrição.
  }
}

// ============================================================================
// atualizarEmAndamento() — sincroniza drafts do Upstash com a aba homônima
// ============================================================================
// Lê todas as chaves `draft:*` do Upstash, classifica cada uma pela etapa
// mais avançada preenchida, e repopula a aba "Em andamento". O conteúdo é
// somente leitura no Sheets — não dispara nenhuma submissão nem altera dados
// pessoais; é puramente visualização.
//
// Pode ser chamada manualmente (botão "Executar" no editor do Apps Script)
// OU via trigger time-based instalado por `_instalarTriggerEmAndamento`.
// ============================================================================
function atualizarEmAndamento() {
  const props = PropertiesService.getScriptProperties();
  const upstashUrl = props.getProperty("UPSTASH_REDIS_REST_URL");
  const upstashToken = props.getProperty("UPSTASH_REDIS_REST_TOKEN");
  if (!upstashUrl || !upstashToken) {
    console.error(
      "atualizarEmAndamento: configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN nas Script Properties"
    );
    return;
  }

  // ---------- 1) INSCRIÇÕES JÁ FINALIZADAS (aba Inscricoes) ----------
  // Lê primeiro pra ter o set de e-mails concluídos. Cada linha vira uma
  // entrada no array `rows` com status "✅ Concluída — <data>". Também
  // alimenta `emailsConcluidos` (lowercase) pra deduplicar contra drafts
  // depois.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inscricoesSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const emailsConcluidos = {}; // map: emailLower → dataInscricao
  const rowsConcluidas = [];
  if (inscricoesSheet && inscricoesSheet.getLastRow() >= 2) {
    const lastRow = inscricoesSheet.getLastRow();
    const allData = inscricoesSheet
      .getRange(2, 1, lastRow - 1, COLUMNS.length)
      .getValues();
    const statusIdx = COLUMNS.indexOf("Status");
    const dataIdx = COLUMNS.indexOf("Data inscrição");
    const googleEmailIdx = COLUMNS.indexOf("E-mail Google líder");
    const equipeNomeIdx = COLUMNS.indexOf("Equipe — Nome");
    const trilhaIdx = COLUMNS.indexOf("Trilha temática");
    const cidadeIdx = COLUMNS.indexOf("Equipe — Cidade");
    const estadoIdx = COLUMNS.indexOf("Equipe — Estado");
    const telefoneIdx = COLUMNS.indexOf("Equipe — Telefone");
    for (let r = 0; r < allData.length; r++) {
      const row = allData[r];
      const email = String(row[googleEmailIdx] || "")
        .replace(/^'/, "")
        .trim();
      const emailLower = email.toLowerCase();
      if (!emailLower) continue;
      const status = String(row[statusIdx] || "Pendente").trim();
      const data = String(row[dataIdx] || "").trim();
      emailsConcluidos[emailLower] = data;
      const cidade = String(row[cidadeIdx] || "").trim();
      const estado = String(row[estadoIdx] || "").trim();
      rowsConcluidas.push([
        email,
        String(row[equipeNomeIdx] || ""),
        "✅ Concluída — " + status + (data ? " · " + data : ""),
        "4 / 4",
        String(row[trilhaIdx] || ""),
        cidade ? cidade + (estado ? "/" + estado : "") : "",
        String(row[telefoneIdx] || ""),
      ]);
    }
  }

  // ---------- 2) DRAFTS NO UPSTASH ----------
  const opts = {
    method: "get",
    headers: { Authorization: "Bearer " + upstashToken },
    muteHttpExceptions: true,
  };

  // Lista todas as chaves draft:*
  let keys;
  try {
    const resKeys = UrlFetchApp.fetch(upstashUrl + "/keys/draft:*", opts);
    if (resKeys.getResponseCode() !== 200) {
      console.error(
        "atualizarEmAndamento: falha ao listar chaves:",
        resKeys.getContentText()
      );
      return;
    }
    keys = JSON.parse(resKeys.getContentText()).result || [];
  } catch (err) {
    console.error("atualizarEmAndamento: erro de rede ao listar chaves:", err);
    return;
  }

  const rowsEmAndamento = [];
  const rowsAlarme = []; // enviou mas sumiu — pos: separado pra destaque
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const email = key.replace(/^draft:/, "");
    const emailLower = email.toLowerCase();

    let d;
    try {
      const resGet = UrlFetchApp.fetch(
        upstashUrl + "/get/" + encodeURIComponent(key),
        opts
      );
      if (resGet.getResponseCode() !== 200) continue;
      const raw = JSON.parse(resGet.getContentText()).result;
      if (!raw) continue;
      d = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (err) {
      continue;
    }

    const submittedAt = d._submittedAt || "";
    const jaConcluida = !!emailsConcluidos[emailLower];

    // Se o e-mail está em Inscricoes (com ou sem _submittedAt no draft),
    // pula — a linha "concluída" já cobre. Casos cobertos:
    //   • inscrição com sucesso recente → draft tem _submittedAt + linha
    //   • idempotência subsequente (mesma conta tentou de novo) → draft
    //     pode estar antigo (sem _submittedAt) mas linha já existe.
    if (jaConcluida) continue;

    const equipeNome = (d.equipe && d.equipe.nome) || "";
    const trilha = (d.equipe && d.equipe.trilha) || "";
    const telefone = (d.equipe && d.equipe.telefone) || "";
    const cidade = (d.equipe && d.equipe.cidade) || "";
    const estado = (d.equipe && d.equipe.estado) || "";
    const ints = (d.integrantes || []).filter(function (i) {
      return i && i.nomeCompleto && i.cpf;
    }).length;

    // Schema canônico (lib/inscricao-schema.ts): proposta tem
    // ideiaDiferencial, problemaPublico, aderencia, tecnologias.
    // Considera "preenchida" se pelo menos um dos 3 principais tem texto
    // (tecnologias é mais opcional na percepção do usuário).
    const propostaOk =
      d.proposta &&
      (d.proposta.ideiaDiferencial ||
        d.proposta.problemaPublico ||
        d.proposta.aderencia);
    const aceitesColetivosCount = d.aceitesColetivos
      ? Object.keys(d.aceitesColetivos).filter(function (k) {
          return d.aceitesColetivos[k] === true;
        }).length
      : 0;
    const liderConfirmou =
      d.liderConfirmacao && d.liderConfirmacao.aceiteFinal === true;

    let etapa;
    // submittedAt SEM linha em Inscricoes = ALARME — pessoa enviou, backend
    // confirmou (markDraftSubmitted só roda em result.ok), mas a planilha
    // não tem a inscrição. Caso edge sério: race condition, bug futuro,
    // ou linha apagada manualmente.
    if (submittedAt) {
      etapa = "⚠️ ENVIOU MAS SUMIU — " + submittedAt.slice(0, 19);
    } else if (!equipeNome) etapa = "1. Logou (vazio)";
    else if (!cidade && !telefone) etapa = "2. Nomeou equipe";
    else if (!trilha) etapa = "3. Equipe completa (sem trilha)";
    else if (ints === 0) etapa = "4. Escolheu trilha";
    else if (ints < 4) etapa = "5. Preenchendo integrantes (" + ints + "/4)";
    else if (!propostaOk) etapa = "6. 4 integrantes (falta proposta)";
    else if (aceitesColetivosCount < 5) etapa = "7. Proposta preenchida";
    else if (!liderConfirmou) etapa = "8. Aceites coletivos marcados";
    else etapa = "9. Pronto pra enviar";

    const linha = [
      email,
      equipeNome,
      etapa,
      ints + " / 4",
      trilha,
      cidade ? cidade + (estado ? "/" + estado : "") : "",
      telefone,
    ];
    if (submittedAt) rowsAlarme.push(linha);
    else rowsEmAndamento.push(linha);
  }

  // Ordena cada bucket separadamente
  rowsConcluidas.sort(function (a, b) {
    return String(b[2]).localeCompare(String(a[2]));
  });
  rowsEmAndamento.sort(function (a, b) {
    return String(b[2]).localeCompare(String(a[2]));
  });

  // Ordem final: alarmes no topo (pra chamar atenção) → concluídas →
  // em andamento. Cada equipe aparece exatamente uma vez.
  const rows = rowsAlarme.concat(rowsConcluidas).concat(rowsEmAndamento);

  let sheet = ss.getSheetByName(EM_ANDAMENTO_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EM_ANDAMENTO_SHEET_NAME);
    // Posiciona logo após a aba Triagem (se existir)
    try {
      const triagem = ss.getSheetByName("Triagem");
      if (triagem) {
        sheet.activate();
        ss.moveActiveSheet(triagem.getIndex() + 1);
      }
    } catch (errMove) {
      // sem grilo se mover falhar
    }
  }

  // Limpa só ESTA aba. Outras abas continuam intactas.
  sheet.clear();

  const HEADERS = [
    "E-mail (login Google)",
    "Equipe",
    "Última etapa atingida",
    "Integrantes",
    "Trilha",
    "Cidade",
    "Telefone",
  ];
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet
    .getRange(1, 1, 1, HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#1c1135")
    .setFontColor("#ffffff");

  if (rows.length > 0) {
    sheet
      .getRange(2, 1, rows.length, HEADERS.length)
      .setValues(rows);
  }

  // Larguras razoáveis
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 240);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 160);
  sheet.setColumnWidth(7, 140);

  // Rodapé com timestamp da última atualização — usuário sempre sabe quando
  // a aba foi populada da última vez.
  const tsRow = Math.max(rows.length, 0) + 3;
  sheet.getRange(tsRow, 1).setValue("Última atualização:");
  sheet
    .getRange(tsRow, 2)
    .setValue(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"));
  sheet
    .getRange(tsRow, 1, 1, 2)
    .setFontStyle("italic")
    .setFontColor("#888888");
}

// ============================================================================
// _instalarTriggerEmAndamento — rodar UMA vez pra ativar atualização periódica
// ============================================================================
// Cria trigger time-based que executa atualizarEmAndamento a cada 30 minutos.
// Idempotente: remove triggers antigos pra esta função antes de criar o novo.
//
// Precisa ser rodada manualmente (Apps Script editor → "Executar") porque o
// primeiro acesso pede autorização do usuário.
// ============================================================================
function _instalarTriggerEmAndamento() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "atualizarEmAndamento") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("atualizarEmAndamento")
    .timeBased()
    .everyMinutes(30)
    .create();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Trigger instalado: 'Em andamento' atualiza a cada 30 min",
      "Configuração",
      5
    );
  } catch (e) {
    // sem UI ativa (rodando via API) — toast falha silenciosamente
  }
}

// ============================================================================
// limparDebugLog — apaga todas as linhas da aba Debug Log (preserva header)
// ============================================================================
// Útil pra limpar registros de teste ou pra resetar o histórico. Idempotente:
// se a aba não existir, retorna silenciosamente. Se já estiver vazia (só
// header), idem. NÃO toca em nenhuma outra aba.
// ============================================================================
function limparDebugLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(DEBUG_LOG_SHEET_NAME);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return; // só header (ou vazia) — nada a fazer
    sheet.deleteRows(2, lastRow - 1);
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Debug Log limpo: " + (lastRow - 1) + " linha(s) apagada(s)",
        "Configuração",
        5
      );
    } catch (e) {
      // sem UI (chamada via API) — toast falha silenciosamente
    }
  } catch (err) {
    console.error("limparDebugLog falhou:", err);
  }
}

// ============================================================================
// ============================================================================
// MODO INDIVIDUAL — aba "Inscricoes Individuais"
// ----------------------------------------------------------------------------
// Adicionado como modalidade complementar ao modo equipe. A pessoa se inscreve
// sozinha e a organização forma a equipe (regras no aditivo do Edital).
//
// Estrutura da aba (49 colunas):
//   META (6): Status, Data, Email enviado em, Observações, Google ID, E-mail Google
//   INSCRIÇÃO (2): Trilha preferida, Aceite formação equipe
//   INTEGRANTE (41): mesmos campos do integrante de equipe (INTEGRANTE_FIELDS)
//
// Dedup é CRUZADO: CPF/e-mail são checados contra a aba "Inscricoes" (equipes)
// E contra a própria aba individual. Garante "1 CPF = 1 inscrição"
// independente da modalidade (item 5.2 do Edital).
//
// E-mails (confirmação/aprovação/reprovação) usam templates próprios pra
// referirem-se à pessoa, não à equipe.
// ============================================================================
const INDIVIDUAL_SHEET_NAME = "Inscricoes Individuais";

const INDIVIDUAL_META_COLUMNS = [
  "Status",
  "Data inscrição",
  "Email enviado em",
  "Observações",
  "Google ID",
  "E-mail Google",
];

const INDIVIDUAL_INSCRICAO_FIELDS = [
  "Trilha preferida",
  "Aceite formação equipe",
];

const INDIVIDUAL_COLUMNS = INDIVIDUAL_META_COLUMNS
  .concat(INDIVIDUAL_INSCRICAO_FIELDS)
  .concat(INTEGRANTE_FIELDS);

// Limites adicionais usados no checkIndividualLengths_. Reaproveita FIELD_MAX
// dos integrantes; só agrega os campos novos do individual.
const FIELD_MAX_INDIVIDUAL = {
  trilhaPreferida: 120,
};

// ============================================================================
// setupIndividualSheet — cria a aba "Inscricoes Individuais" se não existir
// ----------------------------------------------------------------------------
// IDEMPOTENTE: se a aba já existe, não toca em nada (preserva dados). Isso
// permite rodar setup() em uma planilha de produção sem destruir registros.
// Pra recriar do zero (ex.: trocou colunas), apague a aba antes manualmente.
// ============================================================================
function setupIndividualSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(INDIVIDUAL_SHEET_NAME);
  if (sheet) {
    // Já existe — não mexer. Se admin precisa recriar, apaga a aba antes.
    return;
  }
  sheet = ss.insertSheet(INDIVIDUAL_SHEET_NAME);
  sheet.getRange(1, 1, 1, INDIVIDUAL_COLUMNS.length).setValues([INDIVIDUAL_COLUMNS]);
  sheet.getRange(1, 1, 1, INDIVIDUAL_COLUMNS.length)
    .setFontWeight("bold")
    .setBackground("#0e7490") // ciano-escuro pra diferenciar da Inscricoes (roxo)
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setRowHeight(1, 36);

  // Dropdown de Status
  const statusRange = sheet.getRange(2, STATUS_COL, 1000, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pendente", "Aprovado", "Reprovado"], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(rule);

  // Formatação condicional por status (mesmo padrão da Inscricoes)
  const rules = sheet.getConditionalFormatRules();
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

  // Larguras
  for (let i = 0; i < INDIVIDUAL_COLUMNS.length; i++) {
    const col = INDIVIDUAL_COLUMNS[i];
    let w = 140;
    if (col === "Status") w = 110;
    else if (col === "Observações") w = 200;
    else if (col === "Experiência relevante") w = 280;
    else if (col === "Logradouro") w = 220;
    sheet.setColumnWidth(i + 1, w);
  }
}

// ============================================================================
// handleIndividual_ — grava inscrição individual e envia confirmação
// ----------------------------------------------------------------------------
// Roteado pelo doPost quando `data.kind === "individual"`. Faz:
//   1. Validação estrutural
//   2. Length checks
//   3. Aceites obrigatórios (9 individuais + formação equipe)
//   4. LOCK (mesmo lock global do equipe — serializa tudo)
//   5. Idempotência por googleId/e-mail na aba individual (retry-safe)
//   6. Dedup cruzado por CPF e e-mail (aba equipe + aba individual)
//   7. Append da linha
//   8. E-mail de confirmação individual via enviarComFila_
// ============================================================================
function handleIndividual_(data) {
  const leaderInfo = {
    email: String(data.leaderGoogleEmail || ""),
    googleId: String(data.leaderGoogleId || ""),
    equipeNome: "[INDIVIDUAL] " + String((data.integrante && data.integrante.nomeCompleto) || ""),
  };

  if (!inscricoesAbertas_()) {
    logDebug_({ action: "rejeitado_inscricoes_fechadas", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome });
    return jsonResponse({ ok: false, error: "inscriptions_closed" });
  }

  if (!data || !data.integrante || typeof data.trilhaPreferida !== "string") {
    logDebug_({ action: "rejeitado_estrutura_invalida_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome });
    return jsonResponse({ ok: false, error: "Bad request" });
  }

  // Length check do integrante (reusa o do equipe; aceita "1" como numeração
  // arbitrária pra mensagem de erro).
  const overflowInt = checkIntegranteLengths_(data.integrante, 1);
  if (overflowInt) {
    logDebug_({ action: "rejeitado_overflow_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: overflowInt });
    return jsonResponse({ ok: false, error: overflowInt });
  }
  if (String(data.trilhaPreferida || "").length > FIELD_MAX_INDIVIDUAL.trilhaPreferida) {
    logDebug_({ action: "rejeitado_overflow_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: "trilhaPreferida muito longa" });
    return jsonResponse({ ok: false, error: "Trilha preferida muito longa" });
  }

  // Aceites individuais (mesmos 9 do equipe)
  const a = data.integrante.aceites || {};
  for (let k = 0; k < ACEITES_INDIVIDUAIS_KEYS.length; k++) {
    if (a[ACEITES_INDIVIDUAIS_KEYS[k]] !== true) {
      const reason = "Aceite individual faltando: " + ACEITES_INDIVIDUAIS_KEYS[k];
      logDebug_({ action: "rejeitado_aceite_faltando_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: reason });
      return jsonResponse({ ok: false, error: reason });
    }
  }
  // Aceite específico do individual (autoriza organização a formar equipe)
  if (data.aceiteFormacaoEquipe !== true) {
    logDebug_({ action: "rejeitado_aceite_faltando_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: "aceiteFormacaoEquipe ausente" });
    return jsonResponse({ ok: false, error: "Aceite de formação de equipe pela organização faltando" });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const indSheet = ss.getSheetByName(INDIVIDUAL_SHEET_NAME);
  if (!indSheet) {
    console.error("Sheet '" + INDIVIDUAL_SHEET_NAME + "' não encontrada. Rode setup() ou setupIndividualSheet().");
    logDebug_({ action: "internal_error_sheet_not_found_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: "aba '" + INDIVIDUAL_SHEET_NAME + "' ausente" });
    return jsonResponse({ ok: false, error: "internal_error" });
  }
  const equipeSheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  // ---------- LOCK ----------
  // Mesmo lock global usado pelo doPost de equipe. Evita race entre individual
  // e equipe (ex.: mesmo CPF chegando nos dois fluxos simultaneamente).
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (errLock) {
    console.error("handleIndividual_: não conseguiu o lock:", errLock);
    logDebug_({ action: "internal_error_lock_fail_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: String(errLock && errLock.message ? errLock.message : errLock).slice(0, 200) });
    return jsonResponse({ ok: false, error: "internal_error" });
  }

  try {
    // ---------- IDEMPOTÊNCIA + DEDUP na aba individual ----------
    const cpfNorm = String(data.integrante.cpf || "").replace(/\D/g, "");
    const emailNorm = String(data.integrante.emailPessoal || "").trim().toLowerCase();
    const leaderGoogleId = String(data.leaderGoogleId || "").trim();
    const leaderGoogleEmail = String(data.leaderGoogleEmail || "").trim().toLowerCase();

    const indLast = indSheet.getLastRow();
    if (indLast >= 2) {
      const indCols = INDIVIDUAL_COLUMNS;
      const indData = indSheet.getRange(2, 1, indLast - 1, indCols.length).getValues();
      const idxGoogleId = indCols.indexOf("Google ID");
      const idxGoogleEmail = indCols.indexOf("E-mail Google");
      const idxCPF = indCols.indexOf("CPF");
      const idxEmail = indCols.indexOf("E-mail");
      for (let r = 0; r < indData.length; r++) {
        // Idempotência: mesma conta Google já gravada → retorna ok sem regravar
        if (leaderGoogleId && idxGoogleId >= 0) {
          const existing = String(indData[r][idxGoogleId] || "").replace(/^'/, "").trim();
          if (existing && existing === leaderGoogleId) {
            logDebug_({ action: "idempotencia_googleid_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome });
            return jsonResponse({ ok: true });
          }
        }
        if (leaderGoogleEmail && idxGoogleEmail >= 0) {
          const existing = String(indData[r][idxGoogleEmail] || "").replace(/^'/, "").trim().toLowerCase();
          if (existing && existing === leaderGoogleEmail) {
            logDebug_({ action: "idempotencia_email_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome });
            return jsonResponse({ ok: true });
          }
        }
        // Dedup CPF dentro da aba individual
        if (cpfNorm && idxCPF >= 0) {
          const existing = String(indData[r][idxCPF] || "").replace(/\D/g, "").replace(/^'/, "");
          if (existing && existing === cpfNorm) {
            logDebug_({ action: "rejeitado_duplicate_cpf_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome });
            return jsonResponse({ ok: false, error: "duplicate_cpf" });
          }
        }
        // Dedup e-mail dentro da aba individual
        if (emailNorm && idxEmail >= 0) {
          const existing = String(indData[r][idxEmail] || "").trim().toLowerCase().replace(/^'/, "");
          if (existing && existing === emailNorm) {
            logDebug_({ action: "rejeitado_duplicate_email_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome });
            return jsonResponse({ ok: false, error: "duplicate_email" });
          }
        }
      }
    }

    // ---------- DEDUP CRUZADO contra a aba de equipes ----------
    // Item 5.2 do Edital: 1 CPF = 1 inscrição, independente da modalidade.
    if (equipeSheet) {
      const eqLast = equipeSheet.getLastRow();
      if (eqLast >= 2) {
        const eqData = equipeSheet.getRange(2, 1, eqLast - 1, COLUMNS.length).getValues();
        const cpfColIdxs = [], emailColIdxs = [];
        for (let i = 0; i < COLUMNS.length; i++) {
          if (COLUMNS[i].indexOf("— CPF") >= 0) cpfColIdxs.push(i);
          if (COLUMNS[i].indexOf("E-mail oficial") >= 0 || COLUMNS[i].indexOf("— E-mail") >= 0) emailColIdxs.push(i);
        }
        for (let r = 0; r < eqData.length; r++) {
          if (cpfNorm) {
            for (let c = 0; c < cpfColIdxs.length; c++) {
              const existing = String(eqData[r][cpfColIdxs[c]] || "").replace(/\D/g, "").replace(/^'/, "");
              if (existing && existing === cpfNorm) {
                logDebug_({ action: "rejeitado_duplicate_cpf_cross", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: "CPF já consta em equipe linha " + (r + 2) });
                return jsonResponse({ ok: false, error: "duplicate_cpf" });
              }
            }
          }
          if (emailNorm) {
            for (let c = 0; c < emailColIdxs.length; c++) {
              const existing = String(eqData[r][emailColIdxs[c]] || "").trim().toLowerCase().replace(/^'/, "");
              if (existing && existing === emailNorm) {
                logDebug_({ action: "rejeitado_duplicate_email_cross", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: "e-mail já consta em equipe linha " + (r + 2) });
                return jsonResponse({ ok: false, error: "duplicate_email" });
              }
            }
          }
        }
      }
    }

    // Monta e grava a linha
    const row = buildIndividualRow_(data);
    indSheet.appendRow(row.map(sanitizeCell_));
    const indRow = indSheet.getLastRow();
    lock.releaseLock();

    // E-mail de confirmação individual via fila (cota-safe)
    try {
      const dest = leaderGoogleEmail || emailNorm;
      const nome = String(data.integrante.nomeCompleto || "").trim();
      if (dest) {
        enviarComFila_("confirmacao_individual", dest, nome, "");
      }
    } catch (errMail) {
      console.error("Falha inesperada no e-mail de confirmação individual:", errMail);
    }

    logDebug_({ action: "individual_gravado", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: "linha " + indRow });
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("handleIndividual_ falhou:", err && err.stack ? err.stack : err);
    logDebug_({ action: "internal_error_unhandled_exception_individual", email: leaderInfo.email, googleId: leaderInfo.googleId, equipeNome: leaderInfo.equipeNome, detail: String(err && err.message ? err.message : err).slice(0, 250) });
    return jsonResponse({ ok: false, error: "internal_error" });
  } finally {
    // Garante release mesmo se algo escapou. tryLock idempotente — release
    // duplicado é no-op.
    try { lock.releaseLock(); } catch (e) { /* */ }
  }
}

// ============================================================================
// buildIndividualRow_ — monta linha pra aba individual (ordem de INDIVIDUAL_COLUMNS)
// ============================================================================
function buildIndividualRow_(data) {
  const now = new Date();
  const stamp = Utilities.formatDate(now, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");
  const it = data.integrante;

  const row = [];
  // META (6)
  row.push("Pendente");
  row.push(stamp);
  row.push(""); // Email enviado em
  row.push(""); // Observações
  row.push(String(data.leaderGoogleId || ""));
  row.push(String(data.leaderGoogleEmail || ""));

  // INSCRIÇÃO (2)
  row.push(String(data.trilhaPreferida || ""));
  row.push(data.aceiteFormacaoEquipe === true ? "Sim" : "Não");

  // INTEGRANTE (41) — mesma ordem de INTEGRANTE_FIELDS
  row.push(String(it.nomeCompleto || ""));
  row.push(String(it.nomeSocial || ""));
  row.push(String(it.cpf || ""));
  row.push(String(it.rg || ""));
  row.push(String(it.dataNascimento || ""));
  row.push(String(it.nacionalidade || ""));
  row.push(String(it.naturalidade || ""));
  row.push(String(it.cidade || ""));
  row.push(String(it.estado || ""));
  row.push(String(it.cep || ""));
  row.push(String(it.logradouro || ""));
  row.push(String(it.numero || ""));
  row.push(String(it.complemento || ""));
  row.push(String(it.bairro || ""));
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
  return row;
}

// ============================================================================
// processIndividualStatusEdit_ — chamado pelo handleStatusChange ao editar
// o Status na aba individual. Dispara o e-mail correspondente pra pessoa.
// ============================================================================
function processIndividualStatusEdit_(row, oldValueRaw) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INDIVIDUAL_SHEET_NAME);
  if (!sheet) return;

  const newStatus = String(sheet.getRange(row, STATUS_COL).getValue()).trim();
  const oldStatus = String(oldValueRaw || "").trim();
  if (newStatus === oldStatus) return;
  if (["Aprovado", "Reprovado"].indexOf(newStatus) < 0) return;

  const rowData = sheet.getRange(row, 1, 1, INDIVIDUAL_COLUMNS.length).getValues()[0];
  function colIdx(name) {
    for (let i = 0; i < INDIVIDUAL_COLUMNS.length; i++) {
      if (INDIVIDUAL_COLUMNS[i] === name) return i;
    }
    return -1;
  }
  const leaderGoogleEmail = String(rowData[colIdx("E-mail Google")] || "").replace(/^'/, "").trim();
  const emailPessoal = String(rowData[colIdx("E-mail")] || "").replace(/^'/, "").trim();
  const dest = leaderGoogleEmail || emailPessoal;
  const nome = String(rowData[colIdx("Nome completo")] || "").trim();

  if (!dest) {
    sheet.getRange(row, EMAIL_SENT_COL).setValue("ERRO: sem e-mail");
    return;
  }

  // Bloqueia reenvio do MESMO tipo
  const already = String(rowData[EMAIL_SENT_COL - 1] || "").trim();
  if (already && already.indexOf("ERRO") !== 0) {
    const lastType = already.indexOf("Aprovação") === 0 ? "Aprovado" :
                     already.indexOf("Reprovação") === 0 ? "Reprovado" : null;
    if (lastType === newStatus) return;
  }

  if (newStatus === "Aprovado") {
    enviarComFila_("aprovacao_individual", dest, nome, "");
  } else {
    enviarComFila_("reprovacao_individual", dest, nome, "");
  }

  const tipo = newStatus === "Aprovado" ? "Aprovação" : "Reprovação";
  sheet.getRange(row, EMAIL_SENT_COL).setValue(
    tipo + " · " + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm")
  );
}

// ============================================================================
// E-mails do modo individual — usam o mesmo emailShell_ do equipe,
// mas com textos endereçados à pessoa (não à equipe).
// ----------------------------------------------------------------------------
// Engatados via despacharEmail_ — ver patch logo abaixo.
// ============================================================================
function sendIndividualConfirmationEmail_(email, nome) {
  MailApp.sendEmail({
    to: email,
    subject: "Recebemos sua inscrição individual — " + CONFIG.EVENT_NAME,
    htmlBody: buildIndividualConfirmationHTML_(nome),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}
function sendIndividualApprovalEmail_(email, nome) {
  MailApp.sendEmail({
    to: email,
    subject: "Você está dentro — " + CONFIG.EVENT_NAME,
    htmlBody: buildIndividualApprovalHTML_(nome),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}
function sendIndividualRejectionEmail_(email, nome) {
  MailApp.sendEmail({
    to: email,
    subject: "Sobre sua inscrição — " + CONFIG.EVENT_NAME,
    htmlBody: buildIndividualRejectionHTML_(nome),
    name: CONFIG.EMAIL_FROM_NAME,
  });
}

function buildIndividualConfirmationHTML_(nome) {
  const first = escapeHtml(String(nome || "").trim().split(/\s+/)[0] || "pessoa");
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");
  return emailShell_(
    "Recebemos sua inscrição individual",
    "✦ Inscrição recebida",
    "Obrigado, " + first + "!",
    [
      "Sua inscrição individual no <strong>" + CONFIG.EVENT_NAME + "</strong> foi recebida. Você está oficialmente na lista de análise.",
      "A organização vai ler cada inscrição com atenção e te envia o resultado por e-mail. Caso seu nome seja aprovado, você será alocado(a) em uma equipe formada pela própria comissão organizadora, conforme as regras do aditivo do Edital.",
      "Não precisa fazer nada agora.",
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

function buildIndividualApprovalHTML_(nome) {
  const first = escapeHtml(String(nome || "").trim().split(/\s+/)[0] || "pessoa");
  return emailShell_(
    "Você está dentro",
    "✦ Inscrição confirmada",
    first + ", você está dentro!",
    [
      "Sua inscrição individual no <strong>" + CONFIG.EVENT_NAME + "</strong> foi aprovada. Agora você faz parte de uma comunidade que acredita que código, design e colaboração podem transformar a realidade.",
      "<strong>Sua equipe será formada no dia do credenciamento</strong> — a organização vai juntar todos os inscritos individuais presentes em equipes de 4 pessoas. Chegue no horário pra conhecer com quem você vai trabalhar nos 3 dias do hackathon.",
      "<strong>Credenciamento presencial:</strong> 24/06/2026 das 10h às 14h no Hotel Praiamar Arena, Natal/RN (item 5.3.3 do Edital). Confirmação de presença até 16/06/2026.",
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

function buildIndividualRejectionHTML_(nome) {
  const first = escapeHtml(String(nome || "").trim().split(/\s+/)[0] || "pessoa");
  const instagramHandle = CONFIG.EVENT_INSTAGRAM.replace("@", "");
  return emailShell_(
    "Sobre sua inscrição",
    "✦ Resultado da inscrição",
    "Obrigado pelo interesse, " + first + ".",
    [
      "Recebemos um número de inscrições bem acima das <strong>160 vagas</strong> disponíveis. Cada formulário foi lido com atenção, e infelizmente não foi possível confirmar sua vaga desta vez.",
      "Isso não reflete o valor do que você construiu — é só uma questão de capacidade pra esta edição específica. Valorizamos demais o tempo investido na inscrição.",
      "Se quiser continuar por perto, a comunidade tá sempre ativa. Vem meetup, workshop e novas edições — e adoraríamos ter você junto.",
    ],
    null, null,
    {
      ctaText: "Seguir " + CONFIG.EVENT_INSTAGRAM + " →",
      ctaHref: "https://instagram.com/" + instagramHandle,
      ctaStyle: "soft",
    }
  );
}
