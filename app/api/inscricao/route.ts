import { NextResponse } from "next/server";

type Inscricao = {
  nome: string;
  email: string;
  telefone: string;
  cidadeEstado: string;
  instituicao: string;
  area: string;
  experiencia: string;
  motivacao: string;
};

function validar(data: Partial<Inscricao>) {
  const req: (keyof Inscricao)[] = [
    "nome",
    "email",
    "telefone",
    "cidadeEstado",
    "instituicao",
    "area",
    "experiencia",
    "motivacao",
  ];
  for (const k of req) {
    if (!data[k] || String(data[k]).trim() === "") {
      return `Campo obrigatório ausente: ${k}`;
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email!)) return "E-mail inválido.";
  return null;
}

export async function POST(req: Request) {
  try {
    const data = (await req.json()) as Partial<Inscricao>;
    const erro = validar(data);
    if (erro) {
      return NextResponse.json({ ok: false, message: erro }, { status: 400 });
    }

    // TODO: conectar aqui com banco de dados, Google Sheets, e-mail ou CRM.
    // Exemplos:
    //   - await db.inscricao.create({ data })
    //   - await sendEmail({ to: data.email, template: "confirmacao" })
    //   - await fetch(process.env.SHEETS_WEBHOOK!, { method: "POST", body: JSON.stringify(data) })
    console.log("[Inscrição recebida]", data);

    return NextResponse.json({
      ok: true,
      message:
        "Inscrição recebida com sucesso! Em breve você receberá um e-mail de confirmação.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: "Erro ao processar inscrição." },
      { status: 500 }
    );
  }
}
