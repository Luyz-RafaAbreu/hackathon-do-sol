#!/usr/bin/env node
// ============================================================================
// scripts/generate-ies-data.mjs
// ----------------------------------------------------------------------------
// Regenera lib/ies-data.ts a partir do MICRODADOS DO CENSO DA EDUCAÇÃO
// SUPERIOR (INEP) — fonte oficial e canônica das IES brasileiras.
//
// USO:
//   node scripts/generate-ies-data.mjs
//
// O que o script faz:
//   1. Baixa o ZIP de microdados do INEP e extrai
//   2. Lê o cadastro de IES (CO_IES → sigla, nome, UF, município da sede)
//   3. Lê o cadastro de CURSOS em streaming e coleta, por IES, os municípios
//      onde há curso PRESENCIAL — cada um vira um "campus" selecionável.
//      EAD é ignorado (polo de EAD existe em milhares de cidades).
//   4. Combina sede + campi numa lista achatada { sigla, nome, uf, municipio },
//      dedupada e ordenada — UMA ENTRADA POR UNIDADE/CAMPUS
//   5. Escreve lib/ies-data.ts com header indicando auto-geração
//   6. Limpa os arquivos temporários
//
// QUANDO RODAR:
//   • Quando o INEP publicar novo Censo (anualmente, geralmente em outubro)
//   • Se identificar IES faltando ou desatualizada
//
// REQUISITOS:
//   • Node 18+ (pra fetch nativo)
//   • tar disponível no PATH (Windows 10 build 17063+, macOS, Linux)
//   • ~1GB de espaço temporário em disco
//   • Internet pra download
// ============================================================================

import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { cwd } from "node:process";

const CENSUS_YEAR = 2024;
const ZIP_URL = `https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_${CENSUS_YEAR}.zip`;
const TEMP_DIR = "tmp-ies-download";
const ZIP_PATH = join(TEMP_DIR, "microdados.zip");
const OUTPUT = "lib/ies-data.ts";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function ensureCleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function download(url, outPath) {
  log(`▼ baixando ${url}`);
  // Node fetch falha com o server antigo do INEP (provável TLS/cipher
  // mismatch). curl é cross-platform (Windows 10 1803+/macOS/Linux) e funciona.
  const r = spawnSync(
    "curl",
    ["-fL", "-A", "Mozilla/5.0 (hackathon-sol-script)", "-o", outPath, url],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  if (r.error) {
    throw new Error(`curl não encontrado no PATH. ${r.error.message}`);
  }
  if (r.status !== 0) throw new Error(`curl saiu com status ${r.status}`);
  const sizeMB = (statSync(outPath).size / 1024 / 1024).toFixed(1);
  log(`✓ download completo (${sizeMB} MB)`);
}

function extract(zipPath, destDir) {
  log(`▼ extraindo ZIP`);
  // No Windows usa PowerShell Expand-Archive (sempre disponível). Em
  // macOS/Linux usa `unzip` (idem). tar fora dessa lista varia muito —
  // versões antigas não suportam ZIP via -xf.
  const isWindows = process.platform === "win32";
  const r = isWindows
    ? spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
        ],
        { stdio: ["ignore", "inherit", "inherit"] }
      )
    : spawnSync("unzip", ["-q", "-o", zipPath, "-d", destDir], {
        stdio: ["ignore", "inherit", "inherit"],
      });
  if (r.error) {
    throw new Error(
      `Falha ao executar ${isWindows ? "powershell" : "unzip"}. ${r.error.message}`
    );
  }
  if (r.status !== 0) {
    throw new Error(`Extrator saiu com status ${r.status}`);
  }
  log(`✓ extração completa`);
}

function findIesCSV(dir) {
  // O nome do arquivo varia entre anos do Censo. Padrões observados:
  //   • MICRODADOS_ED_SUP_IES_2024.CSV  (Censo 2024)
  //   • MICRODADOS_CADASTRO_IES_2023.CSV
  //   • DM_IES.CSV (anos antigos)
  // O critério é: arquivo .CSV cujo nome contenha "_IES_" ou "_IES." (mas não
  // CURSOS, ALUNO, DOCENTE).
  const candidates = [];
  function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(p);
      else if (
        /\.CSV$/i.test(name) &&
        /_IES[_.]/i.test(name) &&
        !/(CURSO|ALUNO|DOCENTE|LOCAL)/i.test(name)
      ) {
        candidates.push(p);
      }
    }
  }
  walk(dir);
  if (candidates.length === 0) {
    throw new Error(
      `CSV de cadastro IES não encontrado em ${dir}.\n  ` +
        `O INEP pode ter mudado o nome do arquivo — procure manualmente um *_IES*.CSV.`
    );
  }
  log(`✓ CSV de IES localizado: ${relative(cwd(), candidates[0])}`);
  return candidates[0];
}

