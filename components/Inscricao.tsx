"use client";
import { FormEvent, useState } from "react";
import Reveal from "./Reveal";

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  cidadeEstado: string;
  instituicao: string;
  area: string;
  experiencia: string;
  motivacao: string;
};

const initial: FormState = {
  nome: "",
  email: "",
  telefone: "",
  cidadeEstado: "",
  instituicao: "",
  area: "",
  experiencia: "",
  motivacao: "",
};

export default function Inscricao() {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.nome.trim().length < 3) e.nome = "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "E-mail inválido.";
    if (form.telefone.replace(/\D/g, "").length < 10)
      e.telefone = "Telefone inválido.";
    if (!form.cidadeEstado.trim()) e.cidadeEstado = "Informe cidade/estado.";
    if (!form.instituicao.trim()) e.instituicao = "Informe instituição/empresa.";
    if (!form.area) e.area = "Selecione uma área.";
    if (!form.experiencia) e.experiencia = "Selecione sua experiência.";
    if (form.motivacao.trim().length < 20)
      e.motivacao = "Conte um pouco mais (mín. 20 caracteres).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handle = (k: keyof FormState) => (
    ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [k]: ev.target.value });

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setStatus("loading");
    // Demo: apenas feedback visual, sem envio real
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("success");
    setMessage(
      "Inscrição recebida! Em breve você receberá um e-mail de confirmação."
    );
    setForm(initial);
  };

  return (
    <section id="inscricao" className="section">
      <div className="grid lg:grid-cols-5 gap-10">
        <Reveal className="lg:col-span-2">
          <span className="eyebrow">Inscrição</span>
          <h2 className="section-title">Garanta sua vaga</h2>
          <p className="text-white/75 leading-relaxed mb-6">
            São apenas 160 vagas para todo o evento. Preencha seus dados
            abaixo — a organização analisa as inscrições e envia a confirmação
            por e-mail.
          </p>
          <ul className="space-y-3 text-white/80 text-sm">
            {[
              "Inscrição 100% gratuita",
              "Confirmação enviada por e-mail",
              "Não é necessário ter equipe formada",
            ].map((t) => (
              <li key={t} className="flex gap-3 items-start">
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-sol-orange/15 border border-sol-orange/40 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-sol-orange"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal className="lg:col-span-3" delay={120}>
        <form
          onSubmit={onSubmit}
          noValidate
          className="card space-y-4"
        >
          <Field
            label="Nome completo"
            error={errors.nome}
            input={
              <input
                value={form.nome}
                onChange={handle("nome")}
                placeholder="Seu nome"
                autoComplete="name"
              />
            }
          />

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="E-mail"
              error={errors.email}
              input={
                <input
                  type="email"
                  value={form.email}
                  onChange={handle("email")}
                  placeholder="você@email.com"
                  autoComplete="email"
                />
              }
            />
            <Field
              label="Telefone"
              error={errors.telefone}
              input={
                <input
                  value={form.telefone}
                  onChange={handle("telefone")}
                  placeholder="(00) 00000-0000"
                  autoComplete="tel"
                />
              }
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Cidade/Estado"
              error={errors.cidadeEstado}
              input={
                <input
                  value={form.cidadeEstado}
                  onChange={handle("cidadeEstado")}
                  placeholder="Natal/RN"
                />
              }
            />
            <Field
              label="Instituição ou empresa"
              error={errors.instituicao}
              input={
                <input
                  value={form.instituicao}
                  onChange={handle("instituicao")}
                  placeholder="Onde estuda ou trabalha"
                />
              }
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Área de atuação"
              error={errors.area}
              input={
                <select value={form.area} onChange={handle("area")}>
                  <option value="">Selecione...</option>
                  <option>Desenvolvimento / Programação</option>
                  <option>Design / UX</option>
                  <option>Produto / Negócios</option>
                  <option>Dados / IA</option>
                  <option>Estudante</option>
                  <option>Outros</option>
                </select>
              }
            />
            <Field
              label="Experiência com tecnologia"
              error={errors.experiencia}
              input={
                <select
                  value={form.experiencia}
                  onChange={handle("experiencia")}
                >
                  <option value="">Selecione...</option>
                  <option>Iniciante</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              }
            />
          </div>

          <Field
            label="Motivação para participar"
            error={errors.motivacao}
            input={
              <textarea
                rows={4}
                value={form.motivacao}
                onChange={handle("motivacao")}
                placeholder="O que te motiva a participar do Hackathon do Sol?"
              />
            }
          />

          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "Enviando..." : "Enviar inscrição"}
          </button>

          {status === "success" && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 px-4 py-3 text-sm">
              ✓ {message}
            </div>
          )}
          {status === "error" && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 text-red-200 px-4 py-3 text-sm">
              ✕ {message}
            </div>
          )}
        </form>
        </Reveal>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div>
      <label>{label}</label>
      {input}
      {error && <p className="text-red-300 text-xs mt-1">{error}</p>}
    </div>
  );
}
