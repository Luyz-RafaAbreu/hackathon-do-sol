"use client";
// ============================================================================
// components/InscricaoIndividualWizard.tsx
// ----------------------------------------------------------------------------
// Wizard de inscrição individual — 3 etapas:
//   1) Dados pessoais (mesmos campos do integrante de equipe + 9 aceites
//      individuais)
//   2) Trilha de preferência + aceite específico de formação por organização
//   3) Confirmação + Turnstile + envio (POST /api/inscricao-individual)
//
// Modo `previewMode`: se true, o submit vira stub (não chama API) e o
// Turnstile/honeypot são pulados. Usado pelo /preview/inscricao (rota
// dev-only, sem auth) pra testes visuais sem chave do Cloudflare.
// ============================================================================
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Send, User, Layers, ShieldCheck } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useInscricaoStatus } from "./InscricaoStatusProvider";
import JaInscritoModal from "./JaInscritoModal";
import {
  ACEITES_INDIVIDUAIS,
  ACEITE_INDIVIDUAL_FORMACAO_EQUIPE,
  AREAS_CONHECIMENTO,
  COMO_SOUBE_OPCOES,
  CURSOS_AREAS,
  FIELD_MAX,
  GENEROS,
  InscricaoIndividualState,
  IntegranteState,
  NACIONALIDADES,
  NIVEIS_FORMACAO,
  PARENTESCO_OPCOES,
  TEMPO_EXPERIENCIA_OPCOES,
  TRILHAS,
  TRILHAS_DESCRICAO,
  UFS,
  createInitialIndividual,
  formatCEP,
  formatCPF,
  formatPhoneBR,
  validateIndividual,
} from "@/lib/inscricao-schema";
import InstituicaoAutocomplete from "./inscricao-fields/InstituicaoAutocomplete";
import CidadeIbgeSelect from "./inscricao-fields/CidadeIbgeSelect";

const DRAFT_KEY = "hackathon-sol-inscricao-individual-draft-v1";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// =============================================================================
// DEV AUTOFILL — atalho pra preencher o form inteiro com dados válidos durante
// dev. Só aparece quando `NODE_ENV !== "production"`. Em build de produção
// `isDev` vira `false` em compile-time e a função é eliminada via dead-code
// elimination do Next.
// =============================================================================
const isDev = process.env.NODE_ENV !== "production";
const TEST_CPF = "123.456.789-09";

function createTestIndividual(): InscricaoIndividualState {
  return {
    integrante: {
      nomeCompleto: "Pessoa de Teste Individual",
      nomeSocial: "",
      cpf: TEST_CPF,
      rg: "12.345.678 SSP/RN",
      dataNascimento: "2000-01-15",
      nacionalidade: NACIONALIDADES[0],
      naturalidade: "Natal/RN",
      cidade: "Natal",
      estado: "RN",
      cep: "59056-000",
      logradouro: "Avenida Teste",
      numero: "123",
      complemento: "Apto 101",
      bairro: "Tirol",
      emailPessoal: "teste-individual@gmail.com",
      telefoneCelular: "(84) 99999-0001",
      contatoEmergenciaNome: "Contato de Emergência",
      contatoEmergenciaTelefone: "(84) 98888-0001",
      contatoEmergenciaParentesco: "Mãe",
      genero: GENEROS[0],
      areasConhecimento: [AREAS_CONHECIMENTO[0]],
      ocupacaoAtual: "Desenvolvedor(a) de teste",
      tempoExperiencia: "2 a 5 anos",
      nivelFormacao: "Graduação completa",
      cursoFormacao: "Ciência da Computação / Engenharia de Software",
      anoFormacao: "2022",
      instituicao: "Universidade Federal do Rio Grande do Norte (UFRN)",
      instituicaoUF: "RN",
      instituicaoMunicipio: "Natal",
      projetoAcademico: "Projeto de TCC sobre teste — ainda em revisão.",
      linkedin: "https://linkedin.com/in/teste",
      portfolio: "https://github.com/teste",
      outrasRedes: "",
      experienciaRelevante:
        "Experiência relevante de teste em projetos importantes nos últimos anos, contribuindo com soluções escaláveis.",
      restricoesAlimentares: "Nenhuma",
      alergias: "",
      medicamentos: "",
      acessibilidade: "",
      outrasObservacoes: "",
      comoSoube: COMO_SOUBE_OPCOES[0],
      aceites: ACEITES_INDIVIDUAIS.reduce<Record<string, boolean>>((acc, a) => {
        acc[a.key] = true;
        return acc;
      }, {}),
    },
    trilhaPreferida: TRILHAS[0],
    aceiteFormacaoEquipe: true,
  };
}

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

