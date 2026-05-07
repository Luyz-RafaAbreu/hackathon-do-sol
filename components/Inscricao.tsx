"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UploadCloud, FileText, X, ArrowRight, Check } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { FIELD_MAX_LENGTH } from "@/lib/limits";
import MagneticButton from "./MagneticButton";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type FormState = {
  nome: string;
  email: string;
  telefone: string;
  estado: string;
  cidade: string;
  instituicao: string;
  area: string;
  experiencia: string;
  motivacao: string;
};

const initial: FormState = {
  nome: "",
  email: "",
  telefone: "",
  estado: "",
  cidade: "",
  instituicao: "",
  area: "",
  experiencia: "",
  motivacao: "",
};

type FormErrors = Partial<Record<keyof FormState | "comprovantes" | "robot" | "terms", string>>;

const UFS: ReadonlyArray<readonly [string, string]> = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
];

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";
const MAX_FILES = 3;
const MAX_FILE_SIZE_MB = 1;
// Limite total considerando que base64 infla ~33% e Vercel Hobby aceita 4.5 MB.
// Mantemos folga de segurança usando 3 MB de payload bruto.
const MAX_TOTAL_SIZE_MB = 3;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

// Máscara progressiva de telefone BR. Reformata dinamicamente conforme o
// usuário digita: 2 dígitos viram (XX), depois adiciona espaço, e o traço
// entra a partir do 7º dígito (formato fixo) ou 8º (celular de 11 dígitos).
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length < 3) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function Inscricao() {
  const [form, setForm] = useState<FormState>(initial);
  const [comprovantes, setComprovantes] = useState<File[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [errorCidades, setErrorCidades] = useState(false);
  const cacheCidades = useRef<Record<string, string[]>>({});
  const messageRef = useRef<HTMLDivElement | null>(null);

  // Quando status muda pra success ou error, rola até a mensagem — sem isso,
  // se o usuário rolou pra preencher motivação/upload, a confirmação nasce
  // abaixo do viewport e ele não vê.
  useEffect(() => {
    if (status === "success" || status === "error") {
      messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [status]);

  // Carrega cidades do IBGE quando o estado muda. Cancela request anterior se
  // o usuário trocar de estado rapidamente, e cacheia por UF pra evitar rede
  // repetida no mesmo formulário.
  useEffect(() => {
    if (!form.estado) {
      setCidades([]);
      setErrorCidades(false);
      return;
    }
    const cached = cacheCidades.current[form.estado];
    if (cached) {
      setCidades(cached);
      setErrorCidades(false);
      return;
    }
    const ctrl = new AbortController();
    setLoadingCidades(true);
    setErrorCidades(false);
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.estado}/municipios?orderBy=nome`,
      { signal: ctrl.signal }
    )
      .then((r) => {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      })
      .then((data: { nome: string }[]) => {
        const nomes = data.map((c) => c.nome);
        cacheCidades.current[form.estado] = nomes;
        setCidades(nomes);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Falha ao buscar cidades:", err);
        setCidades([]);
        setErrorCidades(true);
      })
      .finally(() => setLoadingCidades(false));
    return () => ctrl.abort();
  }, [form.estado]);

  const validate = () => {
    const e: FormErrors = {};
    if (!/\S+\s+\S+/.test(form.nome.trim())) e.nome = "Informe seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "E-mail inválido.";
    {
      const digits = form.telefone.replace(/\D/g, "");
      if (digits.length === 0) {
        e.telefone = "Informe seu telefone com DDD.";
      } else if (digits.length < 10 || digits.length > 11) {
        e.telefone = "Telefone inválido. Inclua DDD e número.";
      }
    }
    if (!form.estado) e.estado = "Selecione seu estado.";
    if (!form.cidade) e.cidade = "Selecione sua cidade.";
    if (!form.instituicao.trim()) e.instituicao = "Informe instituição/empresa.";
    if (!form.area) e.area = "Selecione uma área.";
    if (!form.experiencia) e.experiencia = "Selecione sua experiência.";
    if (form.motivacao.trim().length < 20)
      e.motivacao = "Conte um pouco mais (mín. 20 caracteres).";
    if (comprovantes.length === 0) {
      e.comprovantes = "Anexe ao menos um comprovante de atuação na área.";
    } else {
      const total = comprovantes.reduce((s, f) => s + f.size, 0);
      if (total > MAX_TOTAL_SIZE_BYTES) {
        e.comprovantes = `Os arquivos somam ${(total / 1024 / 1024).toFixed(
          1
        )} MB. O total não pode passar de ${MAX_TOTAL_SIZE_MB} MB.`;
      }
    }
    if (!termsAccepted) {
      e.terms = "Você precisa aceitar os termos para se inscrever.";
    }
    if (!turnstileToken) {
      e.robot = "Confirme que você não é um robô.";
    }
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
    setMessage("");

    const fd = new FormData();
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => {
      if (k === "estado" || k === "cidade") return;
      fd.append(k, form[k]);
    });
    // Backend e planilha continuam recebendo "Cidade/UF" como antes.
    fd.append("cidadeEstado", `${form.cidade}/${form.estado}`);
    comprovantes.forEach((f) => fd.append("comprovantes", f));

    // honeypot — preenchido só por bots (humano nunca vê este campo)
    const honeypot = (ev.currentTarget as HTMLFormElement).elements.namedItem(
      "website"
    ) as HTMLInputElement | null;
    if (honeypot) fd.append("website", honeypot.value);

    // Token do Cloudflare Turnstile — validado no servidor antes de aceitar
    if (turnstileToken) fd.append("cf-turnstile-response", turnstileToken);

    try {
      const res = await fetch("/api/inscricao", {
        method: "POST",
        body: fd,
      });
      const result = (await res.json()) as {
        ok: boolean;
        message?: string;
      };
      if (res.ok && result.ok) {
        setStatus("success");
        setMessage(
          result.message ||
            "Inscrição recebida! Em breve você receberá um e-mail."
        );
        setForm(initial);
        setComprovantes([]);
        setTermsAccepted(false);
        // Token do Turnstile é single-use — reset força um desafio novo
        // antes da próxima submissão.
        setTurnstileToken(null);
        turnstileRef.current?.reset();
      } else {
        setStatus("error");
        setMessage(
          result.message ||
            "Não foi possível enviar sua inscrição. Tente novamente."
        );
      }
    } catch {
      setStatus("error");
      setMessage(
        "Erro de conexão. Verifique sua internet e tente novamente."
      );
    }
  };

  return (
    <section id="inscricao" className="relative px-6 md:px-10 max-w-3xl mx-auto pb-20 md:pb-24">
      <form
        onSubmit={onSubmit}
        noValidate
        className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 space-y-4 overflow-hidden"
      >
          {/* Barra gradient no topo do card — accent solar */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink"
          />
          {/* Glow sutil no canto */}
          <div
            aria-hidden
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-sol-orange/8 blur-3xl pointer-events-none"
          />
          {/* honeypot anti-bot — escondido visualmente E pra leitor de tela.
              Não usamos display:none porque alguns bots inteligentes ignoram
              campos com display:none; a posição absoluta off-screen + aria-hidden
              cobre os dois cenários. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              top: "-9999px",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          >
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
              aria-hidden="true"
            />
          </div>

          <SectionHeader number="01" label="Identificação" />

          <Field
            label="Nome completo"
            error={errors.nome}
            input={
              <input
                value={form.nome}
                onChange={handle("nome")}
                placeholder="Seu nome"
                autoComplete="name"
                maxLength={FIELD_MAX_LENGTH.nome}
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
                  maxLength={FIELD_MAX_LENGTH.email}
                />
              }
            />
            <Field
              label="Telefone"
              error={errors.telefone}
              input={
                <input
                  value={form.telefone}
                  onChange={(ev) =>
                    setForm({
                      ...form,
                      telefone: formatPhone(ev.target.value),
                    })
                  }
                  placeholder="(00) 00000-0000"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={FIELD_MAX_LENGTH.telefone}
                />
              }
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Estado"
              error={errors.estado}
              input={
                <select
                  value={form.estado}
                  onChange={(ev) =>
                    setForm({
                      ...form,
                      estado: ev.target.value,
                      cidade: "",
                    })
                  }
                >
                  <option value="">Selecione...</option>
                  {UFS.map(([uf, nome]) => (
                    <option key={uf} value={uf}>
                      {nome}
                    </option>
                  ))}
                </select>
              }
            />
            <Field
              label="Cidade"
              error={
                errorCidades
                  ? "Não foi possível carregar as cidades. Tente novamente."
                  : errors.cidade
              }
              input={
                <select
                  value={form.cidade}
                  onChange={handle("cidade")}
                  disabled={!form.estado || loadingCidades}
                >
                  <option value="">
                    {!form.estado
                      ? "Escolha o estado primeiro"
                      : loadingCidades
                      ? "Carregando..."
                      : "Selecione..."}
                  </option>
                  {cidades.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              }
            />
          </div>

          <Field
            label="Instituição ou empresa"
            error={errors.instituicao}
            input={
              <input
                value={form.instituicao}
                onChange={handle("instituicao")}
                placeholder="Onde estuda ou trabalha"
                maxLength={FIELD_MAX_LENGTH.instituicao}
              />
            }
          />

          <SectionHeader number="02" label="Experiência" />

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
              <div>
                <textarea
                  rows={4}
                  value={form.motivacao}
                  onChange={handle("motivacao")}
                  placeholder="O que te motiva a participar do Hackathon do Sol?"
                  aria-describedby="motivacao-counter"
                  maxLength={FIELD_MAX_LENGTH.motivacao}
                />
                <div
                  id="motivacao-counter"
                  className={`mt-1 text-[0.6875rem] tracking-normal normal-case font-normal text-right ${
                    form.motivacao.trim().length >= 20
                      ? "text-emerald-300/80"
                      : "text-white/45"
                  }`}
                >
                  {form.motivacao.trim().length}/20 caracteres mínimos
                </div>
              </div>
            }
          />

          <SectionHeader number="03" label="Comprovantes" />

          <FileUploadField
            files={comprovantes}
            onChange={setComprovantes}
            error={errors.comprovantes}
          />

          <SectionHeader number="04" label="Confirmação" />

          <div>
            <label className="flex items-start gap-3 cursor-pointer group select-none">
              <span className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(ev) => {
                    setTermsAccepted(ev.target.checked);
                    if (ev.target.checked)
                      setErrors((prev) => ({ ...prev, terms: undefined }));
                  }}
                  className="peer sr-only"
                  aria-describedby={errors.terms ? "terms-error" : undefined}
                />
                <span
                  aria-hidden
                  className="block w-3 h-3 rounded-[0.2rem] border border-white/30 bg-white/[0.04] transition-colors peer-checked:border-sol-orange peer-checked:bg-sol-orange/15 peer-focus-visible:ring-2 peer-focus-visible:ring-sol-orange/60 group-hover:border-white/50"
                />
                <Check
                  aria-hidden
                  className="absolute inset-0 m-auto w-2 h-2 text-sol-orange opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                  strokeWidth={4}
                />
              </span>
              <span className="text-xs font-normal normal-case tracking-normal text-white/80 leading-relaxed">
                Li e concordo com os{" "}
                <Link
                  href="/termos-e-privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sol-orange hover:text-sol-yellow underline underline-offset-2 transition"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  Termos e Política de Privacidade
                </Link>
                .
              </span>
            </label>
            {errors.terms && (
              <p id="terms-error" className="text-red-300 text-xs mt-2">
                {errors.terms}
              </p>
            )}
          </div>

          <div>
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => {
                setTurnstileToken(token);
                setErrors((prev) => ({ ...prev, robot: undefined }));
              }}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
              options={{ theme: "dark", size: "flexible" }}
            />
            {errors.robot && (
              <p className="text-red-300 text-xs mt-2">{errors.robot}</p>
            )}
          </div>

          <MagneticButton strength={10} radius={120} className="w-full">
            <button
              type="submit"
              disabled={status === "loading"}
              className="btn-primary group w-full disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">
                {status === "loading" ? "Enviando..." : "Enviar inscrição"}
              </span>
              {status !== "loading" && (
                <ArrowRight
                  className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1"
                  strokeWidth={2.5}
                />
              )}
            </button>
          </MagneticButton>

          {status === "success" && (
            <div
              ref={messageRef}
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 px-4 py-3 text-sm"
            >
              ✓ {message}
            </div>
          )}
          {status === "error" && (
            <div
              ref={messageRef}
              className="rounded-xl border border-red-400/30 bg-red-400/10 text-red-200 px-4 py-3 text-sm"
            >
              ✕ {message}
            </div>
          )}
      </form>
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

/**
 * Header de seção dentro do form — divide os blocos visualmente sem
 * mudar a estrutura. Numero (mono) + traço + label uppercase + linha
 * gradiente que atravessa o card.
 */
function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 pt-3 first:pt-0">
      <span className="font-mono text-[0.625rem] text-sol-orange/90 font-semibold tabular-nums">
        {number}
      </span>
      <span aria-hidden className="font-mono text-sol-orange/40 text-xs">
        ─
      </span>
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-white/75 font-medium whitespace-nowrap">
        {label}
      </span>
      <span
        aria-hidden
        className="flex-1 h-px bg-gradient-to-r from-sol-orange/40 via-sol-orange/15 to-transparent"
      />
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

    let runningTotal = files.reduce((s, f) => s + f.size, 0);
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        rejected.push(`${f.name} (maior que ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }
      // Bloqueia quem faria passar do limite total — não tenta encaixar parcial
      if (runningTotal + f.size > MAX_TOTAL_SIZE_BYTES) {
        rejected.push(
          `${f.name} (passaria do limite total de ${MAX_TOTAL_SIZE_MB}MB)`
        );
        continue;
      }
      valid.push(f);
      runningTotal += f.size;
    }

    const combined = [...files, ...valid].slice(0, MAX_FILES);
    if (files.length + valid.length > MAX_FILES) {
      rejected.push(`Máximo de ${MAX_FILES} arquivos — os excedentes foram ignorados.`);
    }

    if (rejected.length > 0) setRejectMsg(rejected.join(" · "));
    onChange(combined);
  };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const totalMb = totalBytes / 1024 / 1024;
  const ratio = totalBytes / MAX_TOTAL_SIZE_BYTES;
  const totalColor =
    ratio > 1
      ? "text-red-300"
      : ratio > 0.85
      ? "text-amber-300"
      : "text-white/55";

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
        className={`group cursor-pointer rounded-xl border-[0.125rem] border-dashed px-5 py-6 text-center transition ${
          isDragging
            ? "border-sol-orange bg-sol-orange/10"
            : error
            ? "border-red-400/50 bg-red-400/5"
            : "border-white/15 bg-white/[0.03] hover:border-sol-orange/50 hover:bg-white/[0.06]"
        }`}
      >
        <UploadCloud
          className={`w-8 h-8 mx-auto mb-2 transition ${
            isDragging ? "text-sol-orange" : "text-white/40 group-hover:text-sol-orange"
          }`}
          strokeWidth={1.6}
        />
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
        <div
          className={`mt-3 text-xs font-normal tracking-normal normal-case flex justify-between items-center ${totalColor}`}
        >
          <span>
            Total: {totalMb.toFixed(2)} MB de {MAX_TOTAL_SIZE_MB} MB permitidos
          </span>
          {ratio > 1 && <span>Remova um arquivo para enviar.</span>}
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-2 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-sol-orange/15 border border-sol-orange/30 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-sol-orange" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white/90 truncate font-medium">
                    {f.name}
                  </p>
                  <p className="text-[0.6875rem] text-white/50">
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
                <X className="w-4 h-4" strokeWidth={2} />
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
