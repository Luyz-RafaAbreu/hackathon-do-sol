import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "public", "imagens");

const jobs = [
  // Logo — 400x400 é suficiente pro uso no header/footer/favicon
  { input: "AVATAR2.png", output: "logo.webp", width: 400, format: "webp", quality: 85 },
  { input: "AVATAR2.png", output: "logo.png", width: 400, format: "png", quality: 90 },
  // Banner vertical (stories) — ótimo até 1080 de largura
  { input: "STORY2.png", output: "story.webp", width: 1080, format: "webp", quality: 78 },
  // Open Graph — 1200x630 é o padrão social; mesmo o MOSAICO bugado serve pra preview
  { input: "MOSAICO2.png", output: "og.jpg", width: 1200, height: 630, fit: "cover", format: "jpeg", quality: 82 },
];

function prettySize(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

console.log("Otimizando imagens em:", dir);
for (const j of jobs) {
  const inputPath = join(dir, j.input);
  const outputPath = join(dir, j.output);
  const inBytes = statSync(inputPath).size;
  let pipeline = sharp(inputPath);
  if (j.width || j.height) {
    pipeline = pipeline.resize({
      width: j.width,
      height: j.height,
      fit: j.fit || "inside",
      withoutEnlargement: true,
    });
  }
  if (j.format === "webp") pipeline = pipeline.webp({ quality: j.quality });
  else if (j.format === "jpeg") pipeline = pipeline.jpeg({ quality: j.quality, mozjpeg: true });
  else if (j.format === "png") pipeline = pipeline.png({ quality: j.quality, compressionLevel: 9 });
  await pipeline.toFile(outputPath);
  const outBytes = statSync(outputPath).size;
  const pct = ((1 - outBytes / inBytes) * 100).toFixed(0);
  console.log(`  ${j.input} (${prettySize(inBytes)}) -> ${j.output} (${prettySize(outBytes)})  -${pct}%`);
}

console.log("\nArquivos finais:");
for (const f of readdirSync(dir).sort()) {
  const s = statSync(join(dir, f));
  if (s.isFile()) console.log(`  ${f.padEnd(30)} ${prettySize(s.size).padStart(10)}`);
}
