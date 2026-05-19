"use client";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  Layers,
  User,
  Lightbulb,
  ShieldCheck,
  Send,
} from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useSession, signOut } from "next-auth/react";
import {
  ACEITES_COLETIVOS,
  ACEITES_INDIVIDUAIS,
  ACEITE_LIDER,
  AREAS_CONHECIMENTO,
  COMO_SOUBE_OPCOES,
  CURSOS_AREAS,
  EquipeState,
  FIELD_MAX,
  GENEROS,
  INITIAL_FORM_STATE,
  InscricaoFormState,
  IntegranteState,
  LiderConfirmacaoState,
  NIVEIS_FORMACAO,
  PARENTESCO_OPCOES,
  PropostaState,
  TEMPO_EXPERIENCIA_OPCOES,
  StepErrors,
  TRILHAS,
  TRILHAS_DESCRICAO,
  UFS,
  formatCPF,
  formatPhoneBR,
  validateAceitesColetivos,
  validateEquipe,
  validateIntegrante,
  validateLiderConfirmacao,
  validateProposta,
  validateTrilha,
} from "@/lib/inscricao-schema";
import { searchIES } from "@/lib/ies-data";
import { searchEscolas } from "@/lib/escolas-data";
import MagneticButton from "./MagneticButton";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// Chave do rascunho no localStorage. Versionada — se o schema mudar, basta
// bumpar o sufixo pra invalidar rascunhos antigos sem migration.
// v2 (2026-05-14): removeu `telefoneAlternativo`, adicionou `outrasRedes` e
// `medicamentos`. Rascunhos v1 ficariam com `outrasRedes: undefined` e
// crashariam em `.trim()`.
// v3 (2026-05-14): proposta fundida de 6 → 4 campos. Drafts v2 com `resumo`,
// `problema`, `publico`, `diferencial` quebrariam.
// v4 (2026-05-18): `formacaoAcademica` (string única) substituída por
// `nivelFormacao` + `cursoFormacao` + `anoFormacao` + `instituicao` +
// `instituicaoUF` + `instituicaoMunicipio` + `projetoAcademico`. Drafts v3
// teriam o campo antigo que não existe mais.
const DRAFT_KEY = "hackathon-sol-inscricao-draft-v4";

// =============================================================================
// DEV AUTOFILL — atalho pra preencher o form inteiro com dados válidos durante
// dev. Só aparece quando `NODE_ENV !== "production"`. Em build de produção,
// `isDev` vira `false` em compile-time e o botão (+ toda a função
// `createTestState`) é eliminado via dead-code elimination do Next.
// =============================================================================
const isDev = process.env.NODE_ENV !== "production";

// CPFs válidos (com dígitos verificadores) usados só pra testes.
const TEST_CPFS = [
  "123.456.789-09",
  "987.654.321-00",
  "111.444.777-35",
  "529.982.247-25",
];

function createTestIntegrante(n: number): IntegranteState {
  return {
    nomeCompleto: `Integrante Teste ${n}`,
    nomeSocial: "",
    cpf: TEST_CPFS[n - 1]!,
    rg: `12.345.67${n} SSP/RN`,
    dataNascimento: "2000-01-15",
    nacionalidade: "Brasileira",
    naturalidade: "Natal/RN",
    cidade: "Natal",
    estado: "RN",
    enderecoCompleto: "Rua Teste, 123, Tirol, Natal/RN, 59000-000",
    emailPessoal: `test+${n}@gmail.com`,
    telefoneCelular: `(84) 99999-000${n}`,
    contatoEmergenciaNome: `Contato Emergência ${n}`,
    contatoEmergenciaTelefone: `(84) 98888-000${n}`,
    contatoEmergenciaParentesco: n === 1 ? "Mãe" : n === 2 ? "Pai" : n === 3 ? "Irmão(ã)" : "Cônjuge",
    genero: GENEROS[0],
    areasConhecimento: [AREAS_CONHECIMENTO[0]],
    ocupacaoAtual: `Desenvolvedor(a) ${n}`,
    tempoExperiencia: "2 a 5 anos",
    nivelFormacao: "Graduação completa",
    cursoFormacao: "Ciência da Computação / Engenharia de Software",
    anoFormacao: "2022",
    instituicao: "Universidade Federal do Rio Grande do Norte (UFRN)",
    instituicaoUF: "RN",
    instituicaoMunicipio: "Natal",
    projetoAcademico: `Projeto de TCC sobre teste ${n} — ainda em revisão.`,
    linkedin: `https://linkedin.com/in/teste-${n}`,
    portfolio: `https://github.com/teste-${n}`,
    outrasRedes: "",
    experienciaRelevante:
      "Experiência relevante de teste em diversos projetos importantes nos últimos anos, contribuindo com soluções escaláveis.",
    restricoesAlimentares: "Nenhuma",
    alergias: "Nenhuma",
    medicamentos: "Nenhum",
    acessibilidade: "Nenhuma",
    outrasObservacoes: "",
    comoSoube: COMO_SOUBE_OPCOES[0],
    aceites: ACEITES_INDIVIDUAIS.reduce<Record<string, boolean>>((acc, a) => {
      acc[a.key] = true;
      return acc;
    }, {}),
  };
}

function createTestState(): InscricaoFormState {
  const integrantes = [
    createTestIntegrante(1),
    createTestIntegrante(2),
    createTestIntegrante(3),
    createTestIntegrante(4),
  ] as InscricaoFormState["integrantes"];

  return {
    equipe: {
      nome: "Equipe de Teste",
      slogan: "Construindo o futuro com IA",
      cidade: "Natal",
      estado: "RN",
      emailOficial: "equipe-teste@gmail.com",
      telefone: "(84) 99999-0000",
      trilha: TRILHAS[0],
      liderIndex: 0,
    },
    integrantes,
    proposta: {
      ideiaDiferencial:
        "Vamos criar uma plataforma que conecta turistas a guias locais com perfis verificados, integrando IA pra recomendar roteiros personalizados baseado em interesses, clima e disponibilidade. Diferencial: curadoria por IA + verificação por avaliações reais + integração direta com pequenos prestadores locais excluídos das plataformas tradicionais.",
      problemaPublico:
        "Turistas têm dificuldade em encontrar experiências autênticas e guias confiáveis no RN, e pequenos prestadores locais não têm visibilidade digital. Beneficiados: turistas nacionais e estrangeiros visitando o Rio Grande do Norte, e guias/operadores locais.",
      aderencia:
        "A solução se conecta diretamente à trilha de turismo inteligente do RN, ampliando o acesso a experiências locais autênticas.",
      tecnologias: "Next.js, Postgres, Claude para personalização, Vercel, Stripe.",
    },
    aceitesColetivos: ACEITES_COLETIVOS.reduce<Record<string, boolean>>(
      (acc, a) => {
        acc[a.key] = true;
        return acc;
      },
      {}
    ),
    liderConfirmacao: {
      nomeConfirmacao: "Integrante Teste 1",
      cpfConfirmacao: TEST_CPFS[0]!,
      aceiteFinal: true,
    },
  };
}

// =============================================================================
// CONFIGURAÇÃO DAS ETAPAS
// -----------------------------------------------------------------------------
// Cada etapa tem um label curto (pra barra de progresso), um ícone e um
// validador. O integrante (steps 2-5) usa o mesmo validador parametrizado por
// índice — o array é montado dinamicamente dentro do componente.
// =============================================================================

type StepDef = {
  label: string;
  icon: typeof Users;
  validate: (state: InscricaoFormState) => StepErrors;
};

function buildSteps(): StepDef[] {
  const intStep = (idx: number): StepDef => ({
    label: `Integrante ${idx + 1}`,
    icon: User,
    validate: (s) =>
      validateIntegrante(
        s.integrantes[idx]!,
        s.integrantes.map((i) => i.cpf),
        idx
      ),
  });
  return [
    { label: "Equipe", icon: Users, validate: (s) => validateEquipe(s.equipe) },
    { label: "Trilha", icon: Layers, validate: (s) => validateTrilha(s.equipe) },
    intStep(0),
    intStep(1),
    intStep(2),
    intStep(3),
    {
      label: "Proposta",
      icon: Lightbulb,
      validate: (s) => validateProposta(s.proposta),
    },
    {
      label: "Aceites",
      icon: ShieldCheck,
      validate: (s) => validateAceitesColetivos(s.aceitesColetivos),
    },
    {
      label: "Líder",
      icon: Send,
      validate: (s) =>
        validateLiderConfirmacao(
          s.liderConfirmacao,
          s.integrantes[s.equipe.liderIndex]!
        ),
    },
  ];
}

