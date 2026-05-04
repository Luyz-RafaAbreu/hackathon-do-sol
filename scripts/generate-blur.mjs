// Gera blurDataURL (mini-thumbnail base64) pra cada imagem em public/imagens.
// Roda manualmente quando trocar/adicionar imagens:
//   node scripts/generate-blur.mjs

import sharp from "sharp";
import { readdir, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";

const SRC = "public/imagens";
const OUT = "lib/blur-data.ts";

const files = await readdir(SRC);
const entries = {};
for (const f of files) {
  if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
  const buf = await sharp(join(SRC, f))
    .resize(10, 10, { fit: "inside" })
    .jpeg({ quality: 50 })
    .toBuffer();
  const key = parse(f).name;
  entries[key] = `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const sorted = Object.keys(entries)
  .sort()
  .reduce((acc, k) => ((acc[k] = entries[k]), acc), {});

const content = `// Auto-gerado por scripts/generate-blur.mjs — NÃO edite manualmente.
// Para regenerar (ex: depois de trocar uma imagem):
//   node scripts/generate-blur.mjs

export const BLUR: Record<string, string> = ${JSON.stringify(sorted, null, 2)};
`;

await writeFile(OUT, content);
console.log(
  `✓ Gerado ${OUT} com ${Object.keys(sorted).length} imagens: ${Object.keys(sorted).join(", ")}`
);
