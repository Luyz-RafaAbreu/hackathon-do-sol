#!/usr/bin/env node
// ============================================================================
// scripts/generate-escolas-data.mjs
// ----------------------------------------------------------------------------
// Regenera lib/escolas-data.ts a partir do MICRODADOS DO CENSO ESCOLAR (INEP)
// — escolas de ensino médio (regular + EJA), em atividade, lecionando em
// prédio escolar (exclui socioeducativo e unidade prisional).
//
// USO:
//   npm run generate-escolas
//
// O que o script faz:
//   1. Baixa o ZIP do Censo Escolar (~30-70MB) via curl
//   2. Extrai usando PowerShell (Windows) ou unzip (macOS/Linux)
//   3. Acha o microdados_ed_basica_*.csv no diretório extraído
//   4. STREAM-parseia o CSV (~200MB, 215k linhas) filtrando:
//      • TP_SITUACAO_FUNCIONAMENTO === "1"  (em atividade)
//      • IN_MED === "1" OR IN_EJA_MED === "1"  (oferece ensino médio)
//      • Exclui escolas em unidade prisional ou socioeducativa
//   5. Dedupe por (nome+uf+municipio) — mesmo nome em cidades distintas
//      sobrevive
//   6. Sort por nome (pt-BR) — diff estável entre rodadas
//   7. Escreve lib/escolas-data.ts (~3-4MB de TS, lazy-loaded pelo wizard)
//   8. Limpa os arquivos temporários
//
// QUANDO RODAR:
//   • Anualmente, quando o INEP publicar novo Censo Escolar (~maio)
//   • Se identificar escola faltando
//
// REQUISITOS:
//   • Node 18+
//   • curl no PATH (Windows 10 1803+/macOS/Linux já tem)
//   • PowerShell (Windows) ou unzip (Mac/Linux)
//   • ~500MB de espaço temporário em disco
// ============================================================================

import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { cwd } from "node:process";

const CENSUS_YEAR = 2024;
const ZIP_URL = `https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_${CENSUS_YEAR}.zip`;
const TEMP_DIR = "tmp-escolas-download";
const ZIP_PATH = join(TEMP_DIR, "microdados.zip");
const OUTPUT = "lib/escolas-data.ts";

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function ensureCleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function download(url, outPath) {
  log(`▼ baixando ${url}`);
  const r = spawnSync(
    "curl",
    ["-fL", "-A", "Mozilla/5.0 (hackathon-sol-script)", "-o", outPath, url],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  if (r.error) throw new Error(`curl falhou: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`curl saiu com status ${r.status}`);
  const sizeMB = (statSync(outPath).size / 1024 / 1024).toFixed(1);
  log(`✓ download completo (${sizeMB} MB)`);
}

function extract(zipPath, destDir) {
  log(`▼ extraindo ZIP`);
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
  if (r.error) throw new Error(`Falha no extrator: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`Extrator saiu com status ${r.status}`);
  log(`✓ extração completa`);
}

function findEscolasCSV(dir) {
  // Padrão observado: microdados_ed_basica_<ano>.csv
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
      else if (/microdados_ed_basica_\d{4}\.csv$/i.test(name)) {
        candidates.push(p);
      }
    }
  }
  walk(dir);
  if (candidates.length === 0) {
    throw new Error(
      `CSV de microdados_ed_basica não encontrado em ${dir}.\n  ` +
        `O INEP pode ter mudado o nome — procure manualmente um *_ed_basica*.csv`
    );
  }
  log(`✓ CSV localizado: ${relative(cwd(), candidates[0])}`);
  return candidates[0];
}

// Stream-parseia o CSV linha a linha. Carregar 200MB de uma vez OOM em
// máquinas com pouca RAM. Latin-1 é single-byte, então TextDecoder não corre
// risco de partir caractere ao meio do chunk.
async function streamFilterCSV(csvPath) {
  log(`▼ parseando + filtrando (streaming)`);
  const decoder = new TextDecoder("latin1");
  const stream = createReadStream(csvPath);

  let buffer = "";
  let header = null;
  /** @type {Record<string,number>} */
  let idx = {};
  const out = [];
  let totalLines = 0;

  function processLine(line) {
    if (!line) return;
    if (header === null) {
      header = line.split(";");
      idx = {
        nome: header.indexOf("NO_ENTIDADE"),
        uf: header.indexOf("SG_UF"),
        municipio: header.indexOf("NO_MUNICIPIO"),
        situacao: header.indexOf("TP_SITUACAO_FUNCIONAMENTO"),
        inMed: header.indexOf("IN_MED"),
        inEjaMed: header.indexOf("IN_EJA_MED"),
        inSocio: header.indexOf("IN_LOCAL_FUNC_SOCIOEDUCATIVO"),
        inPrisional: header.indexOf("IN_LOCAL_FUNC_UNID_PRISIONAL"),
      };
      const missing = Object.entries(idx).filter(([, i]) => i < 0);
      if (missing.length > 0) {
        throw new Error(
          `Colunas faltando no CSV: ${missing.map((m) => m[0]).join(", ")}`
        );
      }
      return;
    }
    totalLines++;
    const cols = line.split(";");
    // 1) Em atividade
    if (cols[idx.situacao] !== "1") return;
    // 2) Oferece ensino médio (regular ou EJA)
    if (cols[idx.inMed] !== "1" && cols[idx.inEjaMed] !== "1") return;
    // 3) Não em prisão/socioeducativo
    if (cols[idx.inSocio] === "1" || cols[idx.inPrisional] === "1") return;
    const nome = (cols[idx.nome] || "").trim();
    if (!nome) return;
    out.push({
      nome,
      uf: (cols[idx.uf] || "").trim(),
      municipio: (cols[idx.municipio] || "").trim(),
    });
  }

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      processLine(line);
    }
  }
  // Última linha sem \n no fim
  buffer += decoder.decode();
  if (buffer.trim()) processLine(buffer);

  log(`✓ ${totalLines} linhas totais lidas, ${out.length} passaram nos filtros`);
  return out;
}

