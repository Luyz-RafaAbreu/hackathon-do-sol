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
//   1. Baixa o ZIP de microdados do INEP (~500MB — é o único formato oficial
//      disponível; o cadastro IES vem dentro)
//   2. Extrai usando `tar -xf` (nativo no Windows 10+/macOS/Linux)
//   3. Acha o CSV de cadastro IES no diretório extraído
//   4. Parseia (encoding ISO-8859-1, separador "|") e mapeia pra
//      { sigla, nome, uf, municipio }
//   5. Dedupa por (sigla+nome) — IES com vários campi vira 1 entrada
//   6. Escreve lib/ies-data.ts com header indicando auto-geração
//   7. Limpa os arquivos temporários
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

function parseCSV(csvPath) {
  log(`▼ parseando CSV`);
  const raw = readFileSync(csvPath);
  // INEP usa ISO-8859-1 (Latin-1). TextDecoder converte pra UTF-8.
  const text = new TextDecoder("latin1").decode(raw);
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV vazio ou sem header");

  // Separador é ";" (confirmado no Censo 2024). Anos antigos usavam "|".
  const sep = lines[0].includes(";") ? ";" : "|";
  const header = lines[0].split(sep);
  const idx = {
    sigla: header.indexOf("SG_IES"),
    nome: header.indexOf("NO_IES"),
    uf: header.indexOf("SG_UF_IES"),
    municipio: header.indexOf("NO_MUNICIPIO_IES"),
  };
  const missing = Object.entries(idx).filter(([, i]) => i < 0);
  if (missing.length > 0) {
    throw new Error(
      `Colunas faltando no CSV: ${missing.map((m) => m[0]).join(", ")}\n  ` +
        `Header encontrado: ${header.slice(0, 20).join(" | ")}...`
    );
  }

  const ies = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(sep);
    const sigla = (cols[idx.sigla] || "").trim();
    const nome = (cols[idx.nome] || "").trim();
    const uf = (cols[idx.uf] || "").trim();
    const municipio = (cols[idx.municipio] || "").trim();
    if (!nome) continue; // linha sem dados
    ies.push({ sigla, nome, uf, municipio });
  }
  log(`✓ ${ies.length} linhas brutas`);
  return ies;
}

function dedupe(ies) {
  // Censo lista linhas por unidade de oferta — uma IES grande pode aparecer N
  // vezes com a mesma sigla+nome. Mantém a primeira ocorrência (geralmente a
  // sede administrativa).
  const seen = new Set();
  const out = [];
  for (const i of ies) {
    if (!i.nome) continue;
    const key = `${i.sigla}|${i.nome}|${i.uf}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(i);
  }
  out.sort((a, b) => {
    // Ordena: sigla primeiro (alfabético), depois nome — torna o arquivo
    // gerado fácil de inspecionar/diff.
    if (a.sigla && !b.sigla) return -1;
    if (!a.sigla && b.sigla) return 1;
    const s = (a.sigla || "").localeCompare(b.sigla || "", "pt-BR");
    return s !== 0 ? s : a.nome.localeCompare(b.nome, "pt-BR");
  });
  log(`✓ ${out.length} entradas após dedupe + sort`);
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
// Total de IES: ${ies.length}
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

// Busca tokenizada: query separada por espaço; cada token testado contra
// sigla, nome e município. Sigla é discriminador forte (score alto). Nome
// pontua proporcional aos tokens que casam (full > parcial). Município
// como reforço. Bônus aditivo +50 pra IES em RN — destaca instituições
// locais sem inverter matches exatos de outros estados.
export function searchIES(query: string, limit = 8): IES[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const tokens = q.split(/\\s+/).filter((t) => t.length >= 1);
  if (tokens.length === 0) return [];
  const total = tokens.length;

  const matches: { ies: IES; score: number }[] = [];
  for (const ies of IES_LIST) {
    const sigla = normalize(ies.sigla);
    const nome = normalize(ies.nome);
    const municipio = normalize(ies.municipio);
    const isRN = ies.uf.toUpperCase() === "RN";

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
    if (isRN) score += 50;
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
    const csv = findIesCSV(TEMP_DIR);
    let ies = parseCSV(csv);
    ies = dedupe(ies);
    writeTSFile(ies, OUTPUT);
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
