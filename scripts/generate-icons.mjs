// Gera ícones do app a partir de public/imagens/logo-hd.webp:
//   - app/icon.png         512x512  REDONDO (Android, navegador, PWA, atalho de desktop)
//   - app/apple-icon.png   180x180  quadrado (iOS — o próprio iOS arredonda)
//   - app/favicon.ico      32x32    REDONDO (aba do navegador)
//
// Todos mostram SÓ o sol (o swirl que fica dentro do "O" de SOL) sobre um
// círculo roxo da marca — o logo completo com texto fica ilegível em
// tamanhos pequenos (atalho de desktop, taskbar, aba).
//
// icon.png e favicon.ico são recortados EM CÍRCULO (cantos transparentes) —
// é o que dá o visual "redondinho" no atalho de desktop e na aba. O
// apple-icon fica QUADRADO de propósito: o iOS preenche transparência com
// preto e aplica a própria máscara arredondada, então um PNG circular lá
// ganharia cantos pretos.
//
// Rode `node scripts/generate-icons.mjs --preview` antes pra inspecionar o
// ícone final em tmp-sun-preview.png.

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SRC = join(root, "public", "imagens", "logo-hd.webp");
const OUT_APP = join(root, "app");

// Crop do sol no logo-hd.webp (1200x1200). O centro do swirl fica em
// ~(625, 655); 300x300 captura o sol completo com uma borda fininha de
// laranja, sem deixar as letras S/L nem o roxo do fundo entrarem no recorte.
// (Valores conferidos por análise de pixels — ver histórico do commit.)
const SUN_LEFT = 475;
const SUN_TOP = 505;
const SUN_SIZE = 300;

// Cor de fundo dos ícones — sol.bg do tailwind.config.ts (#1a0b3d).
const BG = { r: 26, g: 11, b: 61, alpha: 1 };

// Diâmetro do disco do sol como % do lado do ícone. 0.85 deixa um anel
// roxo fino emoldurando o sol — sol bem visível, borda da marca presente.
const SUN_FILL_RATIO = 0.85;

// Modo "preview": gera o ícone final em 256x256 num temp pra inspeção.
const previewOnly = process.argv.includes("--preview");

// SVG de um círculo branco — usado como máscara `dest-in` (mantém o que está
// dentro do círculo, zera o resto deixando transparente).
function circleMask(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
  );
}

async function main() {
  if (!existsSync(SRC)) {
    console.error("Não achei", SRC);
    process.exit(1);
  }

  const meta = await sharp(SRC).metadata();
  console.log(`Logo fonte: ${meta.width}x${meta.height}`);

  // Crop bruto do sol (PNG) — base pra todos os ícones.
  const sunBuf = await sharp(SRC)
    .extract({ left: SUN_LEFT, top: SUN_TOP, width: SUN_SIZE, height: SUN_SIZE })
    .png()
    .toBuffer();

  // Sol recortado em círculo, no diâmetro pedido (cantos transparentes).
  async function roundSun(diameter) {
    const resized = await sharp(sunBuf)
      .resize(diameter, diameter)
      .png()
      .toBuffer();
    return sharp(resized)
      .composite([{ input: circleMask(diameter), blend: "dest-in" }])
      .png()
      .toBuffer();
  }

  // Ícone redondo: círculo roxo + sol centralizado, cantos transparentes.
  async function roundIcon(size) {
    const sun = await roundSun(Math.round(size * SUN_FILL_RATIO));
    const composed = await sharp({
      create: { width: size, height: size, channels: 4, background: BG },
    })
      .composite([{ input: sun, gravity: "center" }])
      .png()
      .toBuffer();
    return sharp(composed)
      .composite([{ input: circleMask(size), blend: "dest-in" }])
      // palette: quantiza pra paleta — ícone de cor chapada comprime muito
      // melhor assim (sem perda visível), ~78KB em vez de ~174KB.
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  }

  // Ícone quadrado: quadrado roxo cheio + sol redondo centralizado. Pro
  // iOS, que arredonda sozinho e não lida bem com transparência.
  async function squareIcon(size) {
    const sun = await roundSun(Math.round(size * SUN_FILL_RATIO));
    return sharp({
      create: { width: size, height: size, channels: 4, background: BG },
    })
      .composite([{ input: sun, gravity: "center" }])
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  }

  if (previewOnly) {
    const out = join(root, "tmp-sun-preview.png");
    await sharp(await roundIcon(512)).resize(256, 256).toFile(out);
    console.log("Preview salvo em", out);
    return;
  }

  if (!existsSync(OUT_APP)) mkdirSync(OUT_APP, { recursive: true });

  // app/icon.png — 512x512 redondo (PWA / Android / atalho de desktop)
  writeFileSync(join(OUT_APP, "icon.png"), await roundIcon(512));
  console.log("  ✓ app/icon.png (512x512, redondo)");

  // app/apple-icon.png — 180x180 quadrado (iOS arredonda por conta própria)
  writeFileSync(join(OUT_APP, "apple-icon.png"), await squareIcon(180));
  console.log("  ✓ app/apple-icon.png (180x180, quadrado pro iOS)");

  // app/favicon.ico — 32x32 redondo (aba do navegador)
  const favPng = await roundIcon(32);
  const ico = buildIco([{ size: 32, png: favPng }]);
  writeFileSync(join(OUT_APP, "favicon.ico"), ico);
  console.log("  ✓ app/favicon.ico (32x32, redondo)");
}

// Encoder ICO mínimo: header (6 bytes) + N entradas (16 bytes cada) + payloads PNG concatenados.
// Específico do uso: PNGs embedded (suportado desde Vista; cobre 100% do que importa hoje).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // type=1 (icon)
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const e = Buffer.alloc(16);
    // PNG até 256: byte 0 quando size=256; sharp não suporta 256x256 .ico aqui, então 0 só se size===256.
    e.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width
    e.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height
    e.writeUInt8(0, 2); // 0 cores na paleta (PNG)
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.png.length, 8); // tamanho do PNG
    e.writeUInt32LE(offset, 12); // offset
    entries.push(e);
    offset += img.png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
