import { NextResponse } from "next/server";

/**
 * POST /api/inscricao
 *
 * Recebe o FormData do formulário (incluindo arquivos), valida, converte os
 * arquivos em base64 e repassa para o Google Apps Script Web App configurado
 * via env. Do lado de lá, os dados vão parar em uma planilha do Google Sheets
 * e os arquivos em uma pasta do Drive.
 *
 * Env obrigatórias (definir em .env.local):
 *   APPS_SCRIPT_WEBHOOK_URL     — URL do Web App do Apps Script
 *   APPS_SCRIPT_WEBHOOK_SECRET  — token secreto igual ao do Apps Script
 */

const WEBHOOK_URL = process.env.APPS_SCRIPT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.APPS_SCRIPT_WEBHOOK_SECRET;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 3;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const REQUIRED_FIELDS = [
  "nome",
  "email",
  "telefone",
  "cidadeEstado",
  "instituicao",
  "area",
  "experiencia",
  "motivacao",
] as const;

type Field = (typeof REQUIRED_FIELDS)[number];

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    return bad(
      "O sistema de inscrições ainda não foi configurado. Entre em contato com a organização.",
      500
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Formato inválido.");
  }

  // Honeypot anti-bot — campo oculto no form. Bots preenchem, humanos não.
  if (form.get("website")) {
    // Responde "ok" silenciosamente pra não dar dica ao bot
    return NextResponse.json({ ok: true });
  }

  // Coleta e valida campos de texto
  const data: Record<string, string> = {};
  for (const field of REQUIRED_FIELDS) {
    const raw = form.get(field);
    if (typeof raw !== "string" || !raw.trim()) {
      return bad(`Campo obrigatório ausente: ${field}`);
    }
    data[field] = raw.trim();
  }

  // Validações específicas
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return bad("E-mail inválido.");
  }
  if (data.telefone.replace(/\D/g, "").length < 10) {
    return bad("Telefone inválido.");
  }
  if (data.motivacao.length < 20) {
    return bad("Motivação muito curta (mínimo 20 caracteres).");
  }
  if (data.nome.length < 3) {
    return bad("Nome inválido.");
  }

  // Arquivos
  const rawFiles = form.getAll("comprovantes");
  const files = rawFiles.filter(
    (f): f is File => f instanceof File && f.size > 0
  );

  if (files.length === 0) {
    return bad("Anexe ao menos um comprovante de atuação.");
  }
  if (files.length > MAX_FILES) {
    return bad(`Máximo ${MAX_FILES} arquivos.`);
  }

  const comprovantes: { name: string; type: string; data: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return bad(`O arquivo "${file.name}" excede o limite de 5 MB.`);
    }
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      return bad(`Tipo de arquivo não aceito: ${file.name}`);
    }
    const buf = await file.arrayBuffer();
    comprovantes.push({
      name: file.name,
      type: file.type || "application/octet-stream",
      data: Buffer.from(buf).toString("base64"),
    });
  }

  // Repassa para o Apps Script
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: WEBHOOK_SECRET,
        ...data,
        comprovantes,
      }),
      // Apps Script pode levar alguns segundos
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[inscricao] Apps Script falhou:", res.status, text);
      return bad(
        "Não foi possível registrar sua inscrição no momento. Tente novamente em instantes.",
        502
      );
    }

    const result = (await res.json().catch(() => null)) as
      | { ok: boolean; error?: string }
      | null;
    if (!result?.ok) {
      console.error("[inscricao] Apps Script retornou erro:", result?.error);
      return bad(
        "Sua inscrição não pôde ser registrada. Tente novamente.",
        502
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Inscrição recebida! A organização vai analisar e você receberá um e-mail com o resultado.",
    });
  } catch (err) {
    console.error("[inscricao] erro na chamada ao Apps Script:", err);
    return bad(
      "Falha ao enviar sua inscrição. Verifique sua conexão e tente novamente.",
      500
    );
  }
}