// Acha o CSV de CADASTRO DE CURSOS — onde estão os locais de oferta: cada
// curso traz o município em que é ministrado, que é o que vira "campus".
function findCursosCSV(dir) {
  const candidates = [];
  function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      let s;
      try {
        s = statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(p);
      else if (/\.CSV$/i.test(name) && /CURSO/i.test(name)) candidates.push(p);
    }
  }
  walk(dir);
  if (candidates.length === 0) {
    throw new Error(`CSV de cursos não encontrado em ${dir}.`);
  }
  log(`✓ CSV de cursos localizado: ${relative(cwd(), candidates[0])}`);
  return candidates[0];
}

// Parseia o cadastro de IES → Map CO_IES → { sigla, nome, uf, municipio (sede) }.
function parseIES(csvPath) {
  log(`▼ parseando cadastro de IES`);
  const text = new TextDecoder("latin1").decode(readFileSync(csvPath));
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV de IES vazio ou sem header");
  const sep = lines[0].includes(";") ? ";" : "|";
  const h = lines[0].split(sep);
  const idx = {
    co: h.indexOf("CO_IES"),
    sigla: h.indexOf("SG_IES"),
    nome: h.indexOf("NO_IES"),
    uf: h.indexOf("SG_UF_IES"),
    municipio: h.indexOf("NO_MUNICIPIO_IES"),
  };
  const missing = Object.entries(idx).filter(([, i]) => i < 0);
  if (missing.length > 0) {
    throw new Error(
      `Colunas faltando no CSV de IES: ${missing.map((m) => m[0]).join(", ")}`
    );
  }
  const map = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const c = line.split(sep);
    const co = (c[idx.co] || "").trim();
    const nome = (c[idx.nome] || "").trim();
    if (!co || !nome) continue;
    map.set(co, {
      sigla: (c[idx.sigla] || "").trim(),
      nome,
      uf: (c[idx.uf] || "").trim(),
      municipio: (c[idx.municipio] || "").trim(),
    });
  }
  log(`✓ ${map.size} IES no cadastro`);
  return map;
}

// Lê o CSV de cursos (centenas de MB) em streaming e coleta os municípios
// distintos onde cada IES oferta curso PRESENCIAL. EAD é ignorado: cursos a
// distância têm "polo" em milhares de cidades — não são campus físico.
async function parseCursosPresencial(csvPath) {
  log(`▼ parseando cursos (streaming) — só presencial`);
  const dec = new TextDecoder("latin1");
  const campusSet = new Set(); // "co\tmunicipio\tuf"
  let idx = null;
  let leftover = "";
  let rows = 0;
  let presencial = 0;

  const processLine = (line) => {
    if (!line) return;
    if (idx === null) {
      const h = line.split(";");
      idx = {
        co: h.indexOf("CO_IES"),
        municipio: h.indexOf("NO_MUNICIPIO"),
        uf: h.indexOf("SG_UF"),
        modalidade: h.indexOf("TP_MODALIDADE_ENSINO"),
      };
      const missing = Object.entries(idx).filter(([, i]) => i < 0);
      if (missing.length > 0) {
        throw new Error(
          `Colunas faltando no CSV de cursos: ${missing.map((m) => m[0]).join(", ")}`
        );
      }
      return;
    }
    rows++;
    const c = line.split(";");
    // TP_MODALIDADE_ENSINO: 1 = Presencial, 2 = EAD. Só presencial.
    if ((c[idx.modalidade] || "").trim() !== "1") return;
    const co = (c[idx.co] || "").trim();
    const municipio = (c[idx.municipio] || "").trim();
    const uf = (c[idx.uf] || "").trim();
    if (!co || !municipio) return;
    presencial++;
    campusSet.add(`${co}\t${municipio}\t${uf}`);
  };

  for await (const chunk of createReadStream(csvPath)) {
    const lines = (leftover + dec.decode(chunk)).split(/\r?\n/);
    leftover = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  }
  if (leftover) processLine(leftover);

  log(
    `✓ ${rows} cursos lidos, ${presencial} presenciais → ${campusSet.size} locais distintos`
  );
  return campusSet;
}