function dedupe(escolas) {
  const seen = new Set();
  const out = [];
  for (const e of escolas) {
    if (!e.nome) continue;
    const key = `${e.nome}|${e.uf}|${e.municipio}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  out.sort((a, b) => {
    const n = a.nome.localeCompare(b.nome, "pt-BR");
    if (n !== 0) return n;
    return (a.municipio + a.uf).localeCompare(b.municipio + b.uf, "pt-BR");
  });
  log(`✓ ${out.length} entradas após dedupe`);
  return out;
}

function writeTSFile(escolas, outPath) {
  log(`▼ gerando ${outPath}`);
  const safe = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const entries = escolas
    .map(
      (e) =>
        `  { nome: "${safe(e.nome)}", uf: "${safe(e.uf)}", municipio: "${safe(e.municipio)}" },`
    )
    .join("\n");

  // Esse arquivo é grande (~3-4MB). Por isso o componente carrega via
  // dynamic import (`await import("@/lib/escolas-data")`) só quando o
  // usuário escolhe "Ensino Médio" no nível de formação.
  const content = `// ============================================================================
// lib/escolas-data.ts — AUTO-GERADO
// ----------------------------------------------------------------------------
// Gerado por scripts/generate-escolas-data.mjs a partir do Censo Escolar
// ${CENSUS_YEAR} (INEP). NÃO EDITAR À MÃO — pra atualizar, rode
// \`npm run generate-escolas\`.
//
// Filtro aplicado:
//   • Em atividade (TP_SITUACAO_FUNCIONAMENTO === "1")
//   • Oferece ensino médio (IN_MED === "1" OU IN_EJA_MED === "1")
//   • Excluídas: unidade prisional / socioeducativa
//
// Total de escolas: ${escolas.length}
//
// Tamanho do arquivo (~3-4MB) faz com que ele seja LAZY-LOADED pelo wizard
// de inscrição — só baixa quando o usuário escolhe "Ensino Médio" no
// dropdown de nível de formação. Ver components/Inscricao.tsx.
// ============================================================================

export type Escola = {
  nome: string;
  uf: string;
  municipio: string;
};

export const ESCOLAS_LIST: readonly Escola[] = [
${entries}
];

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Busca por nome/município. Tokeniza a query por espaço pra que termos
// fora de ordem ainda encontrem ("atheneu central" ↔ "Centro Educacional
// Atheneu"). Score parcial proporcional ao número de tokens que casam.
// Bônus aditivo +40 pra escolas em RN — favorece resultados locais sem
// inverter matches exatos de outros estados.
export function searchEscolas(query: string, limit = 8): Escola[] {
  const q = normalize(query.trim());
  if (q.length < 2) return [];
  const tokens = q.split(/\\s+/).filter((t) => t.length >= 1);
  if (tokens.length === 0) return [];
  const total = tokens.length;

  const matches: { e: Escola; score: number }[] = [];
  for (const e of ESCOLAS_LIST) {
    const nome = normalize(e.nome);
    const municipio = normalize(e.municipio);
    const isRN = e.uf.toUpperCase() === "RN";

    let nomeMatched = 0;
    let municipioMatched = 0;
    for (const t of tokens) {
      if (nome.includes(t)) nomeMatched++;
      if (municipio.includes(t)) municipioMatched++;
    }

    let score = 0;
    if (nomeMatched === total) {
      score = 100;
      if (nome.startsWith(tokens[0]!)) score += 20;
    } else if (nomeMatched > 0) {
      score = Math.round(50 * (nomeMatched / total));
    }

    if (municipioMatched === total) {
      score += score > 0 ? 10 : 25;
    } else if (municipioMatched > 0 && score > 0) {
      score += 5;
    }

    if (score === 0) continue;
    if (isRN) score += 40;
    matches.push({ e, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit).map((m) => m.e);
}
`;
  writeFileSync(outPath, content, "utf8");
  const sizeMB = (statSync(outPath).size / 1024 / 1024).toFixed(2);
  log(`✓ ${outPath} gerado (${sizeMB} MB)`);
}

async function main() {
  log(`\n=== gerando ${OUTPUT} a partir do Censo Escolar ${CENSUS_YEAR} ===\n`);
  ensureCleanDir(TEMP_DIR);
  try {
    download(ZIP_URL, ZIP_PATH);
    extract(ZIP_PATH, TEMP_DIR);
    const csv = findEscolasCSV(TEMP_DIR);
    let escolas = await streamFilterCSV(csv);
    escolas = dedupe(escolas);
    writeTSFile(escolas, OUTPUT);
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
