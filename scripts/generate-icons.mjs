// Gera ícones do app a partir de public/imagens/logo-hd.webp:
//   - app/icon.png         512x512  (Android, navegador moderno, PWA)
//   - app/apple-icon.png   180x180  (iOS home screen)
//   - app/favicon.ico      32x32    (aba do navegador)
//
// TODOS os ícones usam SÓ o sol recortado em fundo sol-bg (#1a0b3d) — em
// tamanhos pequenos (atalhos de desktop, Start Menu, taskbar), o logo
// completo com texto fica ilegível e parece bagunçado. O sol limpo num
// fundo da marca escala bem em qualquer tamanho.
//
// O retângulo do sol no logo-hd.webp é estimado abaixo — ajuste SUN_* se
// sair errado. Rode `node scripts/generate-icons.mjs --preview` antes pra
// ver o crop sem regerar tudo.

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const SRC = join(root, "public", "imagens", "logo-hd.webp");
const OUT_APP = join(root, "app");

// Crop do sol no logo-hd.webp (1200x1200). Centro estimado (600, 640), raio ~140.
const SUN_LEFT = 460;
const SUN_TOP = 500;
const SUN_SIZE = 280;

// Cor de fundo dos ícones — sol.bg do tailwind.config.ts (#1a0b3d).
const BG = { r: 26, g: 11, b: 61, alpha: 1 };

// % do canvas que o sol ocupa. 70% deixa um respiro elegante e dá margem
// segura caso o OS aplique máscara circular/squircle por cima.
const SUN_FILL_RATIO = 0.7;

// Modo "preview": gera só o sol em 256x256 num temp pra inspeção visual.
const previewOnly = process.argv.includes("--preview");

async function main() {
  if (!existsSync(SRC)) {
    console.error("Não achei", SRC);
    process.exit(1);
  }

  const meta = await sharp(SRC).metadata();
  console.log(`Logo fonte: ${meta.width}x${meta.height}`);

  if (previewOnly) {
    const out = join(root, "tmp-sun-preview.png");
    await sharp(SRC)
      .extract({ left: SUN_LEFT, top: SUN_TOP, width: SUN_SIZE, height: SUN_SIZE })
      .resize(256, 256)
      .png()
      .toFile(out);
    console.log("Preview salvo em", out);
    return;
  }

  if (!existsSync(OUT_APP)) mkdirSync(OUT_APP, { recursive: true });

  // Crop bruto do sol (PNG transparente, pra recompor sobre cor de fundo)
  const sunBuf = await sharp(SRC)
    .extract({ left: SUN_LEFT, top: SUN_TOP, width: SUN_SIZE, height: SUN_SIZE })
    .png()
    .toBuffer();

  // Compõe ícone em qualquer tamanho: canvas N×N com fundo roxo + sol
  // centralizado ocupando SUN_FILL_RATIO do lado.
  async function composeIcon(size) {
    const sunSize = Math.round(size * SUN_FILL_RATIO);
    const sunResized = await sharp(sunBuf)
      .resize(sunSize, sunSize)
      .png()
      .toBuffer();
    return sharp({
      create: { width: size, height: size, channels: 4, background: BG },
    })
      .composite([{ input: sunResized, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  // app/icon.png — 512x512 do sol em fundo da marca (PWA / Android)
  writeFileSync(join(OUT_APP, "icon.png"), await composeIcon(512));
  console.log("  ✓ app/icon.png (512x512, sol em fundo roxo)");

  // app/apple-icon.png — 180x180 do sol em fundo da marca (iOS)
  writeFileSync(join(OUT_APP, "apple-icon.png"), await composeIcon(180));
  console.log("  ✓ app/apple-icon.png (180x180, sol em fundo roxo)");

  // app/favicon.ico — 32x32 do sol cropado direto (sem fundo extra, pra
  // não quebrar contraste em backgrounds claros que alguns navegadores usam)
  const sunPng32 = await sharp(SRC)
    .extract({ left: SUN_LEFT, top: SUN_TOP, width: SUN_SIZE, height: SUN_SIZE })
    .resize(32, 32)
    .png({ compressionLevel: 9 })
    .toBuffer();
  const ico = buildIco([{ size: 32, png: sunPng32 }]);
  writeFileSync(join(OUT_APP, "favicon.ico"), ico);
  console.log("  ✓ app/favicon.ico (32x32, sol recortado)");
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