// Combina sede (cadastro de IES) + campi presenciais (cursos) numa lista
// achatada { sigla, nome, uf, municipio } — uma entrada por campus. Dedupa e
// ordena. A sede entra sempre, garantindo ≥1 entrada mesmo pra IES 100% EAD.
function buildEntries(iesByCode, campusSet) {
  const seen = new Set();
  const out = [];
  const add = (sigla, nome, uf, municipio) => {
    if (!nome || !municipio) return;
    const key = `${sigla}\t${nome}\t${uf}\t${municipio}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ sigla, nome, uf, municipio });
  };
  for (const ies of iesByCode.values()) {
    add(ies.sigla, ies.nome, ies.uf, ies.municipio);
  }
  for (const key of campusSet) {
    const [co, municipio, uf] = key.split("\t");
    const ies = iesByCode.get(co);
    if (!ies) continue;
    add(ies.sigla, ies.nome, uf || ies.uf, municipio);
  }
  // Ordena: sigla, depois nome, depois município — diff fácil de inspecionar.
  out.sort((a, b) => {
    if (a.sigla && !b.sigla) return -1;
    if (!a.sigla && b.sigla) return 1;
    const s = (a.sigla || "").localeCompare(b.sigla || "", "pt-BR");
    if (s !== 0) return s;
    const n = a.nome.localeCompare(b.nome, "pt-BR");
    if (n !== 0) return n;
    return a.municipio.localeCompare(b.municipio, "pt-BR");
  });
  log(`✓ ${out.length} entradas (campi) após combinar + dedupe + sort`);
  return out;
}

function writeTSFile(ies, outPath) {
  log(`▼ gerando ${outPath}`);
  const safe = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const entries = ies
    .map(
      (i) =>
        `  { sigla: "${safe(i.sigla)}", nome: "${safe(i.nome)}", ` +
        `uf: "${safe(i.uf)}", municipio: "${safe(i.municipio)}" },`
    )
    .join("\n");

  const content = `// ============================================================================
// lib/ies-data.ts — AUTO-GERADO
// ----------------------------------------------------------------------------
// Gerado por scripts/generate-ies-data.mjs a partir do Microdados do Censo da
// Educação Superior ${CENSUS_YEAR} (INEP). NÃO EDITAR À MÃO — pra atualizar,
// rode \`node scripts/generate-ies-data.mjs\`.
//
// Uma entrada por UNIDADE/CAMPUS (instituição + município de oferta
// presencial), pra a pessoa poder selecionar exatamente a unidade dela.
// Total de entradas: ${ies.length}
// ============================================================================

export type IES = {
  sigla: string;
  nome: string;
  uf: string;
  municipio: string;
};

export const IES_LIST: IES[] = [
${entries}
];

// Normaliza string pra busca tolerante a acentos/caixa.
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Stopwords PT — preposições/artigos sem valor de busca. Removê-las é crucial:
// senão "do" em "rio grande do norte" casa com a sigla "DOCTUM" (startsWith
// "do"), ganha score alto e enterra as instituições do RN nos resultados.
const STOPWORDS = new Set(["da", "de", "do", "das", "dos", "e"]);

// Municípios da Grande Natal (região metropolitana), normalizados. Natal e
// Parnamirim ficam fora — recebem tier ainda mais alto.
const GRANDE_NATAL = new Set([
  "sao goncalo do amarante",
  "macaiba",
  "extremoz",
  "ceara-mirim",
  "monte alegre",
  "nisia floresta",
  "sao jose de mipibu",
  "vera cruz",
  "maxaranguape",
  "ielmo marinho",
  "ares",
  "goianinha",
  "bom jesus",
]);

// Bônus de proximidade. Dois critérios, nesta ordem de prioridade:
//   1º (sede do evento): Natal/Parnamirim e Grande Natal.
//   2º (cidade do próprio integrante): a cidade/UF declarada no form.
// Tiers (não-aditivos — o maior aplicável vence):
//   • Natal / Parnamirim          → +80
//   • Grande Natal                → +50
//   • Cidade declarada pelo user  → +45
//   • Resto do RN                 → +25
//   • Estado declarado (fora RN)  → +20
//   • Outros                      → 0
// \`municipioNorm\` e \`userCidadeNorm\` já vêm normalizados pelo chamador.
function proximidadeBonus(
  municipioNorm: string,
  uf: string,
  userCidadeNorm: string,
  userUf: string
): number {
  const ufUp = uf.toUpperCase();
  if (ufUp === "RN") {
    if (municipioNorm === "natal" || municipioNorm === "parnamirim") return 80;
    if (GRANDE_NATAL.has(municipioNorm)) return 50;
  }
  if (
    userCidadeNorm &&
    municipioNorm === userCidadeNorm &&
    userUf &&
    ufUp === userUf.toUpperCase()
  ) {
    return 45;
  }
  if (ufUp === "RN") return 25;
  if (userUf && ufUp === userUf.toUpperCase()) return 20;
  return 0;
}

// Busca tokenizada: query separada por espaço; cada token testado contra
// sigla, nome e município. Sigla é discriminador forte (score alto). Nome
// pontua proporcional aos tokens que casam (full > parcial). Município
// como reforço. O bônus de proximidade (ver proximidadeBonus) prioriza
// Natal/Parnamirim, Grande Natal e depois a cidade declarada pelo user.
export function searchIES(
  query: string,
  limit = 8,
  userLoc?: { cidade: string; uf: string }
): IES[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const tokens = q.split(/\\s+/).filter((t) => t.length >= 1 && !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  const total = tokens.length;

  const userCidadeNorm = userLoc ? normalize(userLoc.cidade.trim()) : "";
  const userUf = userLoc ? userLoc.uf.trim() : "";

  const matches: { ies: IES; score: number }[] = [];
  for (const ies of IES_LIST) {
    const sigla = normalize(ies.sigla);
    const nome = normalize(ies.nome);
    const municipio = normalize(ies.municipio);

    let siglaScore = 0;
    for (const t of tokens) {
      if (sigla === t) siglaScore = Math.max(siglaScore, 200);
      else if (sigla.startsWith(t)) siglaScore = Math.max(siglaScore, 150);
      else if (sigla.includes(t)) siglaScore = Math.max(siglaScore, 100);
    }

    let nomeMatched = 0;
    let municipioMatched = 0;
    for (const t of tokens) {
      if (nome.includes(t)) nomeMatched++;
      if (municipio.includes(t)) municipioMatched++;
    }

    let score = siglaScore;
    if (nomeMatched === total) {
      score += 80;
      if (nome.startsWith(tokens[0]!)) score += 20;
    } else if (nomeMatched > 0) {
      score += Math.round(40 * (nomeMatched / total));
    }

    if (municipioMatched === total) {
      score += score > 0 ? 15 : 30;
    } else if (municipioMatched > 0 && score > 0) {
      score += 8;
    }

    if (score === 0) continue;
    score += proximidadeBonus(municipio, ies.uf, userCidadeNorm, userUf);
    matches.push({ ies, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit).map((m) => m.ies);
}
`;
  writeFileSync(outPath, content, "utf8");
  const sizeKB = (statSync(outPath).size / 1024).toFixed(1);
  log(`✓ ${outPath} gerado (${sizeKB} KB)`);
}

async function main() {
  log(`\n=== gerando ${OUTPUT} a partir do Censo da Educação Superior ${CENSUS_YEAR} ===\n`);
  ensureCleanDir(TEMP_DIR);
  try {
    await download(ZIP_URL, ZIP_PATH);
    extract(ZIP_PATH, TEMP_DIR);
    const iesByCode = parseIES(findIesCSV(TEMP_DIR));
    const campusSet = await parseCursosPresencial(findCursosCSV(TEMP_DIR));
    const entries = buildEntries(iesByCode, campusSet);
    writeTSFile(entries, OUTPUT);
    log(`\n✓ Pronto. Revisa o diff e commita.`);
  } finally {
    rmSync(TEMP_DIR, { recursive: true, force: true });
    log(`✓ cleanup de ${TEMP_DIR}`);
  }
}

main().catch((err) => {
  process.stderr.write(`\n✗ falhou: ${err.message}\n\n`);
  process.exit(1);
});