function Field({
  label,
  help,
  error,
  input,
  alignInput = "bottom",
}: {
  label: string;
  help?: string;
  error?: string;
  input: ReactNode;
  // "bottom" (default): input ancora no fundo. Útil em grids 2-col onde
  //   um Field tem help e o vizinho não — sem isso, os inputs ficam
  //   desalinhados verticalmente entre as colunas.
  // "top": input fica logo abaixo do label/help. Usar quando o conteúdo
  //   de uma coluna pode crescer muito mais que a outra.
  alignInput?: "top" | "bottom";
}) {
  // <label> sem classes — globals.css já estiliza com tipografia padrão
  // do form (text-xs font-semibold uppercase tracking-[0.12em]).
  return (
    <div
      className={alignInput === "bottom" ? "flex flex-col h-full" : undefined}
      data-field-error={error ? "true" : undefined}
    >
      <label>{label}</label>
      {help && (
        <p className="text-xs text-white/55 -mt-1 mb-2 normal-case tracking-normal font-normal">
          {help}
        </p>
      )}
      <div className={alignInput === "bottom" ? "mt-auto" : undefined}>
        {input}
        {error && <p className="text-red-300 text-xs mt-1">{error}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display font-semibold text-base md:text-lg text-sol-orange mt-8 mb-4 first:mt-0">
      {children}
    </h3>
  );
}

// ============================================================================
// WIZARD PRINCIPAL
// ============================================================================

type Props = {
  onBack: () => void; // volta pro seletor
  // `previewMode` é exclusivo da rota /preview/inscricao (dev-only). Quando
  // true, o submit vira stub (não chama API) e o Turnstile/honeypot são
  // pulados. Em produção é SEMPRE false — o submit real chama
  // POST /api/inscricao-individual com Turnstile + honeypot.
  previewMode?: boolean;
};

export default function InscricaoIndividualWizard({ onBack, previewMode = false }: Props) {
  const [state, setState] = useState<InscricaoIndividualState>(
    createInitialIndividual()
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const submittingRef = useRef(false);
  // Cache em memória das cidades IBGE por UF — evita rede repetida quando o
  // usuário troca de UF e volta. Compartilhado entre selects do form.
  const cacheCidadesRef = useRef<Record<string, string[]>>({});
  const { data: session } = useSession();
  // `markInscrito("individual")` chamado após envio bem-sucedido. Mantém
  // Hero/Header/InscricaoGate em sincronia sem precisar de reload — mesmo
  // padrão do fluxo de equipe.
  const { markInscrito } = useInscricaoStatus();

  // Toast de validação (mesmo do fluxo de equipe) — aparece no topo quando
  // user tenta avançar com erros. Auto-some em 5s.
  const [validationToast, setValidationToast] = useState<{
    count: number;
    key: number;
  } | null>(null);
  useEffect(() => {
    if (!validationToast) return;
    const id = window.setTimeout(() => setValidationToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [validationToast]);

  // Indicador de salvamento de rascunho (pop-up flutuante no canto inferior).
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  // Pula o 1º disparo do indicador (mount) pra não mostrar "Salvo" sem ter
  // havido edição.
  const firstSaveSkip = useRef(true);

  // `draftChecked` segura o autosave até o restore terminar — evita
  // sobrescrever o draft remoto com o estado inicial vazio antes da
  // chamada GET retornar (mesmo padrão do fluxo de equipe).
  const [draftChecked, setDraftChecked] = useState(false);

  // Restore on mount: localStorage primeiro (síncrono, F5-safe); se não
  // tinha local, tenta servidor (cobre "comecei no celular, abri no
  // notebook"). Em modo preview NUNCA bate no servidor — preview é
  // dev-only sem auth.
  useEffect(() => {
    let localHadDraft = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setState(parsed);
          setDraftRestored(true);
          localHadDraft = true;
          window.setTimeout(() => setDraftRestored(false), 5000);
        }
      }
    } catch {
      /* */
    }

    if (previewMode) {
      setDraftChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/draft?kind=individual", {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          draft?: InscricaoIndividualState | null;
        };
        if (cancelled) return;
        if (
          data.draft &&
          typeof data.draft === "object" &&
          !localHadDraft &&
          "integrante" in data.draft &&
          "trilhaPreferida" in data.draft
        ) {
          setState(data.draft);
          setDraftRestored(true);
          window.setTimeout(() => setDraftRestored(false), 5000);
        }
      } catch {
        /* servidor indisponível — segue com localStorage */
      } finally {
        if (!cancelled) setDraftChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewMode]);

  // Persist on change: localStorage instantâneo + POST debounced (2s) pro
  // servidor. Indicador visual ("Salvando…" → "Salvo ✓"). Pula a 1ª
  // iteração (mount) pra não mostrar antes da pessoa editar. POST só
  // dispara com sessão E quando o restore acabou.
  useEffect(() => {
    if (firstSaveSkip.current) {
      firstSaveSkip.current = false;
      return;
    }
    setSaveState("saving");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      /* */
    }
    // Pequeno delay pra mostrar o "Salvando…" antes do "Salvo".
    const idSaved = window.setTimeout(() => setSaveState("saved"), 350);

    // Backup remoto (cross-device). Pula no preview e quando restore
    // ainda não acabou.
    let idPost: number | undefined;
    if (!previewMode && draftChecked && session?.user?.email) {
      idPost = window.setTimeout(() => {
        fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, kind: "individual" }),
          credentials: "include",
          keepalive: true,
        }).catch(() => {
          /* network blip — próxima edição tenta de novo */
        });
      }, 2000);
    }

    return () => {
      window.clearTimeout(idSaved);
      if (idPost !== undefined) window.clearTimeout(idPost);
    };
  }, [state, draftChecked, previewMode, session]);

  const updateIntegrante = (patch: Partial<IntegranteState>) =>
    setState((s) => ({ ...s, integrante: { ...s.integrante, ...patch } }));
  const toggleAceite = (key: string, v: boolean) =>
    setState((s) => ({
      ...s,
      integrante: {
        ...s.integrante,
        aceites: { ...s.integrante.aceites, [key]: v },
      },
    }));

  // Validação por etapa — versão simplificada, sem dependências externas.
  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    const i = state.integrante;
    if (s === 0) {
      // Dados pessoais — só os campos críticos no stub
      if (!i.nomeCompleto.trim()) e["integrante.nomeCompleto"] = "Obrigatório";
      if (!i.cpf.trim()) e["integrante.cpf"] = "Obrigatório";
      if (!i.rg.trim()) e["integrante.rg"] = "Obrigatório";
      if (!i.dataNascimento) e["integrante.dataNascimento"] = "Obrigatório";
      if (!i.nacionalidade) e["integrante.nacionalidade"] = "Obrigatório";
      if (!i.naturalidade.trim()) e["integrante.naturalidade"] = "Obrigatório";
      if (!i.cidade.trim()) e["integrante.cidade"] = "Obrigatório";
      if (!i.estado.trim()) e["integrante.estado"] = "Obrigatório";
      if (!i.cep.trim()) e["integrante.cep"] = "Obrigatório";
      if (!i.logradouro.trim()) e["integrante.logradouro"] = "Obrigatório";
      if (!i.numero.trim()) e["integrante.numero"] = "Obrigatório";
      if (!i.bairro.trim()) e["integrante.bairro"] = "Obrigatório";
      if (!i.emailPessoal.trim()) e["integrante.emailPessoal"] = "Obrigatório";
      if (!i.telefoneCelular.trim())
        e["integrante.telefoneCelular"] = "Obrigatório";
      if (!i.contatoEmergenciaNome.trim())
        e["integrante.contatoEmergenciaNome"] = "Obrigatório";
      if (!i.contatoEmergenciaTelefone.trim())
        e["integrante.contatoEmergenciaTelefone"] = "Obrigatório";
      if (!i.contatoEmergenciaParentesco)
        e["integrante.contatoEmergenciaParentesco"] = "Obrigatório";
      if (!i.genero) e["integrante.genero"] = "Obrigatório";
      if (i.areasConhecimento.length === 0)
        e["integrante.areasConhecimento"] = "Marque pelo menos uma área";
      if (!i.ocupacaoAtual.trim()) e["integrante.ocupacaoAtual"] = "Obrigatório";
      if (!i.tempoExperiencia)
        e["integrante.tempoExperiencia"] = "Obrigatório";
      if (!i.nivelFormacao) e["integrante.nivelFormacao"] = "Obrigatório";
      if (!i.experienciaRelevante.trim())
        e["integrante.experienciaRelevante"] = "Obrigatório";
      if (!i.comoSoube) e["integrante.comoSoube"] = "Obrigatório";
      // Aceites individuais — todos os 9 marcados
      for (const a of ACEITES_INDIVIDUAIS) {
        if (i.aceites[a.key] !== true)
          e[`aceite.${a.key}`] = "Você precisa aceitar este termo";
      }
    } else if (s === 1) {
      if (!state.trilhaPreferida)
        e.trilhaPreferida = "Escolha uma trilha de preferência";
      if (state.aceiteFormacaoEquipe !== true)
        e.aceiteFormacaoEquipe = "Você precisa autorizar a formação de equipe";
    } else if (s === 2) {
      // Confirmação — roda validação completa
      const full = validateIndividual(state);
      if (!full.ok) Object.assign(e, full.errors);
    }
    return e;
  };

  const goNext = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Dispara o toast de validação (mesmo do fluxo de equipe)
      setValidationToast({ count: Object.keys(e).length, key: Date.now() });
      // Scroll pro primeiro erro
      window.setTimeout(() => {
        const el = document.querySelector("[data-field-error]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  };
  const goBack = () => {
    if (step === 0) return;
    setStep((s) => s - 1);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    // Trava de reentrada — duplo-clique rápido dispara submit() 2x antes do
    // botão re-renderizar disabled. Ref síncrono bloqueia antes de qualquer
    // await.
    if (submittingRef.current) return;

    // O <form onSubmit={submit}> também é acionado por Enter em qualquer
    // input. Em etapas 0 e 1 o comportamento certo é avançar (como o botão
    // "Continuar"), não tentar enviar a inscrição inteira.
    if (step < 2) {
      goNext();
      return;
    }

    // Validação final completa
    const errs = validateStep(2);
    if (!previewMode && !turnstileToken) {
      errs.robot = "Confirme que você não é um robô.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setValidationToast({ count: Object.keys(errs).length, key: Date.now() });
      window.setTimeout(() => {
        const el = document.querySelector("[data-field-error]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }

    submittingRef.current = true;
    setSubmitStatus("loading");
    setSubmitMessage("");

    // STUB: no /preview/inscricao (dev-only, sem auth/Turnstile), pula o
    // POST real e mostra sucesso falso. Em produção `previewMode` é false.
    if (previewMode) {
      await new Promise((r) => setTimeout(r, 800));
      setSubmitStatus("success");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* */
      }
      return;
    }

    // Honeypot — campo escondido. Se um bot preencher, o backend devolve
    // ok:true silencioso (não dá dica).
    const honeypotInput = (ev.currentTarget as HTMLFormElement).elements.namedItem(
      "contato_extra"
    ) as HTMLInputElement | null;
    const honeypot = honeypotInput?.value ?? "";

    try {
      const res = await fetch("/api/inscricao-individual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          turnstileToken,
          honeypot,
        }),
      });
      const result = (await res.json()) as { ok: boolean; message?: string };
      if (res.ok && result.ok) {
        setSubmitStatus("success");
        // Avisa Hero/Header/Gate que esta conta agora está inscrita (modo
        // individual). Sem isto, navegar pra outra página e voltar nesta
        // mesma sessão mostraria o seletor de novo em vez do pop-up de "já
        // inscrito".
        markInscrito("individual");
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* */
        }
      } else {
        setSubmitStatus("error");
        setSubmitMessage(
          result.message ||
            "Não foi possível enviar a inscrição. Verifique os dados e tente novamente."
        );
        // Token Turnstile é single-use — reseta pra próxima tentativa
        setTurnstileToken(null);
        turnstileRef.current?.reset();
        submittingRef.current = false; // erro — libera pra nova tentativa
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("Erro de conexão. Verifique sua internet e tente novamente.");
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      submittingRef.current = false;
    }
  };

  if (submitStatus === "success") {
    // Mesmo padrão do fluxo de equipe: pop-up centralizado bloqueando o
    // formulário, com botão "Voltar à página principal". Sem opção de
    // fechar — a inscrição já está no servidor, não há mais o que fazer
    // nessa página.
    return (
      <section className="relative px-6 md:px-10 max-w-3xl mx-auto pb-20 md:pb-24">
        <JaInscritoModal
          title="Inscrição"
          titleHighlight="enviada"
          message={
            previewMode
              ? "Modo preview — nenhum dado foi enviado pra produção."
              : "Sua inscrição individual entrou na lista de análise do Hackathon do Sol. Enviamos um e-mail de confirmação pra esta conta Google — confira a caixa de entrada. A organização vai te alocar numa equipe no dia do credenciamento."
          }
        />
      </section>
    );
  }

  return (
    <section
      id="inscricao"
      className="relative px-6 md:px-10 max-w-3xl mx-auto pb-20 md:pb-24"
    >
      {validationToast && (
        <ValidationToast
          key={validationToast.key}
          count={validationToast.count}
          onDismiss={() => setValidationToast(null)}
        />
      )}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        Trocar tipo de inscrição
      </button>

      {/* <form> envolve o card pra que o submit nativo do botão funcione e
          pra capturar o honeypot via ev.currentTarget.elements. Wrapper visual
          idêntico ao fluxo de equipe (card + gradiente no topo + blob). */}
      <form onSubmit={submit} className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 space-y-5" noValidate>
        {/* Honeypot — campo escondido. Se um bot preenche, o backend devolve
            ok:true silencioso sem registrar nada. Visualmente invisível +
            aria-hidden + tabindex -1 pra não confundir leitor de tela. */}
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
            name="contato_extra"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
            aria-hidden="true"
          />
        </div>
        {/* Decorações ficam num clipper próprio (overflow-hidden) em vez do
            wrapper inteiro — senão o dropdown do autocomplete da instituição
            seria cortado pela borda. */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink" />
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-sol-orange/8 blur-3xl" />
        </div>

        {/* DEV autofill — só aparece em dev (`NODE_ENV !== "production"`).
            Em produção o `isDev` vira false em compile-time e este bloco
            inteiro é eliminado via DCE do Next. */}
        {isDev && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-normal normal-case tracking-normal text-amber-200">
            <span>🧪 DEV</span>
            <button
              type="button"
              onClick={() => {
                setState(createTestIndividual());
                setStep(2);
                setErrors({});
                setSubmitStatus("idle");
              }}
              className="ml-auto underline underline-offset-2 hover:text-amber-100"
            >
              Preencher tudo + pular pra última etapa
            </button>
            <button
              type="button"
              onClick={() => {
                setState(createInitialIndividual());
                setStep(0);
                setErrors({});
                setSubmitStatus("idle");
                try {
                  localStorage.removeItem(DRAFT_KEY);
                } catch {
                  /* */
                }
              }}
              className="underline underline-offset-2 hover:text-amber-100"
            >
              Limpar
            </button>
          </div>
        )}

        {/* "Logado como X | Sair" — aparece só quando há sessão. No preview
            (sem auth) não aparece, igual ao fluxo de equipe. */}
        {session?.user?.email && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"
              />
              <span className="text-white/55 truncate font-normal normal-case tracking-normal">
                Logado como{" "}
                <span className="text-white/85 font-medium">
                  {session.user.email}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-white/45 hover:text-white transition flex-shrink-0 underline underline-offset-2 font-normal normal-case tracking-normal"
            >
              Sair
            </button>
          </div>
        )}

        {draftRestored && (
          <div className="rounded-lg border border-sol-orange/30 bg-sol-orange/10 text-sol-orange px-4 py-2 text-xs">
            ↺ Rascunho restaurado do navegador. Continue de onde parou.
          </div>
        )}

        <Steps step={step} />

        {step === 0 && (
          <StepDadosPessoais
            integrante={state.integrante}
            errors={errors}
            onChange={updateIntegrante}
            onToggleAceite={toggleAceite}
            cacheCidades={cacheCidadesRef.current}
          />
        )}
        {step === 1 && (
          <StepTrilha
            trilhaPreferida={state.trilhaPreferida}
            aceiteFormacao={state.aceiteFormacaoEquipe}
            errors={errors}
            onChangeTrilha={(t) =>
              setState((s) => ({ ...s, trilhaPreferida: t }))
            }
            onChangeAceite={(v) =>
              setState((s) => ({ ...s, aceiteFormacaoEquipe: v }))
            }
          />
        )}
        {step === 2 && (
          <>
            <StepConfirmacao state={state} previewMode={previewMode} />

            {/* Turnstile — só em produção; no preview (sem env do
                Cloudflare e sem auth) ele não faz sentido e o submit
                bypassa o token. */}
            {!previewMode && TURNSTILE_SITE_KEY && (
              <div className="pt-2">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={(t) => setTurnstileToken(t)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                  options={{ theme: "dark", size: "flexible" }}
                />
                {!turnstileToken && (
                  <p className="text-[0.6875rem] text-white/45 mt-2 normal-case tracking-normal font-normal">
                    Aguarde a verificação anti-robô completar antes de enviar.
                  </p>
                )}
              </div>
            )}

            {submitStatus === "error" && submitMessage && (
              <div
                role="alert"
                className="rounded-lg border border-red-400/40 bg-red-950/40 text-red-100 px-4 py-3 text-sm normal-case tracking-normal font-normal"
              >
                {submitMessage}
              </div>
            )}
          </>
        )}

        <div className="mt-10 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 text-white/85 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
            Voltar
          </button>
          {step < 2 ? (
            <button
              type="button"
              onClick={goNext}
              className="btn-primary inline-flex items-center gap-2"
            >
              Continuar
              <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitStatus === "loading"}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {submitStatus === "loading" ? "Enviando…" : "Enviar inscrição"}
              <Send className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {Object.keys(errors).length > 0 && step < 2 && (
          <p className="text-red-300 text-sm text-right">
            {Object.keys(errors).length} campo(s) com erro. Revise acima.
          </p>
        )}
      </form>

      {/* Indicador de salvamento — popup pequeno e translúcido no canto
          inferior esquerdo. "Salvando…" enquanto a pessoa digita; ao virar
          "Progresso salvo", some sozinho com fade lento. */}
      <div
        aria-hidden
        className={`fixed bottom-4 left-4 z-30 pointer-events-none flex items-center gap-1 rounded-full border border-white/10 bg-sol-bgDeep/55 px-2.5 py-1 text-[0.625rem] font-normal normal-case tracking-normal text-white/45 backdrop-blur-sm transition-opacity ${
          saveState === "saving"
            ? "opacity-70 duration-300"
            : saveState === "saved"
              ? "opacity-0 duration-[2000ms]"
              : "opacity-0 duration-300"
        }`}
      >
        {saveState === "saving" ? (
          "Salvando…"
        ) : (
          <>
            <Check
              className="w-2.5 h-2.5 text-sol-orange/70"
              strokeWidth={2.5}
            />
            Progresso salvo
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// STEPPER VISUAL
// ============================================================================

function Steps({ step }: { step: number }) {
  const items = [
    { i: 0, label: "Seus dados", Icon: User },
    { i: 1, label: "Trilha + aceite", Icon: Layers },
    { i: 2, label: "Confirmação", Icon: ShieldCheck },
  ];
  return (
    <div className="flex items-center justify-between gap-2 mb-8">
      {items.map((it, idx) => {
        const active = step === it.i;
        const done = step > it.i;
        return (
          <div key={it.i} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors ${
                active
                  ? "bg-sol-orange text-black"
                  : done
                    ? "bg-emerald-500 text-black"
                    : "bg-white/10 text-white/55"
              }`}
            >
              {done ? (
                <Check className="w-4 h-4" strokeWidth={3} />
              ) : (
                <it.Icon className="w-4 h-4" strokeWidth={2.5} />
              )}
            </div>
            <div
              className={`text-xs md:text-sm font-semibold ${
                active ? "text-white" : "text-white/55"
              }`}
            >
              {it.label}
            </div>
            {idx < items.length - 1 && (
              <div
                className={`flex-1 h-px ml-1 transition-colors ${
                  done ? "bg-emerald-500" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// STEP 1 — DADOS PESSOAIS
// ============================================================================

function StepDadosPessoais({
  integrante,
  errors,
  onChange,
  onToggleAceite,
  cacheCidades,
}: {
  integrante: IntegranteState;
  errors: Record<string, string>;
  onChange: (patch: Partial<IntegranteState>) => void;
  onToggleAceite: (key: string, v: boolean) => void;
  cacheCidades: Record<string, string[]>;
}) {
  const err = (k: string) => errors[`integrante.${k}`];
  const cls = "input"; // padrão Tailwind do projeto em globals.css
  const isEnsMedio = integrante.nivelFormacao.startsWith("Ensino Médio");

  // Estado local pro CEP: ViaCEP autopreenche logradouro/bairro/cidade/UF
  // quando 8 dígitos são digitados.
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMsg, setCepMsg] = useState("");
  const lastLookedUp = useRef("");
  const lookupCep = async (digits: string) => {
    if (digits === lastLookedUp.current) return;
    lastLookedUp.current = digits;
    setCepLoading(true);
    setCepMsg("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        setCepMsg("CEP não encontrado — preencha o endereço manualmente.");
        return;
      }
      const patch: Partial<IntegranteState> = {};
      if (data.logradouro) patch.logradouro = data.logradouro;
      if (data.bairro) patch.bairro = data.bairro;
      if (data.localidade) patch.cidade = data.localidade;
      if (data.uf) patch.estado = data.uf;
      onChange(patch);
    } catch {
      setCepMsg("Não foi possível consultar o CEP — preencha manualmente.");
    } finally {
      setCepLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle>Identificação</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Nome completo"
          error={err("nomeCompleto")}
          input={
            <input
              className={cls}
              value={integrante.nomeCompleto}
              onChange={(e) => onChange({ nomeCompleto: e.target.value })}
              maxLength={FIELD_MAX.nomeCompleto}
              placeholder="Como aparece no documento"
            />
          }
        />
        <Field
          label="Nome social (opcional)"
          error={err("nomeSocial")}
          input={
            <input
              className={cls}
              value={integrante.nomeSocial}
              onChange={(e) => onChange({ nomeSocial: e.target.value })}
              maxLength={FIELD_MAX.nomeSocial}
              placeholder="Opcional"
            />
          }
        />
        <Field
          label="CPF"
          error={err("cpf")}
          input={
            <input
              className={cls}
              value={integrante.cpf}
              onChange={(e) => onChange({ cpf: formatCPF(e.target.value) })}
              maxLength={14}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
          }
        />
        <Field
          label="RG"
          error={err("rg")}
          input={
            <input
              className={cls}
              value={integrante.rg}
              onChange={(e) => onChange({ rg: e.target.value })}
              maxLength={FIELD_MAX.rg}
              placeholder="Ex: 1.234.567 SSP/RN"
            />
          }
        />
        <Field
          label="Data de nascimento"
          help="18+ até 24/06/2026"
          error={err("dataNascimento")}
          input={
            <input
              type="date"
              className={cls}
              value={integrante.dataNascimento}
              onChange={(e) => onChange({ dataNascimento: e.target.value })}
            />
          }
        />
        <Field
          label="Nacionalidade"
          error={err("nacionalidade")}
          input={
            <select
              className={cls}
              value={integrante.nacionalidade}
              onChange={(e) => onChange({ nacionalidade: e.target.value })}
            >
              <option value="">Selecione…</option>
              {NACIONALIDADES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          }
        />
        <Field
          label="Naturalidade"
          help="Cidade/UF de nascimento"
          error={err("naturalidade")}
          input={
            <input
              className={cls}
              value={integrante.naturalidade}
              onChange={(e) => onChange({ naturalidade: e.target.value })}
              maxLength={FIELD_MAX.naturalidade}
              placeholder="Ex: Natal/RN"
            />
          }
        />
        <Field
          label="Gênero"
          error={err("genero")}
          input={
            <select
              className={cls}
              value={integrante.genero}
              onChange={(e) => onChange({ genero: e.target.value })}
            >
              <option value="">Selecione…</option>
              {GENEROS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <SectionTitle>Endereço atual</SectionTitle>
      <Field
        label="CEP"
        help="Digite o CEP — preenchemos o resto do endereço automaticamente."
        error={err("cep")}
        input={
          <div className="space-y-1">
            <input
              className={cls}
              value={integrante.cep}
              onChange={(e) => {
                const formatted = formatCEP(e.target.value);
                onChange({ cep: formatted });
                const digits = formatted.replace(/\D/g, "");
                if (digits.length === 8) {
                  lookupCep(digits);
                } else {
                  lastLookedUp.current = "";
                  setCepMsg("");
                }
              }}
              maxLength={9}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
            />
            {cepLoading && (
              <p className="text-xs text-white/55 normal-case tracking-normal font-normal">
                Buscando endereço…
              </p>
            )}
            {cepMsg && (
              <p className="text-xs text-amber-300 normal-case tracking-normal font-normal">
                {cepMsg}
              </p>
            )}
          </div>
        }
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="UF"
          error={err("estado")}
          input={
            <select
              className={cls}
              value={integrante.estado}
              onChange={(e) =>
                onChange({ estado: e.target.value, cidade: "" })
              }
            >
              <option value="">Selecione…</option>
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
          error={err("cidade")}
          input={
            <CidadeIbgeSelect
              estado={integrante.estado}
              cidade={integrante.cidade}
              onChangeCidade={(v) => onChange({ cidade: v })}
              cacheCidades={cacheCidades}
            />
          }
        />
      </div>
      <div className="grid md:grid-cols-[2fr_1fr_1fr] gap-4">
        <Field
          label="Logradouro"
          error={err("logradouro")}
          input={
            <input
              className={cls}
              value={integrante.logradouro}
              onChange={(e) => onChange({ logradouro: e.target.value })}
              maxLength={FIELD_MAX.logradouro}
              placeholder="Ex: Av. Senador Salgado Filho"
            />
          }
        />
        <Field
          label="Número"
          error={err("numero")}
          input={
            <input
              className={cls}
              value={integrante.numero}
              onChange={(e) => onChange({ numero: e.target.value })}
              maxLength={FIELD_MAX.numero}
              placeholder="Ex: 1906 ou S/N"
            />
          }
        />
        <Field
          label="Complemento"
          error={err("complemento")}
          input={
            <input
              className={cls}
              value={integrante.complemento}
              onChange={(e) => onChange({ complemento: e.target.value })}
              maxLength={FIELD_MAX.complemento}
              placeholder="Apto 302, Bloco B"
            />
          }
        />
      </div>
      <Field
        label="Bairro"
        error={err("bairro")}
        input={
          <input
            className={cls}
            value={integrante.bairro}
            onChange={(e) => onChange({ bairro: e.target.value })}
            maxLength={FIELD_MAX.bairro}
            placeholder="Ex: Lagoa Nova"
          />
        }
      />

      <SectionTitle>Contato</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="E-mail pessoal"
          error={err("emailPessoal")}
          input={
            <input
              type="email"
              className={cls}
              value={integrante.emailPessoal}
              onChange={(e) => onChange({ emailPessoal: e.target.value })}
              maxLength={FIELD_MAX.emailPessoal}
              placeholder="você@email.com"
            />
          }
        />
        <Field
          label="Telefone celular"
          error={err("telefoneCelular")}
          input={
            <input
              className={cls}
              value={integrante.telefoneCelular}
              onChange={(e) =>
                onChange({ telefoneCelular: formatPhoneBR(e.target.value) })
              }
              maxLength={15}
              inputMode="tel"
              placeholder="(00) 00000-0000"
            />
          }
        />
      </div>

      <SectionTitle>Contato de emergência</SectionTitle>
      <Field
        label="Nome completo"
        error={err("contatoEmergenciaNome")}
        input={
          <input
            className={cls}
            value={integrante.contatoEmergenciaNome}
            onChange={(e) =>
              onChange({ contatoEmergenciaNome: e.target.value })
            }
            maxLength={FIELD_MAX.contatoEmergenciaNome}
            placeholder="Nome de quem chamar em caso de urgência"
          />
        }
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Telefone"
          error={err("contatoEmergenciaTelefone")}
          input={
            <input
              className={cls}
              value={integrante.contatoEmergenciaTelefone}
              onChange={(e) =>
                onChange({
                  contatoEmergenciaTelefone: formatPhoneBR(e.target.value),
                })
              }
              maxLength={15}
              inputMode="tel"
              placeholder="(00) 00000-0000"
            />
          }
        />
        <Field
          label="Parentesco"
          error={err("contatoEmergenciaParentesco")}
          input={
            <select
              className={cls}
              value={integrante.contatoEmergenciaParentesco}
              onChange={(e) =>
                onChange({ contatoEmergenciaParentesco: e.target.value })
              }
            >
              <option value="">Selecione…</option>
              {PARENTESCO_OPCOES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <SectionTitle>Perfil profissional</SectionTitle>
      <Field
        label="Áreas de conhecimento"
        help="Marque pelo menos uma. Não precisa marcar todas."
        error={err("areasConhecimento")}
        input={
          <div className="space-y-2 mt-1">
            {AREAS_CONHECIMENTO.map((area) => {
              const checked = integrante.areasConhecimento.includes(area);
              return (
                <label
                  key={area}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition ${
                    checked
                      ? "border-sol-orange/50 bg-sol-orange/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...integrante.areasConhecimento, area]
                        : integrante.areasConhecimento.filter((x) => x !== area);
                      onChange({ areasConhecimento: next });
                    }}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`mt-0.5 block w-3 h-3 rounded-[0.2rem] border transition shrink-0 ${
                      checked
                        ? "border-sol-orange bg-sol-orange/15"
                        : "border-white/30 bg-white/[0.04]"
                    }`}
                  />
                  <span className="text-xs normal-case tracking-normal font-normal text-white/85 leading-relaxed">
                    {area}
                  </span>
                </label>
              );
            })}
          </div>
        }
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Ocupação atual"
          help="Profissão/cargo/empresa ou curso/instituição"
          error={err("ocupacaoAtual")}
          input={
            <input
              className={cls}
              value={integrante.ocupacaoAtual}
              onChange={(e) => onChange({ ocupacaoAtual: e.target.value })}
              maxLength={FIELD_MAX.ocupacaoAtual}
              placeholder="Ex: Desenvolvedor na Acme / Estudante UFRN"
            />
          }
        />
        <Field
          label="Tempo de experiência"
          error={err("tempoExperiencia")}
          input={
            <select
              className={cls}
              value={integrante.tempoExperiencia}
              onChange={(e) => onChange({ tempoExperiencia: e.target.value })}
            >
              <option value="">Selecione…</option>
              {TEMPO_EXPERIENCIA_OPCOES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <SectionTitle>Formação acadêmica</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Nível de formação"
          error={err("nivelFormacao")}
          input={
            <select
              className={cls}
              value={integrante.nivelFormacao}
              onChange={(e) => onChange({ nivelFormacao: e.target.value })}
            >
              <option value="">Selecione…</option>
              {NIVEIS_FORMACAO.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          }
        />
        {integrante.nivelFormacao && !isEnsMedio && (
          <Field
            label="Curso / Área"
            help="Opcional"
            input={
              <select
                className={cls}
                value={integrante.cursoFormacao}
                onChange={(e) => onChange({ cursoFormacao: e.target.value })}
              >
                <option value="">Selecione (opcional)…</option>
                {CURSOS_AREAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            }
          />
        )}
      </div>
      {integrante.nivelFormacao && (
        <div className="grid md:grid-cols-[1fr_1fr] gap-4">
          <Field
            label="Instituição de ensino"
            help="Digite e selecione da lista — completa UF/município sozinho."
            input={
              <InstituicaoAutocomplete
                value={integrante.instituicao}
                uf={integrante.instituicaoUF}
                municipio={integrante.instituicaoMunicipio}
                nivelFormacao={integrante.nivelFormacao}
                userCidade={integrante.cidade}
                userUf={integrante.estado}
                onChange={(upd) => onChange(upd)}
              />
            }
          />
          <Field
            label="Ano de conclusão"
            help="Opcional. Para formação em andamento, informe a previsão."
            input={
              <input
                className={cls}
                value={integrante.anoFormacao}
                onChange={(e) =>
                  onChange({
                    anoFormacao: e.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
                maxLength={4}
                inputMode="numeric"
                placeholder="2024"
              />
            }
          />
        </div>
      )}
      <Field
        label="Projeto acadêmico relevante (opcional)"
        input={
          <textarea
            className={cls}
            value={integrante.projetoAcademico}
            onChange={(e) => onChange({ projetoAcademico: e.target.value })}
            maxLength={FIELD_MAX.projetoAcademico}
            rows={3}
            placeholder="Ex: TCC em recomendação por IA / iniciação científica em segurança."
          />
        }
      />
      <div className="grid md:grid-cols-3 gap-4">
        <Field
          label="LinkedIn (opcional)"
          input={
            <input
              className={cls}
              value={integrante.linkedin}
              onChange={(e) => onChange({ linkedin: e.target.value })}
              maxLength={FIELD_MAX.linkedin}
              placeholder="https://linkedin.com/in/seu-perfil"
            />
          }
        />
        <Field
          label="Portfólio (opcional)"
          input={
            <input
              className={cls}
              value={integrante.portfolio}
              onChange={(e) => onChange({ portfolio: e.target.value })}
              maxLength={FIELD_MAX.portfolio}
              placeholder="https://github.com/seu-usuario"
            />
          }
        />
        <Field
          label="Outras redes (opcional)"
          input={
            <input
              className={cls}
              value={integrante.outrasRedes}
              onChange={(e) => onChange({ outrasRedes: e.target.value })}
              maxLength={FIELD_MAX.outrasRedes}
              placeholder="Instagram, X, Bluesky, etc."
            />
          }
        />
      </div>
      <Field
        label="Experiência relevante"
        help="Conte rapidamente onde você se destaca"
        error={err("experienciaRelevante")}
        input={
          <textarea
            className={cls}
            value={integrante.experienciaRelevante}
            onChange={(e) => onChange({ experienciaRelevante: e.target.value })}
            maxLength={FIELD_MAX.experienciaRelevante}
            rows={4}
            placeholder="Onde já trabalhou, projetos que orgulha, tecnologias que domina."
          />
        }
      />

      <SectionTitle>Saúde e acessibilidade</SectionTitle>
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Restrições alimentares"
          input={
            <input
              className={cls}
              value={integrante.restricoesAlimentares}
              onChange={(e) =>
                onChange({ restricoesAlimentares: e.target.value })
              }
              maxLength={FIELD_MAX.restricoesAlimentares}
              placeholder="Ex: vegetariano, intolerante a lactose"
            />
          }
        />
        <Field
          label="Alergias"
          input={
            <input
              className={cls}
              value={integrante.alergias}
              onChange={(e) => onChange({ alergias: e.target.value })}
              maxLength={FIELD_MAX.alergias}
              placeholder="Quais? Ex: alergia a abelha, asma"
            />
          }
        />
        <Field
          label="Medicamentos contínuos (opcional)"
          input={
            <input
              className={cls}
              value={integrante.medicamentos}
              onChange={(e) => onChange({ medicamentos: e.target.value })}
              maxLength={FIELD_MAX.medicamentos}
              placeholder="Quais? Ex: insulina"
            />
          }
        />
        <Field
          label="Acessibilidade"
          input={
            <input
              className={cls}
              value={integrante.acessibilidade}
              onChange={(e) => onChange({ acessibilidade: e.target.value })}
              maxLength={FIELD_MAX.acessibilidade}
              placeholder="Cadeirante, deficiência visual, etc."
            />
          }
        />
      </div>
      <Field
        label="Outras observações (opcional)"
        input={
          <textarea
            className={cls}
            value={integrante.outrasObservacoes}
            onChange={(e) => onChange({ outrasObservacoes: e.target.value })}
            maxLength={FIELD_MAX.outrasObservacoes}
            rows={2}
          />
        }
      />
      <Field
        label="Como soube do evento"
        error={err("comoSoube")}
        input={
          <select
            className={cls}
            value={integrante.comoSoube}
            onChange={(e) => onChange({ comoSoube: e.target.value })}
          >
            <option value="">Selecione…</option>
            {COMO_SOUBE_OPCOES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        }
      />

      <SectionTitle>Termos de aceite individuais</SectionTitle>
      <p className="text-xs text-white/55 -mt-2 normal-case tracking-normal font-normal">
        Leia abaixo as cláusulas individuais. Ao marcar a caixa no fim, você
        aceita <strong>todas</strong> de uma vez.
      </p>
      <BundleAceiteBlock
        items={ACEITES_INDIVIDUAIS}
        allChecked={ACEITES_INDIVIDUAIS.every(
          (a) => integrante.aceites[a.key] === true
        )}
        onToggleAll={(v) => {
          ACEITES_INDIVIDUAIS.forEach((a) => onToggleAceite(a.key, v));
        }}
        hasError={ACEITES_INDIVIDUAIS.some(
          (a) => !!errors[`aceite.${a.key}`]
        )}
      />
    </div>
  );
}

// ============================================================================
// STEP 2 — TRILHA + ACEITE DE FORMAÇÃO
// ============================================================================

function StepTrilha({
  trilhaPreferida,
  aceiteFormacao,
  errors,
  onChangeTrilha,
  onChangeAceite,
}: {
  trilhaPreferida: string;
  aceiteFormacao: boolean;
  errors: Record<string, string>;
  onChangeTrilha: (t: string) => void;
  onChangeAceite: (v: boolean) => void;
}) {
  return (
    <div className="space-y-8">
      <SectionTitle>Trilha de preferência</SectionTitle>
      <p className="text-white/70 text-sm -mt-2 mb-4">
        Escolha a trilha que mais combina com o que você quer construir. A
        organização pode realocar entre trilhas para equilibrar as 3.
      </p>
      <div className="space-y-3">
        {TRILHAS.map((t) => {
          const checked = trilhaPreferida === t;
          return (
            <label
              key={t}
              className={`block rounded-xl border px-4 py-4 cursor-pointer transition ${
                checked
                  ? "border-sol-orange/60 bg-sol-orange/[0.08]"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="trilha"
                  checked={checked}
                  onChange={() => onChangeTrilha(t)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`mt-1 block w-3.5 h-3.5 rounded-full border transition shrink-0 ${
                    checked
                      ? "border-sol-orange bg-sol-orange/30"
                      : "border-white/30 bg-white/[0.04]"
                  }`}
                />
                <div className="normal-case tracking-normal font-normal">
                  <div className="font-display font-semibold text-white">
                    {t}
                  </div>
                  <div className="text-sm text-white/70 mt-1 leading-relaxed">
                    {TRILHAS_DESCRICAO[t]}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {errors.trilhaPreferida && (
        <p className="text-red-300 text-xs">{errors.trilhaPreferida}</p>
      )}

      <SectionTitle>Aceite específico — formação de equipe</SectionTitle>
      {/* Mesmo padrão visual do AceiteCheckbox do fluxo de equipe: laranja
          do site (sol-orange) + ícone V dentro do quadradinho quando marcado. */}
      <div>
        <label
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer group select-none transition ${
            aceiteFormacao
              ? "border-sol-orange/40 bg-sol-orange/[0.06]"
              : errors.aceiteFormacaoEquipe
                ? "border-red-400/40 bg-red-400/[0.04]"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
          }`}
        >
          <span className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={aceiteFormacao}
              onChange={(e) => onChangeAceite(e.target.checked)}
              className="peer sr-only"
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
          <span className="min-w-0">
            <span className="block text-sm font-medium text-white/90 leading-snug">
              {ACEITE_INDIVIDUAL_FORMACAO_EQUIPE.titulo}
            </span>
            <span className="block mt-1 text-xs text-white/65 leading-relaxed normal-case tracking-normal font-normal">
              {ACEITE_INDIVIDUAL_FORMACAO_EQUIPE.texto}
            </span>
          </span>
        </label>
        {errors.aceiteFormacaoEquipe && (
          <p className="text-red-300 text-xs mt-1">
            {errors.aceiteFormacaoEquipe}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3 — CONFIRMAÇÃO
// ============================================================================

function StepConfirmacao({ state, previewMode }: { state: InscricaoIndividualState; previewMode: boolean }) {
  const i = state.integrante;
  const aceitesIndividuaisOk = useMemo(() => {
    return ACEITES_INDIVIDUAIS.filter((a) => i.aceites[a.key] === true).length;
  }, [i.aceites]);

  const Row = ({ k, v }: { k: string; v: string | number }) => (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 border-b border-white/[0.06] text-sm">
      <div className="text-white/55">{k}</div>
      <div className="text-white/90">{v || "—"}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Confirme seus dados</SectionTitle>
        <p className="text-white/70 text-sm -mt-2 mb-4">
          Revise antes de enviar. Você pode voltar pra editar qualquer etapa.
        </p>
      </div>

      <div className="card">
        <h4 className="font-display font-semibold mb-3">Identificação</h4>
        <Row k="Nome" v={i.nomeCompleto} />
        <Row k="CPF" v={i.cpf} />
        <Row k="RG" v={i.rg} />
        <Row k="Nascimento" v={i.dataNascimento} />
        <Row k="Gênero" v={i.genero} />
        <Row k="E-mail" v={i.emailPessoal} />
        <Row k="Telefone" v={i.telefoneCelular} />
      </div>

      <div className="card">
        <h4 className="font-display font-semibold mb-3">Endereço</h4>
        <Row
          k="Endereço"
          v={`${i.logradouro || ""}, ${i.numero || ""} ${
            i.complemento ? "— " + i.complemento : ""
          }`}
        />
        <Row k="Bairro" v={i.bairro} />
        <Row k="Cidade/UF" v={`${i.cidade || "—"}/${i.estado || "—"}`} />
        <Row k="CEP" v={i.cep} />
      </div>

      <div className="card">
        <h4 className="font-display font-semibold mb-3">Perfil</h4>
        <Row k="Áreas" v={i.areasConhecimento.join(", ")} />
        <Row k="Ocupação" v={i.ocupacaoAtual} />
        <Row k="Experiência" v={i.tempoExperiencia} />
        <Row k="Formação" v={i.nivelFormacao} />
        {i.cursoFormacao && <Row k="Curso" v={i.cursoFormacao} />}
        {i.instituicao && <Row k="Instituição" v={i.instituicao} />}
      </div>

      <div className="card">
        <h4 className="font-display font-semibold mb-3">Inscrição</h4>
        <Row k="Trilha" v={state.trilhaPreferida} />
        <Row k="Aceites individuais" v={`${aceitesIndividuaisOk}/9`} />
        <Row
          k="Formação equipe"
          v={state.aceiteFormacaoEquipe ? "Autorizado ✓" : "Pendente"}
        />
      </div>

      {previewMode && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
          <strong>Modo preview:</strong> ao clicar em &ldquo;Enviar
          inscrição&rdquo;, nada vai pro servidor real (rota dev-only
          /preview/inscricao). Em produção a inscrição vai pra planilha.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ValidationToast — popup que aparece no topo da tela quando user tenta
// avançar com erros de validação. Copiado fielmente do fluxo de equipe.
// ============================================================================
function ValidationToast({
  count,
  onDismiss,
}: {
  count: number;
  onDismiss: () => void;
}) {
  const titulo =
    count === 1
      ? "1 campo precisa de atenção"
      : `${count} campos precisam de atenção`;
  return (
    <div
      role="alert"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] animate-validation-toast-in"
    >
      <div className="rounded-xl border border-red-400/40 bg-red-950/95 backdrop-blur-sm text-white px-4 py-3 shadow-2xl shadow-red-950/30 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-200 shrink-0 font-semibold text-xs"
        >
          !
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold normal-case tracking-normal leading-snug">
            {titulo}
          </p>
          <p className="mt-0.5 text-xs text-red-100/80 normal-case tracking-normal font-normal leading-relaxed">
            Os campos com problema estão destacados em vermelho — role pra ver
            e corrigir.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="text-red-200/70 hover:text-white shrink-0 text-lg leading-none -mt-0.5"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// BundleAceiteBlock — caixa rolável com todas as cláusulas + 1 checkbox que
// aceita todas de uma vez. Copiado fielmente do fluxo de equipe pra manter
// consistência visual entre os 2 modos de inscrição.
// ============================================================================
function BundleAceiteBlock({
  items,
  allChecked,
  onToggleAll,
  hasError,
}: {
  items: ReadonlyArray<{ key: string; titulo: string; texto: string }>;
  allChecked: boolean;
  onToggleAll: (v: boolean) => void;
  hasError: boolean;
}) {
  return (
    <div>
      <div
        className={`rounded-xl border overflow-hidden relative ${
          hasError
            ? "border-red-400/40 bg-red-400/[0.03]"
            : "border-white/10 bg-white/[0.03]"
        }`}
      >
        {/* Header com instrução clara de que rola */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-2">
          <span className="text-[0.6875rem] font-mono uppercase tracking-[0.18em] font-semibold text-sol-orange/90">
            ↓ Role pra ler todas as {items.length} cláusulas
          </span>
        </div>

        {/* Scroll com as cláusulas — `data-lenis-prevent` libera o scroll
            nativo dentro desse box (senão o Lenis global intercepta o wheel
            e a caixa não rola); `overscroll-contain` impede o scroll de
            vazar pra página ao chegar no fim da lista. */}
        <div
          data-lenis-prevent
          className="max-h-96 overflow-y-auto overscroll-contain px-5 py-4 space-y-5 bundle-aceite-scroll"
        >
          {items.map((a, idx) => (
            <div key={a.key}>
              <p className="text-sm font-semibold text-white/95 mb-1.5 leading-snug normal-case tracking-normal">
                <span className="text-sol-orange/70 mr-1.5">{idx + 1}.</span>
                {a.titulo}
              </p>
              <p className="text-sm text-white/75 leading-relaxed normal-case tracking-normal font-normal">
                {a.texto}
              </p>
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-px h-10 bottom-[3.25rem] bg-gradient-to-b from-transparent via-transparent to-black/30"
        />

        {/* Footer fixo com o checkbox único */}
        <label className="flex items-start gap-3 cursor-pointer group select-none border-t border-white/10 bg-white/[0.04] px-4 py-3">
          <span className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="peer sr-only"
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
          <span className="text-sm font-medium normal-case tracking-normal text-white/90 leading-relaxed">
            Li, compreendi e aceito todas as cláusulas acima.
          </span>
        </label>
      </div>
      {hasError && (
        <p data-field-error="true" className="text-red-300 text-xs mt-2">
          Você precisa aceitar todas as cláusulas pra continuar.
        </p>
      )}
    </div>
  );
}
