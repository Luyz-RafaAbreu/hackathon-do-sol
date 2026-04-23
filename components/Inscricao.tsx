"use client";
import { FormEvent, useRef, useState } from "react";
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

type FormErrors = Partial<Record<keyof FormState | "comprovantes", string>>;

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";
const MAX_FILES = 3;
const MAX_FILE_SIZE_MB = 5;

export default function Inscricao() {
  const [form, setForm] = useState<FormState>(initial);
  const [comprovantes, setComprovantes] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const validate = () => {
    const e: FormErrors = {};
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
    if (comprovantes.length === 0)
      e.comprovantes = "Anexe ao menos um comprovante de atuação na área.";
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
    setComprovantes([]);
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
              "Anexe comprovantes da sua atuação em tecnologia",
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

          <FileUploadField
            files={comprovantes}
            onChange={setComprovantes}
            error={errors.comprovantes}
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

function FileUploadField({
  files,
  onChange,
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectMsg, setRejectMsg] = useState<string | null>(null);

  const addFiles = (incoming: FileList | File[]) => {
    setRejectMsg(null);
    const arr = Array.from(incoming);
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejected.push(`${f.name} (maior que ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }
      valid.push(f);
    }

    const combined = [...files, ...valid].slice(0, MAX_FILES);
    if (files.length + valid.length > MAX_FILES) {
      rejected.push(`Máximo de ${MAX_FILES} arquivos — os excedentes foram ignorados.`);
    }

    if (rejected.length > 0) setRejectMsg(rejected.join(" · "));
    onChange(combined);
  };

  const removeFile = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label>Comprovante de atuação em tecnologia</label>
      <p className="text-xs text-white/55 mb-2 -mt-1 normal-case tracking-normal font-normal">
        Anexe diploma, currículo, certificado ou similar. Até {MAX_FILES}{" "}
        arquivos (PDF, imagem ou Word, máx. {MAX_FILE_SIZE_MB}MB cada).
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`group cursor-pointer rounded-xl border-2 border-dashed px-5 py-6 text-center transition ${
          isDragging
            ? "border-sol-orange bg-sol-orange/10"
            : error
            ? "border-red-400/50 bg-red-400/5"
            : "border-white/15 bg-white/[0.03] hover:border-sol-orange/50 hover:bg-white/[0.06]"
        }`}
      >
        <svg
          className={`w-8 h-8 mx-auto mb-2 transition ${
            isDragging ? "text-sol-orange" : "text-white/40 group-hover:text-sol-orange"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm text-white/80 font-medium">
          Clique para selecionar{" "}
          <span className="text-white/50">ou arraste os arquivos aqui</span>
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-sol-orange/15 border border-sol-orange/30 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-sol-orange"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white/90 truncate font-medium">
                    {f.name}
                  </p>
                  <p className="text-[11px] text-white/50">
                    {(f.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                aria-label={`Remover ${f.name}`}
                className="shrink-0 w-7 h-7 rounded-lg text-white/50 hover:text-red-300 hover:bg-red-400/10 transition flex items-center justify-center"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejectMsg && (
        <p className="text-amber-300 text-xs mt-2">⚠ {rejectMsg}</p>
      )}
      {error && <p className="text-red-300 text-xs mt-2">{error}</p>}
    </div>
  );
}