const STEPS = buildSteps();

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================

export default function Inscricao() {
  const [state, setState] = useState<InscricaoFormState>(INITIAL_FORM_STATE);
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<StepErrors>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  // Toast de validação: aparece quando user tenta avançar com erros. `key`
  // é timestamp pra forçar re-render/re-animação mesmo se a contagem for igual.
  const [validationToast, setValidationToast] = useState<{
    count: number;
    key: number;
  } | null>(null);
  // Toast verde de sucesso quando a inscrição é enviada com sucesso.
  const [successToast, setSuccessToast] = useState<{ key: number } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  // Sinaliza que o effect de restore já rodou. Necessário pra orquestrar o
  // pre-fill via Google sem race condition (o pre-fill espera o draft terminar).
  const [draftChecked, setDraftChecked] = useState(false);
  const { data: session } = useSession();
  const messageRef = useRef<HTMLDivElement | null>(null);
  // Cache de cidades do IBGE por UF — evita rede repetida quando o usuário
  // troca de UF e volta. Compartilhado entre todos os selects de cidade do form.
  const cacheCidadesRef = useRef<Record<string, string[]>>({});

  // Restore draft on mount — tenta localStorage primeiro (instantâneo) e em
  // paralelo busca do servidor (Upstash). Se localStorage tava vazio E o
  // servidor tem rascunho, restaura do servidor — é o que cobre o cenário
  // "comecei no celular, abri no notebook". Se localStorage tinha rascunho,
  // ignora o do servidor (assume que o que tá local é o mais recente, já
  // que escrevemos no servidor com debounce).
  useEffect(() => {
    let localHadDraft = false;
    try {
      localStorage.removeItem("hackathon-sol-inscricao-draft-v1");
      localStorage.removeItem("hackathon-sol-inscricao-draft-v2");

      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as InscricaoFormState;
        if (parsed && parsed.equipe && Array.isArray(parsed.integrantes)) {
          setState(parsed);
          setDraftRestored(true);
          localHadDraft = true;
          window.setTimeout(() => setDraftRestored(false), 6000);
        }
      }
    } catch {
      // localStorage indisponível (modo privado, quota cheia) — segue.
    }

    // Fetch do servidor — só tenta se temos sessão (mesmo que ainda não
    // tenha chegado no client, o cookie já tá presente, então a request
    // já é autenticada). O endpoint retorna 401 sem sessão; tratamos como
    // "sem rascunho remoto" e seguimos.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/draft", {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          draft?: InscricaoFormState | null;
        };
        if (cancelled) return;
        if (
          data.draft &&
          !localHadDraft &&
          data.draft.equipe &&
          Array.isArray(data.draft.integrantes)
        ) {
          setState(data.draft);
          setDraftRestored(true);
          window.setTimeout(() => setDraftRestored(false), 6000);
        }
      } catch {
        /* servidor indisponível — segue com o que tem no localStorage */
      } finally {
        if (!cancelled) setDraftChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fill do e-mail do líder + e-mail oficial da equipe com o Google do
  // usuário autenticado. Roda só depois do draft restore (pra não sobrescrever
  // valor salvo) e só preenche se o campo estiver vazio (respeita edição
  // manual: se a pessoa quiser usar outro e-mail, é só apagar e digitar).
  useEffect(() => {
    if (!draftChecked) return;
    const email = session?.user?.email;
    if (!email) return;
    setState((s) => {
      const lider = s.integrantes[0]!;
      const needsEquipeEmail = !s.equipe.emailOficial;
      const needsLiderEmail = !lider.emailPessoal;
      if (!needsEquipeEmail && !needsLiderEmail) return s;
      const nextIntegrantes = needsLiderEmail
        ? ([
            { ...lider, emailPessoal: email },
            ...s.integrantes.slice(1),
          ] as InscricaoFormState["integrantes"])
        : s.integrantes;
      return {
        ...s,
        equipe: needsEquipeEmail
          ? { ...s.equipe, emailOficial: email }
          : s.equipe,
        integrantes: nextIntegrantes,
      };
    });
  }, [draftChecked, session]);

  // Persist on every state change. localStorage é síncrono e instantâneo —
  // proteção primária contra F5/fechar aba. Servidor recebe via debounce
  // (2s) — backup pra cross-device. Não bloqueia nada no caminho crítico.
  useEffect(() => {
    if (!draftChecked) return; // não sobrescreve antes do restore terminar
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode */
    }

    const id = window.setTimeout(() => {
      fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
        credentials: "include",
        keepalive: true,
      }).catch(() => {
        /* network blip — próxima edição tenta de novo */
      });
    }, 2000);
    return () => window.clearTimeout(id);
  }, [state, draftChecked]);

  // Scroll into view do header da etapa — disparado direto no click de
  // Continuar/Voltar (ver goNext/goBack abaixo). Antes era um useEffect em
  // [step], mas isso também disparava no mount inicial (e em strict mode
  // duplicado), jogando o usuário direto no form na primeira visita.
  const stepHeaderRef = useRef<HTMLDivElement | null>(null);
  const scrollStepIntoView = () => {
    // setTimeout 0 pra esperar o React renderizar a nova etapa antes do scroll.
    window.setTimeout(() => {
      stepHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };
  useEffect(() => {
    if (submitStatus === "success" || submitStatus === "error") {
      messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [submitStatus]);

  const currentStep = STEPS[step]!;
  const isLastStep = step === STEPS.length - 1;

  // Auto-dismiss do toast de validação após 5s. `key` muda a cada disparo
  // pra resetar o timer mesmo se o toast já tava aberto.
  useEffect(() => {
    if (!validationToast) return;
    const id = window.setTimeout(() => setValidationToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [validationToast]);

  // Auto-dismiss do toast verde de sucesso após 8s (mais tempo pra ler,
  // já que é a mensagem final do fluxo).
  useEffect(() => {
    if (!successToast) return;
    const id = window.setTimeout(() => setSuccessToast(null), 8000);
    return () => window.clearTimeout(id);
  }, [successToast]);

  // Quando bate erro, mostra toast + rola pro primeiro campo com erro pra
  // o usuário ver onde tá o problema. O DOM precisa renderizar os erros
  // antes do scroll, então usa setTimeout(0) pra esperar próximo frame.
  const triggerValidationToast = (errorCount: number) => {
    setValidationToast({ count: errorCount, key: Date.now() });
    window.setTimeout(() => {
      const firstError = document.querySelector(
        '[data-field-error="true"]'
      ) as HTMLElement | null;
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

  const goNext = () => {
    const errs = currentStep.validate(state);
    setStepErrors(errs);
    const errCount = Object.keys(errs).length;
    if (errCount === 0) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      scrollStepIntoView();
    } else {
      triggerValidationToast(errCount);
    }
  };
  const goBack = () => {
    setStepErrors({});
    setStep((s) => Math.max(s - 1, 0));
    scrollStepIntoView();
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    // Valida a etapa final primeiro
    const errs = currentStep.validate(state);
    if (!turnstileToken) {
      errs.robot = "Confirme que você não é um robô.";
    }
    setStepErrors(errs);
    const errCount = Object.keys(errs).length;
    if (errCount > 0) {
      triggerValidationToast(errCount);
      return;
    }

    setSubmitStatus("loading");
    setSubmitMessage("");

    // Honeypot
    const honeypotInput = (ev.currentTarget as HTMLFormElement).elements.namedItem(
      "website"
    ) as HTMLInputElement | null;
    const honeypot = honeypotInput?.value ?? "";

    try {
      const res = await fetch("/api/inscricao", {
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
        setSubmitMessage(
          result.message ||
            "Inscrição da equipe recebida! Cada integrante vai receber um e-mail de confirmação."
        );
        setSuccessToast({ key: Date.now() });
        // Limpa o rascunho — submissão bem-sucedida, não tem motivo pra manter
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* */
        }
        fetch("/api/draft", { method: "DELETE", credentials: "include" }).catch(
          () => {
            /* */
          }
        );
      } else {
        setSubmitStatus("error");
        setSubmitMessage(
          result.message ||
            "Não foi possível enviar a inscrição. Verifique os dados e tente novamente."
        );
        // Token Turnstile é single-use — reseta pra próxima tentativa
        setTurnstileToken(null);
        turnstileRef.current?.reset();
      }
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("Erro de conexão. Verifique sua internet e tente novamente.");
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  };

  // Helpers de update — patch parcial em equipe/integrante/proposta/etc.
  const updateEquipe = (patch: Partial<EquipeState>) =>
    setState((s) => ({ ...s, equipe: { ...s.equipe, ...patch } }));
  const updateIntegrante = (idx: number, patch: Partial<IntegranteState>) =>
    setState((s) => {
      const next = [...s.integrantes] as InscricaoFormState["integrantes"];
      next[idx] = { ...next[idx]!, ...patch };
      return { ...s, integrantes: next };
    });
  const toggleAceiteIntegrante = (idx: number, key: string, v: boolean) =>
    setState((s) => {
      const next = [...s.integrantes] as InscricaoFormState["integrantes"];
      next[idx] = {
        ...next[idx]!,
        aceites: { ...next[idx]!.aceites, [key]: v },
      };
      return { ...s, integrantes: next };
    });
  const updateProposta = (patch: Partial<PropostaState>) =>
    setState((s) => ({ ...s, proposta: { ...s.proposta, ...patch } }));
  const toggleAceiteColetivo = (key: string, v: boolean) =>
    setState((s) => ({
      ...s,
      aceitesColetivos: { ...s.aceitesColetivos, [key]: v },
    }));
  const updateLiderConfirmacao = (patch: Partial<LiderConfirmacaoState>) =>
    setState((s) => ({
      ...s,
      liderConfirmacao: { ...s.liderConfirmacao, ...patch },
    }));

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
      {successToast && (
        <SuccessToast
          key={successToast.key}
          onDismiss={() => setSuccessToast(null)}
        />
      )}
      <form
        onSubmit={submit}
        noValidate
        className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 md:p-8 space-y-5 overflow-hidden"
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[0.125rem] bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink"
        />
        <div
          aria-hidden
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-sol-orange/8 blur-3xl pointer-events-none"
        />
        {/* Honeypot — escondido visualmente E pra leitor de tela. Bots
            preenchem, humanos não chegam aqui. */}
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

        <div ref={stepHeaderRef} />
        {isDev && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-normal normal-case tracking-normal text-amber-200">
            <span>🧪 DEV</span>
            <button
              type="button"
              onClick={() => {
                setState(createTestState());
                setStep(STEPS.length - 1);
                setStepErrors({});
                setSubmitStatus("idle");
                setSubmitMessage("");
              }}
              className="ml-auto underline underline-offset-2 hover:text-amber-100"
            >
              Preencher tudo + pular pra última etapa
            </button>
            <button
              type="button"
              onClick={() => {
                setState(INITIAL_FORM_STATE);
                setStep(0);
                setStepErrors({});
                setSubmitStatus("idle");
                setSubmitMessage("");
                try {
                  localStorage.removeItem(DRAFT_KEY);
                } catch {
                  /* ignore */
                }
                fetch("/api/draft", {
                  method: "DELETE",
                  credentials: "include",
                }).catch(() => {
                  /* */
                });
              }}
              className="underline underline-offset-2 hover:text-amber-100"
            >
              Resetar
            </button>
          </div>
        )}
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

        <ProgressBar current={step} total={STEPS.length} steps={STEPS} />

        {draftRestored && (
          <div className="rounded-lg border border-sol-orange/30 bg-sol-orange/10 text-sol-orange px-4 py-2 text-xs">
            ↺ Rascunho restaurado do navegador. Continue de onde parou.
          </div>
        )}

        {/* Renderização da etapa atual */}
        {step === 0 && (
          <EquipeStep
            equipe={state.equipe}
            onChange={updateEquipe}
            errors={stepErrors}
            cacheCidades={cacheCidadesRef.current}
          />
        )}
        {step === 1 && (
          <TrilhaStep
            equipe={state.equipe}
            onChange={updateEquipe}
            errors={stepErrors}
          />
        )}
        {step >= 2 && step <= 5 && (
          <IntegranteStep
            idx={step - 2}
            isLider={state.equipe.liderIndex === step - 2}
            integrante={state.integrantes[step - 2]!}
            onChange={(p) => updateIntegrante(step - 2, p)}
            onToggleAceite={(k, v) => toggleAceiteIntegrante(step - 2, k, v)}
            errors={stepErrors}
            cacheCidades={cacheCidadesRef.current}
          />
        )}
        {step === 6 && (
          <PropostaStep
            proposta={state.proposta}
            onChange={updateProposta}
            errors={stepErrors}
          />
        )}
        {step === 7 && (
          <AceitesColetivosStep
            aceites={state.aceitesColetivos}
            onToggle={toggleAceiteColetivo}
            errors={stepErrors}
          />
        )}
        {step === 8 && (
          <LiderConfirmacaoStep
            lider={state.integrantes[state.equipe.liderIndex]!}
            confirmacao={state.liderConfirmacao}
            onChange={updateLiderConfirmacao}
            errors={stepErrors}
            turnstileRef={turnstileRef}
            turnstileToken={turnstileToken}
            onTurnstileToken={(t) => {
              setTurnstileToken(t);
              setStepErrors((e) => {
                const { robot: _r, ...rest } = e;
                return rest;
              });
            }}
          />
        )}

        {/* Navegação inferior */}
        <div className="flex items-center gap-3 pt-2">
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={submitStatus === "loading"}
              className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              Voltar
            </button>
          )}
          <span className="text-[0.6875rem] tracking-normal normal-case font-normal text-white/40 ml-auto">
            Etapa {step + 1} de {STEPS.length}
          </span>
          {!isLastStep ? (
            <button
              type="button"
              onClick={goNext}
              className="btn-primary group inline-flex items-center"
            >
              <span className="relative z-10">Continuar</span>
              <ArrowRight
                className="relative z-10 w-4 h-4 ml-2 transition-transform group-hover:translate-x-1"
                strokeWidth={2.5}
              />
            </button>
          ) : (
            <MagneticButton strength={10} radius={120}>
              <button
                type="submit"
                disabled={submitStatus === "loading"}
                className="btn-primary group inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="relative z-10">
                  {submitStatus === "loading" ? "Enviando..." : "Enviar inscrição"}
                </span>
                {submitStatus !== "loading" && (
                  <Send
                    className="relative z-10 w-4 h-4 ml-2"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            </MagneticButton>
          )}
        </div>

        {stepErrors.robot && (
          <p className="text-red-300 text-xs">{stepErrors.robot}</p>
        )}

        {submitStatus === "success" && (
          <div
            ref={messageRef}
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 px-4 py-3 text-sm"
          >
            ✓ {submitMessage}
          </div>
        )}
        {submitStatus === "error" && (
          <div
            ref={messageRef}
            className="rounded-xl border border-red-400/30 bg-red-400/10 text-red-200 px-4 py-3 text-sm"
          >
            ✕ {submitMessage}
          </div>
        )}
      </form>
    </section>
  );
}

// =============================================================================
// PROGRESS BAR + STEP HEADER
// =============================================================================

function ProgressBar({
  current,
  total,
  steps,
}: {
  current: number;
  total: number;
  steps: StepDef[];
}) {
  const pct = ((current + 1) / total) * 100;
  const Icon = steps[current]!.icon;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-sol-orange/15 border border-sol-orange/30 text-sol-orange">
          <Icon className="w-4 h-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-sol-orange/90 font-semibold">
            {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </div>
          <div className="text-base font-semibold text-white truncate">
            {steps[current]!.label}
          </div>
        </div>
      </div>
      <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-sol-yellow via-sol-orange to-sol-pink transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// STEP 0 — EQUIPE
// =============================================================================

function EquipeStep({
  equipe,
  onChange,
  errors,
  cacheCidades,
}: {
  equipe: EquipeState;
  onChange: (p: Partial<EquipeState>) => void;
  errors: StepErrors;
  cacheCidades: Record<string, string[]>;
}) {
  return (
    <div className="space-y-4">
      <Intro>
        Preencha os dados gerais da equipe. Esses dados aparecem como
        identificação principal e ponto de contato com a organização.
      </Intro>

      <Field
        label="Nome da equipe"
        error={errors.nome}
        input={
          <input
            value={equipe.nome}
            onChange={(e) => onChange({ nome: e.target.value })}
            placeholder="Algo curto e memorável"
            maxLength={FIELD_MAX.equipeNome}
          />
        }
      />

      <Field
        label="Slogan ou mote (opcional)"
        input={
          <input
            value={equipe.slogan}
            onChange={(e) => onChange({ slogan: e.target.value })}
            placeholder="Frase de efeito da equipe"
            maxLength={FIELD_MAX.equipeSlogan}
          />
        }
      />

      <CidadeUFFields
        cidade={equipe.cidade}
        estado={equipe.estado}
        onCidade={(v) => onChange({ cidade: v })}
        onEstado={(v) => onChange({ estado: v, cidade: "" })}
        errorCidade={errors.cidade}
        errorEstado={errors.estado}
        cacheCidades={cacheCidades}
        labelCidade="Cidade base da equipe"
        labelEstado="Estado base"
      />

      <Field
        label="E-mail oficial da equipe"
        error={errors.emailOficial}
        input={
          <input
            type="email"
            value={equipe.emailOficial}
            onChange={(e) => onChange({ emailOficial: e.target.value })}
            placeholder="equipe@email.com"
            autoComplete="email"
            maxLength={FIELD_MAX.equipeEmail}
          />
        }
      />

      <Field
        label="Telefone de contato da equipe (WhatsApp)"
        error={errors.telefone}
        input={
          <input
            value={equipe.telefone}
            onChange={(e) =>
              onChange({ telefone: formatPhoneBR(e.target.value) })
            }
            placeholder="(00) 00000-0000"
            autoComplete="tel"
            inputMode="tel"
            maxLength={FIELD_MAX.equipeTelefone}
          />
        }
      />

      <p className="text-xs text-white/55 normal-case tracking-normal font-normal mt-2">
        <span className="text-sol-orange">★</span> O <strong className="text-white">Integrante 1</strong>{" "}
        será considerado o <strong className="text-white">líder</strong> da equipe — ponto focal pra
        comunicação com a COMISSÃO ORGANIZADORA e coordenador da equipe em caso
        de premiação. Coloque na ordem que faz sentido pro time.
      </p>
    </div>
  );
}

// =============================================================================
// STEP 1 — TRILHA
// =============================================================================

function TrilhaStep({
  equipe,
  onChange,
  errors,
}: {
  equipe: EquipeState;
  onChange: (p: Partial<EquipeState>) => void;
  errors: StepErrors;
}) {
  return (
    <div className="space-y-4">
      <Intro>
        Escolha a trilha temática que mais combina com a equipe. A COMISSÃO
        ORGANIZADORA pode validar ou ajustar a distribuição entre trilhas
        conforme equilíbrio técnico e aderência das propostas.
      </Intro>
      <div className="space-y-2">
        {TRILHAS.map((t) => (
          <label
            key={t}
            className={`block rounded-xl border px-4 py-3 cursor-pointer transition ${
              equipe.trilha === t
                ? "border-sol-orange/60 bg-sol-orange/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
            }`}
          >
            <input
              type="radio"
              name="trilha"
              value={t}
              checked={equipe.trilha === t}
              onChange={() => onChange({ trilha: t })}
              className="sr-only"
            />
            <span className="block text-sm font-medium text-white/90 normal-case tracking-normal">
              {t}
            </span>
            <span className="block mt-1.5 text-xs text-white/60 normal-case tracking-normal font-normal leading-relaxed">
              {TRILHAS_DESCRICAO[t]}
            </span>
          </label>
        ))}
      </div>
      {errors.trilha && (
        <p className="text-red-300 text-xs">{errors.trilha}</p>
      )}
    </div>
  );
}

// =============================================================================
// STEP 2-5 — INTEGRANTE (reutilizado pelos 4 integrantes)
// =============================================================================

function IntegranteStep({
  idx,
  isLider,
  integrante,
  onChange,
  onToggleAceite,
  errors,
  cacheCidades,
}: {
  idx: number;
  isLider: boolean;
  integrante: IntegranteState;
  onChange: (p: Partial<IntegranteState>) => void;
  onToggleAceite: (key: string, v: boolean) => void;
  errors: StepErrors;
  cacheCidades: Record<string, string[]>;
}) {
  const num = idx + 1;
  return (
    <div className="space-y-4">
      <Intro>
        Dados do <strong>Integrante {num}</strong>
        {isLider && " — LÍDER DA EQUIPE"}. Os aceites no fim desta etapa são{" "}
        <strong>individuais</strong> — leia com atenção antes de marcar.
      </Intro>

      <SectionTitle>Dados pessoais</SectionTitle>

      <Field
        label="Nome completo"
        error={errors.nomeCompleto}
        input={
          <input
            value={integrante.nomeCompleto}
            onChange={(e) => onChange({ nomeCompleto: e.target.value })}
            placeholder="Como aparece no documento"
            autoComplete="name"
            maxLength={FIELD_MAX.nomeCompleto}
          />
        }
      />

      <Field
        label="Nome social (se aplicável)"
        input={
          <input
            value={integrante.nomeSocial}
            onChange={(e) => onChange({ nomeSocial: e.target.value })}
            placeholder="Opcional"
            maxLength={FIELD_MAX.nomeSocial}
          />
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="CPF"
          error={errors.cpf}
          input={
            <input
              value={integrante.cpf}
              onChange={(e) => onChange({ cpf: formatCPF(e.target.value) })}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={FIELD_MAX.cpf}
            />
          }
        />
        <Field
          label="RG (com órgão expedidor e UF)"
          error={errors.rg}
          input={
            <input
              value={integrante.rg}
              onChange={(e) => onChange({ rg: e.target.value })}
              placeholder="Ex: 1.234.567 SSP/RN"
              maxLength={FIELD_MAX.rg}
            />
          }
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Data de nascimento"
          help="Precisa ter 18 anos completos até 24/06/2026."
          error={errors.dataNascimento}
          input={
            <input
              type="date"
              value={integrante.dataNascimento}
              onChange={(e) => onChange({ dataNascimento: e.target.value })}
              max="2008-06-24"
            />
          }
        />
        <Field
          label="Nacionalidade"
          error={errors.nacionalidade}
          input={
            <input
              value={integrante.nacionalidade}
              onChange={(e) => onChange({ nacionalidade: e.target.value })}
              placeholder="Ex: brasileira"
              maxLength={FIELD_MAX.nacionalidade}
            />
          }
        />
      </div>

      <Field
        label="Naturalidade (cidade / UF de nascimento)"
        error={errors.naturalidade}
        input={
          <input
            value={integrante.naturalidade}
            onChange={(e) => onChange({ naturalidade: e.target.value })}
            placeholder="Ex: Natal/RN"
            maxLength={FIELD_MAX.naturalidade}
          />
        }
      />

      <CidadeUFFields
        cidade={integrante.cidade}
        estado={integrante.estado}
        onCidade={(v) => onChange({ cidade: v })}
        onEstado={(v) => onChange({ estado: v, cidade: "" })}
        errorCidade={errors.cidade}
        errorEstado={errors.estado}
        cacheCidades={cacheCidades}
        labelCidade="Cidade onde reside"
        labelEstado="Estado onde reside"
      />

      <Field
        label="Endereço completo"
        help="Rua, número, bairro, CEP"
        error={errors.enderecoCompleto}
        input={
          <input
            value={integrante.enderecoCompleto}
            onChange={(e) => onChange({ enderecoCompleto: e.target.value })}
            placeholder="Ex: Rua das Dunas, 123, Ponta Negra, 59090-000"
            autoComplete="street-address"
            maxLength={FIELD_MAX.enderecoCompleto}
          />
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="E-mail pessoal"
          error={errors.emailPessoal}
          input={
            <input
              type="email"
              value={integrante.emailPessoal}
              onChange={(e) => onChange({ emailPessoal: e.target.value })}
              placeholder="você@email.com"
              autoComplete="email"
              maxLength={FIELD_MAX.emailPessoal}
            />
          }
        />
        <Field
          label="Telefone celular (WhatsApp)"
          error={errors.telefoneCelular}
          input={
            <input
              value={integrante.telefoneCelular}
              onChange={(e) =>
                onChange({ telefoneCelular: formatPhoneBR(e.target.value) })
              }
              placeholder="(00) 00000-0000"
              autoComplete="tel"
              inputMode="tel"
              maxLength={FIELD_MAX.telefoneCelular}
            />
          }
        />
      </div>

      <SectionTitle>Contato de emergência</SectionTitle>

      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Nome do contato"
          error={errors.contatoEmergenciaNome}
          input={
            <input
              value={integrante.contatoEmergenciaNome}
              onChange={(e) =>
                onChange({ contatoEmergenciaNome: e.target.value })
              }
              placeholder="Nome completo"
              maxLength={FIELD_MAX.contatoEmergenciaNome}
            />
          }
        />
        <Field
          label="Telefone alternativo / contato de emergência"
          error={errors.contatoEmergenciaTelefone}
          input={
            <input
              value={integrante.contatoEmergenciaTelefone}
              onChange={(e) =>
                onChange({
                  contatoEmergenciaTelefone: formatPhoneBR(e.target.value),
                })
              }
              placeholder="(00) 00000-0000"
              inputMode="tel"
              maxLength={FIELD_MAX.contatoEmergenciaTelefone}
            />
          }
        />
      </div>

      <ParentescoField
        value={integrante.contatoEmergenciaParentesco}
        onChange={(v) => onChange({ contatoEmergenciaParentesco: v })}
        error={errors.contatoEmergenciaParentesco}
      />

      <SectionTitle>Identidade de gênero</SectionTitle>
      <p className="text-xs text-white/55 -mt-2 normal-case tracking-normal font-normal">
        Usado exclusivamente para distribuição dos quartos. Tratado com
        confidencialidade.
      </p>

      <Field
        label="Como você se identifica?"
        error={errors.genero}
        input={
          <select
            value={integrante.genero}
            onChange={(e) => onChange({ genero: e.target.value })}
          >
            <option value="">Selecione...</option>
            {GENEROS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        }
      />

      <SectionTitle>Atuação profissional</SectionTitle>

      <Field
        label="Áreas de conhecimento"
        help="Marque ao menos uma. Não precisa marcar todas."
        error={errors.areasConhecimento}
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
                        : integrante.areasConhecimento.filter((a) => a !== area);
                      onChange({ areasConhecimento: next });
                    }}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`mt-0.5 block w-3 h-3 rounded-[0.2rem] border transition ${
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
          help="Profissão/cargo/empresa ou curso/instituição."
          error={errors.ocupacaoAtual}
          input={
            <input
              value={integrante.ocupacaoAtual}
              onChange={(e) => onChange({ ocupacaoAtual: e.target.value })}
              placeholder="Ex: Desenvolvedor na Acme / Estudante UFRN"
              maxLength={FIELD_MAX.ocupacaoAtual}
            />
          }
        />
        <Field
          label="Tempo de experiência"
          error={errors.tempoExperiencia}
          input={
            <select
              value={integrante.tempoExperiencia}
              onChange={(e) => onChange({ tempoExperiencia: e.target.value })}
            >
              <option value="">Selecione...</option>
              {TEMPO_EXPERIENCIA_OPCOES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <SectionTitle>Formação acadêmica</SectionTitle>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Field
          label="Nível de formação atual"
          error={errors.nivelFormacao}
          alignInput="top"
          input={
            <select
              value={integrante.nivelFormacao}
              onChange={(e) => onChange({ nivelFormacao: e.target.value })}
            >
              <option value="">Selecione...</option>
              {NIVEIS_FORMACAO.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          }
        />
        <CursoFormacaoField
          value={integrante.cursoFormacao}
          onChange={(v) => onChange({ cursoFormacao: v })}
        />
      </div>

      <Field
        label="Ano de conclusão"
        help="Opcional. Para formação em andamento, informe a previsão."
        error={errors.anoFormacao}
        input={
          <input
            value={integrante.anoFormacao}
            onChange={(e) =>
              onChange({ anoFormacao: e.target.value.replace(/\D/g, "").slice(0, 4) })
            }
            placeholder="2024"
            maxLength={FIELD_MAX.anoFormacao}
            inputMode="numeric"
          />
        }
      />

      <Field
        label="Instituição de ensino"
        help={
          integrante.nivelFormacao.startsWith("Ensino Médio")
            ? "Opcional. Comece a digitar o nome da escola — UF e município preenchem automaticamente."
            : "Opcional. Comece a digitar o nome ou sigla. UF e município preenchem automaticamente."
        }
        input={
          <InstituicaoField
            value={integrante.instituicao}
            uf={integrante.instituicaoUF}
            municipio={integrante.instituicaoMunicipio}
            nivelFormacao={integrante.nivelFormacao}
            onChange={(updates) => onChange(updates)}
          />
        }
      />

      <Field
        label="Você tem algum projeto acadêmico relevante em tecnologia, programação, inovação ou empreendedorismo?"
        help="Opcional. Descreva brevemente o projeto, seu papel e resultados."
        input={
          <textarea
            value={integrante.projetoAcademico}
            onChange={(e) => onChange({ projetoAcademico: e.target.value })}
            placeholder="Ex: TCC em recomendação por IA / app de logística entregue na ACME / pesquisa de iniciação científica em segurança."
            maxLength={FIELD_MAX.projetoAcademico}
            rows={3}
          />
        }
      />

      <Field
        label="Link do LinkedIn"
        help="Obrigatório — será analisado em caso de processo seletivo."
        error={errors.linkedin}
        input={
          <input
            value={integrante.linkedin}
            onChange={(e) => onChange({ linkedin: e.target.value })}
            placeholder="https://linkedin.com/in/seu-perfil"
            inputMode="url"
            maxLength={FIELD_MAX.linkedin}
          />
        }
      />

      <Field
        label="Portfólio / GitHub / Behance (opcional)"
        error={errors.portfolio}
        input={
          <input
            value={integrante.portfolio}
            onChange={(e) => onChange({ portfolio: e.target.value })}
            placeholder="https://github.com/seu-usuario"
            inputMode="url"
            maxLength={FIELD_MAX.portfolio}
          />
        }
      />

      <Field
        label="Outras redes sociais relevantes (opcional)"
        input={
          <input
            value={integrante.outrasRedes}
            onChange={(e) => onChange({ outrasRedes: e.target.value })}
            placeholder="Instagram, X, Bluesky, etc."
            maxLength={FIELD_MAX.outrasRedes}
          />
        }
      />

      <Field
        label="Experiência relevante"
        help="Até 5 linhas com seus principais projetos e conquistas."
        error={errors.experienciaRelevante}
        input={
          <textarea
            rows={4}
            value={integrante.experienciaRelevante}
            onChange={(e) =>
              onChange({ experienciaRelevante: e.target.value })
            }
            placeholder="Conte rapidamente onde você se destaca."
            maxLength={FIELD_MAX.experienciaRelevante}
          />
        }
      />

      <SectionTitle>Informações para o evento</SectionTitle>
      <p className="text-xs text-white/55 -mt-2 normal-case tracking-normal font-normal">
        Usado exclusivamente para o seu bem-estar durante o evento, em
        conformidade com a LGPD.
      </p>

      <RestricoesAlimentaresField
        value={integrante.restricoesAlimentares}
        onChange={(v) => onChange({ restricoesAlimentares: v })}
        error={errors.restricoesAlimentares}
      />

      <OptionalDescriptionField
        label="Alergias e condições de saúde"
        checkboxLabel="Tenho alergias graves ou condições de saúde relevantes"
        placeholder="Quais? Ex: alergia a abelha, asma, diabetes..."
        maxLength={FIELD_MAX.alergias}
        value={integrante.alergias}
        onChange={(v) => onChange({ alergias: v })}
      />

      <OptionalDescriptionField
        label="Medicamentos contínuos"
        checkboxLabel="Tomo medicamentos contínuos"
        placeholder="Quais? Ex: insulina, anti-hipertensivo..."
        maxLength={FIELD_MAX.medicamentos}
        value={integrante.medicamentos}
        onChange={(v) => onChange({ medicamentos: v })}
      />

      <OptionalDescriptionField
        label="Acessibilidade"
        checkboxLabel="Preciso de acomodação de acessibilidade"
        placeholder="Descreva. Ex: cadeirante, deficiência visual, neurodivergência..."
        maxLength={FIELD_MAX.acessibilidade}
        value={integrante.acessibilidade}
        onChange={(v) => onChange({ acessibilidade: v })}
      />

      <OptionalDescriptionField
        label="Outras observações"
        checkboxLabel="Quero adicionar uma observação pra organização"
        placeholder="Qualquer informação extra relevante."
        maxLength={FIELD_MAX.outrasObservacoes}
        value={integrante.outrasObservacoes}
        onChange={(v) => onChange({ outrasObservacoes: v })}
      />

      <Field
        label="Como soube do Hackathon do Sol?"
        error={errors.comoSoube}
        input={
          <select
            value={integrante.comoSoube}
            onChange={(e) => onChange({ comoSoube: e.target.value })}
          >
            <option value="">Selecione...</option>
            {COMO_SOUBE_OPCOES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        }
      />

      <SectionTitle>Termos de aceite individuais</SectionTitle>
      <p className="text-xs text-white/55 -mt-2 normal-case tracking-normal font-normal">
        Leia abaixo as cláusulas individuais. Ao marcar a caixa no fim, o(a)
        Integrante {num} aceita <strong>todas</strong> de uma vez.
      </p>

      <BundleAceiteBlock
        items={ACEITES_INDIVIDUAIS}
        allChecked={ACEITES_INDIVIDUAIS.every(
          (a) => !!integrante.aceites[a.key]
        )}
        onToggleAll={(v) => {
          ACEITES_INDIVIDUAIS.forEach((a) => onToggleAceite(a.key, v));
        }}
        hasError={ACEITES_INDIVIDUAIS.some(
          (a) => !!errors[`aceite_${a.key}`]
        )}
      />
    </div>
  );
}

// =============================================================================
// STEP 6 — PROPOSTA INICIAL DA EQUIPE
// =============================================================================

function PropostaStep({
  proposta,
  onChange,
  errors,
}: {
  proposta: PropostaState;
  onChange: (p: Partial<PropostaState>) => void;
  errors: StepErrors;
}) {
  return (
    <div className="space-y-4">
      <Intro>
        Será usado pela COMISSÃO ORGANIZADORA pra analisar a inscrição e a
        aderência à trilha. A proposta pode ser ajustada durante o evento —
        soluções desenvolvidas <strong>antes</strong> do primeiro dia não
        são aceitas.
      </Intro>

      <Field
        label="Ideia + diferencial"
        help="Apresente a ideia e o que a torna inovadora — em até ~15 linhas."
        error={errors.ideiaDiferencial}
        input={
          <textarea
            rows={6}
            value={proposta.ideiaDiferencial}
            onChange={(e) => onChange({ ideiaDiferencial: e.target.value })}
            placeholder="O que a equipe pretende construir + qual a sacada que torna isso especial?"
            maxLength={FIELD_MAX.propostaIdeiaDiferencial}
          />
        }
      />

      <Field
        label="Problema + público beneficiado"
        help="Qual problema real será resolvido e quem se beneficia."
        error={errors.problemaPublico}
        input={
          <textarea
            rows={4}
            value={proposta.problemaPublico}
            onChange={(e) => onChange({ problemaPublico: e.target.value })}
            placeholder="Qual problema vocês querem resolver e pra quem é a solução?"
            maxLength={FIELD_MAX.propostaProblemaPublico}
          />
        }
      />

      <Field
        label="Aderência à trilha temática escolhida"
        help="Como a ideia se conecta com a trilha indicada na etapa 2."
        error={errors.aderencia}
        input={
          <textarea
            rows={3}
            value={proposta.aderencia}
            onChange={(e) => onChange({ aderencia: e.target.value })}
            placeholder="Como a ideia se conecta à trilha?"
            maxLength={FIELD_MAX.propostaAderencia}
          />
        }
      />

      <Field
        label="Tecnologias previstas"
        help="Linguagens, plataformas, frameworks, modelos de GenAI."
        error={errors.tecnologias}
        input={
          <textarea
            rows={3}
            value={proposta.tecnologias}
            onChange={(e) => onChange({ tecnologias: e.target.value })}
            placeholder="Ex: Next.js, Postgres, Claude, Vercel..."
            maxLength={FIELD_MAX.propostaTecnologias}
          />
        }
      />
    </div>
  );
}

// =============================================================================
// STEP 7 — ACEITES COLETIVOS
// =============================================================================

function AceitesColetivosStep({
  aceites,
  onToggle,
  errors,
}: {
  aceites: Record<string, boolean>;
  onToggle: (key: string, v: boolean) => void;
  errors: StepErrors;
}) {
  return (
    <div className="space-y-4">
      <Intro>
        Estes aceites são marcados pelo Líder em nome da equipe. Leia as
        cláusulas abaixo e marque a caixa no fim pra aceitar <strong>todas</strong>{" "}
        de uma vez.
      </Intro>

      <BundleAceiteBlock
        items={ACEITES_COLETIVOS}
        allChecked={ACEITES_COLETIVOS.every((a) => !!aceites[a.key])}
        onToggleAll={(v) => {
          ACEITES_COLETIVOS.forEach((a) => onToggle(a.key, v));
        }}
        hasError={ACEITES_COLETIVOS.some((a) => !!errors[a.key])}
      />
    </div>
  );
}

// =============================================================================
// STEP 8 — CONFIRMAÇÃO DO LÍDER + TURNSTILE
// =============================================================================

function LiderConfirmacaoStep({
  lider,
  confirmacao,
  onChange,
  errors,
  turnstileRef,
  turnstileToken,
  onTurnstileToken,
}: {
  lider: IntegranteState;
  confirmacao: LiderConfirmacaoState;
  onChange: (p: Partial<LiderConfirmacaoState>) => void;
  errors: StepErrors;
  turnstileRef: React.MutableRefObject<TurnstileInstance | null>;
  turnstileToken: string | null;
  onTurnstileToken: (t: string | null) => void;
}) {
  const liderInfo = useMemo(
    () => ({
      nome: lider.nomeCompleto || "(volte e preencha a etapa do líder)",
      cpf: lider.cpf || "(volte e preencha a etapa do líder)",
    }),
    [lider.nomeCompleto, lider.cpf]
  );

  return (
    <div className="space-y-4">
      <Intro>
        O Líder confirma a finalização da inscrição. Os campos abaixo devem
        bater com os dados que você informou na etapa do integrante marcado
        como líder na Seção 1.
      </Intro>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-xs normal-case tracking-normal font-normal text-white/70 space-y-1">
        <div>
          <span className="text-white/45">Líder cadastrado:</span>{" "}
          <span className="text-white/90">{liderInfo.nome}</span>
        </div>
        <div>
          <span className="text-white/45">CPF:</span>{" "}
          <span className="text-white/90">{liderInfo.cpf}</span>
        </div>
      </div>

      <Field
        label="Nome completo do Líder (confirmação)"
        error={errors.nomeConfirmacao}
        input={
          <input
            value={confirmacao.nomeConfirmacao}
            onChange={(e) => onChange({ nomeConfirmacao: e.target.value })}
            placeholder="Repita o nome do líder"
            maxLength={FIELD_MAX.nomeCompleto}
          />
        }
      />

      <Field
        label="CPF do Líder (confirmação)"
        error={errors.cpfConfirmacao}
        input={
          <input
            value={confirmacao.cpfConfirmacao}
            onChange={(e) =>
              onChange({ cpfConfirmacao: formatCPF(e.target.value) })
            }
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={FIELD_MAX.cpf}
          />
        }
      />

      <AceiteCheckbox
        titulo={ACEITE_LIDER.titulo}
        texto={ACEITE_LIDER.texto}
        checked={confirmacao.aceiteFinal}
        onChange={(v) => onChange({ aceiteFinal: v })}
        error={errors.aceiteFinal}
      />

      <div className="pt-2">
        <Turnstile
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={(t) => onTurnstileToken(t)}
          onError={() => onTurnstileToken(null)}
          onExpire={() => onTurnstileToken(null)}
          options={{ theme: "dark", size: "flexible" }}
        />
        {!turnstileToken && (
          <p className="text-[0.6875rem] text-white/45 mt-2 normal-case tracking-normal font-normal">
            Aguarde a verificação anti-robô completar antes de enviar.
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTES REUTILIZÁVEIS
// =============================================================================

function Intro({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-white/65 leading-relaxed normal-case tracking-normal font-normal">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span aria-hidden className="font-mono text-sol-orange/40 text-xs">
        ─
      </span>
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.22em] text-white/75 font-medium">
        {children}
      </span>
      <span
        aria-hidden
        className="flex-1 h-px bg-gradient-to-r from-sol-orange/40 via-sol-orange/15 to-transparent"
      />
    </div>
  );
}

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
  //   de uma coluna pode crescer muito mais que a outra (ex: input extra
  //   condicional embaixo do select), pra evitar gaps gigantes.
  alignInput?: "top" | "bottom";
}) {
  // `data-field-error` no wrapper quando tem erro permite que o toast de
  // validação faça scroll pro primeiro campo com erro.
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

// =============================================================================
// InstituicaoField — autocomplete da Formação Acadêmica.
// -----------------------------------------------------------------------------
// Lê de lib/ies-data (~200 IES brasileiras). Aceita texto livre como fallback
// — se o user digitar uma instituição fora da lista, a string vai pro form sem
// UF/município (não temos como inferir). Onde casa com a lista, auto-preenche
// `instituicaoUF` + `instituicaoMunicipio` pra usar em analytics e na
// Detalhes da planilha admin.
// =============================================================================
// Entry comum pra renderização do dropdown — IES tem sigla, Escola não tem.
type InstituicaoSuggestion = {
  sigla?: string;
  nome: string;
  uf: string;
  municipio: string;
};

function makeDisplay(s: InstituicaoSuggestion): string {
  return s.sigla ? `${s.nome} (${s.sigla})` : s.nome;
}

function InstituicaoField({
  value,
  uf,
  municipio,
  nivelFormacao,
  onChange,
}: {
  value: string;
  uf: string;
  municipio: string;
  nivelFormacao: string;
  onChange: (updates: {
    instituicao: string;
    instituicaoUF: string;
    instituicaoMunicipio: string;
  }) => void;
}) {
  // Ensino Médio (em andamento ou completo) busca em escolas-data; o resto
  // dos níveis busca em ies-data (ensino superior). Os dois datasets são
  // importados eagerly — pequena penalidade de bundle (~2.5MB extra), mas
  // simplifica drasticamente o componente.
  const isEnsMedio = nivelFormacao.startsWith("Ensino Médio");
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo<InstituicaoSuggestion[]>(() => {
    if (isEnsMedio) return searchEscolas(query, 8);
    return searchIES(query, 8);
  }, [query, isEnsMedio]);

  // Resincroniza o input local quando o valor externo muda (ex: carga de
  // rascunho, ou troca de integrante via "limpar todos").
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fecha dropdown ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (s: InstituicaoSuggestion) => {
    const display = makeDisplay(s);
    onChange({
      instituicao: display,
      instituicaoUF: s.uf,
      instituicaoMunicipio: s.municipio,
    });
    setQuery(display);
    setOpen(false);
  };

  // Se o user digitar e desfocar sem selecionar, mantém o texto digitado como
  // instituição mas zera UF/município — não temos como inferir.
  const handleBlur = () => {
    if (query.trim() !== value.trim()) {
      onChange({
        instituicao: query.trim(),
        instituicaoUF: "",
        instituicaoMunicipio: "",
      });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={isEnsMedio ? "Ex: Colégio Atheneu" : "Ex: UFRN"}
        maxLength={FIELD_MAX.instituicao}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-white/15 bg-sol-bgDeep/95 backdrop-blur shadow-2xl"
        >
          {results.map((s, i) => (
            <li
              key={`${s.sigla || ""}-${s.nome}-${s.municipio}-${i}`}
              role="option"
              aria-selected={value === makeDisplay(s)}
              onMouseDown={(e) => {
                // mousedown (não click) pra disparar antes do blur do input.
                e.preventDefault();
                handleSelect(s);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-white/[0.06] flex items-baseline gap-2 normal-case tracking-normal font-normal"
            >
              {s.sigla && (
                <span className="font-semibold text-white shrink-0">
                  {s.sigla}
                </span>
              )}
              <span className="font-semibold text-white truncate min-w-0">
                {s.nome}
              </span>
              <span className="ml-auto text-xs text-white/45 whitespace-nowrap shrink-0">
                {s.municipio}/{s.uf}
              </span>
            </li>
          ))}
        </ul>
      )}
      {uf && municipio && (
        <p className="mt-1 text-xs text-white/55 normal-case tracking-normal font-normal">
          Sede: {municipio}/{uf}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// BundleAceiteBlock — estilo "instalador de software" / EULA.
// -----------------------------------------------------------------------------
// Lista TODOS os aceites num scroll com altura fixa, e embaixo (fora do scroll)
// um único checkbox "Li, compreendi e aceito todas as cláusulas acima."
// Marcar esse checkbox seta todos os aceites do bundle pra true; desmarcar
// seta todos pra false. Visualmente mais compacto que N cards separados; o
// estado interno continua sendo um booleano por aceite (pra que a planilha,
// validação e o registro legal mantenham cada cláusula consentida
// individualmente — só a UX que muda).
// =============================================================================
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
        {/* Header com instrução clara de que ROLA */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-2">
          <span className="text-[0.6875rem] font-mono uppercase tracking-[0.18em] font-semibold text-sol-orange/90">
            ↓ Role pra ler todas as {items.length} cláusulas
          </span>
        </div>

        {/* Scroll com as cláusulas — `data-lenis-prevent` libera o scroll
            nativo dentro desse box, senão o smooth-scroll do Lenis (global)
            intercepta o wheel e a caixa não rola. */}
        <div
          data-lenis-prevent
          className="max-h-96 overflow-y-auto px-5 py-4 space-y-5 bundle-aceite-scroll"
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

        {/* Gradiente fade no fim do scroll — comunica que ainda tem conteúdo
            abaixo (e dá feedback visual quando o user já rolou tudo). */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 h-12 bg-gradient-to-b from-transparent to-[#1a0e3a]/85"
          style={{ top: "calc(2rem + 1px)", bottom: "auto", display: "none" }}
        />
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
        <p
          data-field-error="true"
          className="text-red-300 text-xs mt-2"
        >
          Você precisa aceitar todas as cláusulas pra continuar.
        </p>
      )}
    </div>
  );
}

function AceiteCheckbox({
  titulo,
  texto,
  checked,
  onChange,
  error,
}: {
  titulo: string;
  texto: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer group select-none transition ${
          checked
            ? "border-sol-orange/40 bg-sol-orange/[0.06]"
            : error
            ? "border-red-400/40 bg-red-400/[0.04]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20"
        }`}
      >
        <span className="relative mt-0.5 shrink-0">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
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
            {titulo}
          </span>
          <span className="block mt-1 text-xs text-white/65 leading-relaxed normal-case tracking-normal font-normal">
            {texto}
          </span>
        </span>
      </label>
      {error && <p className="text-red-300 text-xs mt-1">{error}</p>}
    </div>
  );
}

// =============================================================================
// CIDADE / UF com cache do IBGE
// -----------------------------------------------------------------------------
// Reutilizado pela equipe e por cada integrante. O cache do IBGE é
// compartilhado (mesma ref vinda do componente raiz) — uma vez que UF "RN"
// foi carregada uma vez, qualquer outro select reusa.
// =============================================================================

// =============================================================================
// PARENTESCO — dropdown com opções comuns + "Outro (especificar)"
// -----------------------------------------------------------------------------
// O estado é UMA string só (`contatoEmergenciaParentesco` no integrante). A
// UI decide se mostra dropdown ou input livre baseado no valor atual:
//   • valor vazio          → mostra só dropdown (sem opção marcada)
//   • valor está na lista  → dropdown com aquela opção marcada
//   • valor NÃO está na lista (e não vazio) → mostra "Outro" no dropdown e
//                                              campo de texto com o valor
// Quando user pica "Outro" no dropdown, limpamos o valor pra "" e mostramos o
// input vazio. User digita lá e a string vai pro estado.
// =============================================================================
// =============================================================================
// ValidationToast — popup que aparece no topo da tela quando user tenta
// avançar com erros de validação. Auto-some em 5s; pode ser fechado manual.
// -----------------------------------------------------------------------------
// Estilo de toast (não modal) — não bloqueia interação. Aparece, comunica,
// e some. Em paralelo, a função triggerValidationToast faz scroll pro
// primeiro campo com erro pra usuário visualizar o problema imediatamente.
// =============================================================================
// =============================================================================
// SuccessToast — versão verde do ValidationToast, aparece quando a inscrição
// é enviada com sucesso. Mesma animação/posicionamento.
// =============================================================================
function SuccessToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] animate-validation-toast-in"
    >
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/95 backdrop-blur-sm text-white px-4 py-3 shadow-2xl shadow-emerald-950/30 flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/25 text-emerald-200 shrink-0 font-semibold text-xs"
        >
          ✓
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold normal-case tracking-normal leading-snug">
            Inscrição enviada!
          </p>
          <p className="mt-0.5 text-xs text-emerald-100/80 normal-case tracking-normal font-normal leading-relaxed">
            A equipe entrou na lista de análise. Cada integrante vai receber um
            e-mail de confirmação.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="text-emerald-200/70 hover:text-white shrink-0 text-lg leading-none -mt-0.5"
        >
          ×
        </button>
      </div>
    </div>
  );
}

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
      aria-live="polite"
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
            Os campos com problema estão destacados em vermelho — role pra ver e
            corrigir.
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

// Select de curso/área com fallback de input livre quando o usuário escolhe
// "Outra". Retorna fragment com 1-2 grid items: o dropdown como Field
// normal (1 coluna) e, quando "Outra" está ativa, um input adicional que
// ocupa a largura total via `md:col-span-2` — mais legível do que ficar
// comprimido só na coluna direita.
//
// Estado local `outraAtiva` guarda a intenção do user depois que ele
// escolheu "Outra" no dropdown — sem isso, o input some na primeira vez
// que ele apaga o texto pra retypar.
function CursoFormacaoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const OUTRA_SENTINEL = "__outra__";
  const isInList = (CURSOS_AREAS as readonly string[]).includes(value);
  const [outraAtiva, setOutraAtiva] = useState(!!value && !isInList);

  const showOutraInput = outraAtiva;
  const dropdownValue = isInList ? value : showOutraInput ? OUTRA_SENTINEL : "";

  return (
    <>
      <Field
        label="Curso ou área (opcional)"
        alignInput="top"
        input={
          <select
            value={dropdownValue}
            onChange={(e) => {
              if (e.target.value === OUTRA_SENTINEL) {
                setOutraAtiva(true);
                onChange("");
              } else {
                setOutraAtiva(false);
                onChange(e.target.value);
              }
            }}
          >
            <option value="">Selecione...</option>
            {CURSOS_AREAS.filter((c) => c !== "Outra").map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={OUTRA_SENTINEL}>Outra (especificar)</option>
          </select>
        }
      />
      {showOutraInput && (
        <div className="md:col-span-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Especifique o curso ou área"
            maxLength={FIELD_MAX.cursoFormacao}
            autoFocus
          />
        </div>
      )}
    </>
  );
}

function ParentescoField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const OUTRO = "__outro__";
  // O dropdown mostra: valor exato (se está na lista) OU "" (vazio) OU OUTRO.
  const isInList = (PARENTESCO_OPCOES as readonly string[]).includes(value);
  // `outroAtivo` é guarda separada pra UX: uma vez que o user escolhe "Outro"
  // explicitamente, mantém o input visível mesmo com value vazio (senão o
  // input some na primeira tentativa de apagar pra retypar).
  const [outroAtivo, setOutroAtivo] = useState(!!value && !isInList);

  const showOutroInput = outroAtivo;
  const dropdownValue = isInList ? value : showOutroInput ? OUTRO : "";

  return (
    <Field
      label="Grau de parentesco do contato"
      error={error}
      input={
        <div className="space-y-2">
          <select
            value={dropdownValue}
            onChange={(e) => {
              if (e.target.value === OUTRO) {
                setOutroAtivo(true);
                onChange("");
              } else {
                setOutroAtivo(false);
                onChange(e.target.value);
              }
            }}
          >
            <option value="">Selecione...</option>
            {PARENTESCO_OPCOES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={OUTRO}>Outro (especificar)</option>
          </select>
          {showOutroInput && (
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Especifique o parentesco"
              maxLength={FIELD_MAX.contatoEmergenciaParentesco}
              autoFocus
            />
          )}
        </div>
      }
    />
  );
}

// =============================================================================
// RESTRIÇÕES ALIMENTARES — checkbox que abre input só se o user tem restrições.
// -----------------------------------------------------------------------------
// Default: `value === "Nenhuma"`, checkbox unchecked, input oculto. Maioria das
// pessoas não toca em nada e passa direto. Quem tem restrições marca → input
// aparece com autofocus pra digitar.
// =============================================================================
function RestricoesAlimentaresField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const NENHUMA = "Nenhuma";
  // `hasRestricoes` é estado LOCAL — não derivado de `value`. Se fosse
  // derivado, quando o user marcasse o checkbox e limpássemos `value` pra ""
  // o derivado voltaria a false e o checkbox se desmarcaria sozinho. Loop.
  const [hasRestricoes, setHasRestricoes] = useState(
    !!value && value !== NENHUMA
  );

  return (
    <div>
      <label className="block">Restrições alimentares</label>
      <div className="space-y-2 mt-2">
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <span className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={hasRestricoes}
              onChange={(e) => {
                const checked = e.target.checked;
                setHasRestricoes(checked);
                if (checked) {
                  onChange(""); // limpa pra user digitar fresco
                } else {
                  onChange(NENHUMA);
                }
              }}
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
          <span className="text-xs font-normal normal-case tracking-normal text-white/80 leading-relaxed">
            Tenho restrições alimentares (vegano, vegetariano, intolerâncias, alergias).
          </span>
        </label>
        {hasRestricoes && (
          <textarea
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Quais? Ex: vegetariano, intolerante a lactose"
            maxLength={FIELD_MAX.restricoesAlimentares}
            autoFocus
          />
        )}
      </div>
      {error && <p className="text-red-300 text-xs mt-1">{error}</p>}
    </div>
  );
}

// =============================================================================
// OptionalDescriptionField — checkbox que abre textarea pra detalhar info opcional
// -----------------------------------------------------------------------------
// Pra alergias / medicamentos / acessibilidade / observações — todos campos
// opcionais onde a maioria das pessoas não tem nada a dizer. Default
// desmarcado, valor = "". Quando marca, abre o textarea pra preencher.
// =============================================================================
function OptionalDescriptionField({
  label,
  checkboxLabel,
  placeholder,
  maxLength,
  value,
  onChange,
}: {
  label: string;
  checkboxLabel: string;
  placeholder: string;
  maxLength: number;
  value: string;
  onChange: (v: string) => void;
}) {
  // State local — mesmo motivo do RestricoesAlimentaresField. Não dá pra
  // derivar de `value` porque ao marcar limpamos pra "" e o checkbox sumiria.
  const [checked, setChecked] = useState(!!value);

  return (
    <div>
      <label className="block">{label}</label>
      <div className="space-y-2 mt-2">
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <span className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const c = e.target.checked;
                setChecked(c);
                if (!c) onChange(""); // desmarcou: limpa valor
              }}
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
          <span className="text-xs font-normal normal-case tracking-normal text-white/80 leading-relaxed">
            {checkboxLabel}
          </span>
        </label>
        {checked && (
          <textarea
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus
          />
        )}
      </div>
    </div>
  );
}

function CidadeUFFields({
  cidade,
  estado,
  onCidade,
  onEstado,
  errorCidade,
  errorEstado,
  cacheCidades,
  labelCidade,
  labelEstado,
}: {
  cidade: string;
  estado: string;
  onCidade: (v: string) => void;
  onEstado: (v: string) => void;
  errorCidade?: string;
  errorEstado?: string;
  cacheCidades: Record<string, string[]>;
  labelCidade: string;
  labelEstado: string;
}) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorFetch, setErrorFetch] = useState(false);

  useEffect(() => {
    if (!estado) {
      setCidades([]);
      setErrorFetch(false);
      return;
    }
    if (cacheCidades[estado]) {
      setCidades(cacheCidades[estado]!);
      setErrorFetch(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setErrorFetch(false);
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`,
      { signal: ctrl.signal }
    )
      .then((r) => {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      })
      .then((data: { nome: string }[]) => {
        const nomes = data.map((c) => c.nome);
        cacheCidades[estado] = nomes;
        setCidades(nomes);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setCidades([]);
        setErrorFetch(true);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [estado, cacheCidades]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field
        label={labelEstado}
        error={errorEstado}
        input={
          <select value={estado} onChange={(e) => onEstado(e.target.value)}>
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
        label={labelCidade}
        error={
          errorFetch
            ? "Não foi possível carregar as cidades. Tente novamente."
            : errorCidade
        }
        input={
          <select
            value={cidade}
            onChange={(e) => onCidade(e.target.value)}
            disabled={!estado || loading}
          >
            <option value="">
              {!estado
                ? "Escolha o estado primeiro"
                : loading
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
  );
}
