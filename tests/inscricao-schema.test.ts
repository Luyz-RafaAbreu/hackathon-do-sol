// Testes dos validadores puros de lib/inscricao-schema.ts — a fonte canônica
// da inscrição. Esses validadores rodam no client E no server; uma regressão
// aqui significaria aceitar dado inválido ou travar gente válida.
//
// Rodar: npm test   (ou npm run test:watch durante o desenvolvimento)
//
// Os CPFs em CPFS_VALIDOS (abaixo) são válidos de verdade — passam no
// algoritmo dos dígitos verificadores; o próprio teste de isValidCPF confirma.

import { describe, it, expect } from "vitest";
import {
  isValidCPF,
  formatCPF,
  formatPhoneBR,
  isValidPhoneBR,
  formatCEP,
  isValidCEP,
  isValidEmail,
  isAdultByCredenciamento,
  isValidLinkedIn,
  isValidUrl,
  validateEquipe,
  validateTrilha,
  validateIntegrante,
  validateProposta,
  validateAceitesColetivos,
  validateLiderConfirmacao,
  validateAll,
  normalizeForm,
  sanitizeDraft,
  createInitialIntegrante,
  ACEITES_INDIVIDUAIS,
  ACEITES_COLETIVOS,
  TRILHAS,
  type IntegranteState,
  type EquipeState,
  type PropostaState,
  type InscricaoFormState,
} from "../lib/inscricao-schema";

// CPFs válidos (dígitos verificadores corretos) — sem repetição entre eles.
const CPFS_VALIDOS = [
  "111.444.777-35",
  "123.456.789-09",
  "987.654.321-00",
  "529.982.247-25",
];

// =============================================================================
// Fábricas de dados válidos — base pra testar tanto o caminho feliz quanto,
// com overrides, cada campo quebrado isoladamente.
// =============================================================================

function integranteValido(overrides: Partial<IntegranteState> = {}): IntegranteState {
  const base = createInitialIntegrante();
  const aceites: Record<string, boolean> = {};
  for (const a of ACEITES_INDIVIDUAIS) aceites[a.key] = true;
  return {
    ...base,
    nomeCompleto: "João da Silva",
    cpf: CPFS_VALIDOS[0]!,
    rg: "1234567 SSP/RN",
    dataNascimento: "2000-01-15",
    nacionalidade: "Brasileiro",
    naturalidade: "Natal/RN",
    cidade: "Natal",
    estado: "RN",
    cep: "59000-000",
    logradouro: "Rua Teste",
    numero: "100",
    bairro: "Centro",
    emailPessoal: "joao@example.com",
    telefoneCelular: "(84) 99999-0001",
    contatoEmergenciaNome: "Maria da Silva",
    contatoEmergenciaTelefone: "(84) 98888-0001",
    contatoEmergenciaParentesco: "Mãe",
    genero: "Homem cis",
    areasConhecimento: ["Marketing"],
    ocupacaoAtual: "Desenvolvedor",
    tempoExperiencia: "2 a 5 anos",
    nivelFormacao: "Graduação completa",
    experienciaRelevante: "Tenho experiência relevante em diversos projetos.",
    restricoesAlimentares: "Nenhuma",
    comoSoube: "Instagram",
    aceites,
    ...overrides,
  };
}

function equipeValida(overrides: Partial<EquipeState> = {}): EquipeState {
  return {
    nome: "Equipe Teste",
    slogan: "",
    cidade: "Natal",
    estado: "RN",
    emailOficial: "equipe@example.com",
    telefone: "(84) 99999-0000",
    trilha: TRILHAS[0],
    liderIndex: 0,
    ...overrides,
  };
}

function propostaValida(overrides: Partial<PropostaState> = {}): PropostaState {
  return {
    ideiaDiferencial: "x".repeat(80),
    problemaPublico: "x".repeat(60),
    aderencia: "x".repeat(40),
    tecnologias: "x".repeat(20),
    ...overrides,
  };
}

function formValido(): InscricaoFormState {
  const integrantes = CPFS_VALIDOS.map((cpf, i) =>
    integranteValido({
      cpf,
      nomeCompleto: `Integrante Numero ${i + 1}`,
      emailPessoal: `integrante${i}@example.com`,
    })
  ) as [IntegranteState, IntegranteState, IntegranteState, IntegranteState];

  const aceitesColetivos: Record<string, boolean> = {};
  for (const a of ACEITES_COLETIVOS) aceitesColetivos[a.key] = true;

  return {
    equipe: equipeValida(),
    integrantes,
    proposta: propostaValida(),
    aceitesColetivos,
    liderConfirmacao: {
      nomeConfirmacao: "Integrante Numero 1",
      cpfConfirmacao: CPFS_VALIDOS[0]!,
      aceiteFinal: true,
    },
  };
}

// =============================================================================
// isValidCPF
// =============================================================================
describe("isValidCPF", () => {
  it("aceita CPFs válidos com máscara", () => {
    for (const cpf of CPFS_VALIDOS) expect(isValidCPF(cpf)).toBe(true);
  });

  it("aceita CPF válido sem máscara (só dígitos)", () => {
    expect(isValidCPF("11144477735")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(isValidCPF("111.444.777-00")).toBe(false);
    expect(isValidCPF("123.456.789-10")).toBe(false);
  });

  it("rejeita repetições óbvias (todos os dígitos iguais)", () => {
    expect(isValidCPF("000.000.000-00")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("99999999999")).toBe(false);
  });

  it("rejeita comprimento errado", () => {
    expect(isValidCPF("123")).toBe(false);
    expect(isValidCPF("1114447773")).toBe(false); // 10 dígitos
    expect(isValidCPF("111444777351")).toBe(false); // 12 dígitos
  });

  it("rejeita string vazia ou sem dígitos", () => {
    expect(isValidCPF("")).toBe(false);
    expect(isValidCPF("abc.def.ghi-jk")).toBe(false);
  });
});

// =============================================================================
// formatCPF
// =============================================================================
describe("formatCPF", () => {
  it("formata 11 dígitos na máscara completa", () => {
    expect(formatCPF("11144477735")).toBe("111.444.777-35");
  });

  it("formata parcialmente conforme o usuário digita", () => {
    expect(formatCPF("111")).toBe("111");
    expect(formatCPF("1114")).toBe("111.4");
    expect(formatCPF("1114447")).toBe("111.444.7");
    expect(formatCPF("11144477")).toBe("111.444.77");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatCPF("111abc444def777 gh35")).toBe("111.444.777-35");
  });

  it("trava em 11 dígitos (descarta o excedente)", () => {
    expect(formatCPF("1114447773599999")).toBe("111.444.777-35");
  });

  it("string vazia vira string vazia", () => {
    expect(formatCPF("")).toBe("");
  });
});

// =============================================================================
// formatPhoneBR
// =============================================================================
describe("formatPhoneBR", () => {
  it("formata celular de 11 dígitos", () => {
    expect(formatPhoneBR("84999998888")).toBe("(84) 99999-8888");
  });

  it("formata fixo de 10 dígitos", () => {
    expect(formatPhoneBR("8433334444")).toBe("(84) 3333-4444");
  });

  it("formata parcialmente enquanto digita", () => {
    expect(formatPhoneBR("8")).toBe("(8");
    expect(formatPhoneBR("84")).toBe("(84");
    expect(formatPhoneBR("849")).toBe("(84) 9");
    expect(formatPhoneBR("84999")).toBe("(84) 999");
  });

  it("string vazia vira string vazia", () => {
    expect(formatPhoneBR("")).toBe("");
  });

  it("trava em 11 dígitos", () => {
    expect(formatPhoneBR("8499999888899")).toBe("(84) 99999-8888");
  });
});

// =============================================================================
// isValidPhoneBR
// =============================================================================
describe("isValidPhoneBR", () => {
  it("aceita 10 e 11 dígitos", () => {
    expect(isValidPhoneBR("8433334444")).toBe(true);
    expect(isValidPhoneBR("84999998888")).toBe(true);
  });

  it("aceita com máscara (conta só os dígitos)", () => {
    expect(isValidPhoneBR("(84) 99999-8888")).toBe(true);
  });

  it("rejeita comprimentos fora de 10-11 dígitos", () => {
    expect(isValidPhoneBR("999998888")).toBe(false); // 9
    expect(isValidPhoneBR("849999988889")).toBe(false); // 12
    expect(isValidPhoneBR("")).toBe(false);
  });
});

// =============================================================================
// formatCEP / isValidCEP
// =============================================================================
describe("formatCEP", () => {
  it("formata 8 dígitos como 00000-000", () => {
    expect(formatCEP("59000000")).toBe("59000-000");
  });

  it("formata parcialmente", () => {
    expect(formatCEP("590")).toBe("590");
    expect(formatCEP("59000")).toBe("59000");
    expect(formatCEP("590001")).toBe("59000-1");
  });

  it("trava em 8 dígitos", () => {
    expect(formatCEP("590000009999")).toBe("59000-000");
  });
});

describe("isValidCEP", () => {
  it("aceita 8 dígitos, com ou sem máscara", () => {
    expect(isValidCEP("59000000")).toBe(true);
    expect(isValidCEP("59000-000")).toBe(true);
  });

  it("rejeita comprimento diferente de 8", () => {
    expect(isValidCEP("5900000")).toBe(false);
    expect(isValidCEP("590000000")).toBe(false);
    expect(isValidCEP("")).toBe(false);
  });
});

// =============================================================================
// isValidEmail
// =============================================================================
describe("isValidEmail", () => {
  it("aceita e-mails válidos", () => {
    expect(isValidEmail("teste@gmail.com")).toBe(true);
    expect(isValidEmail("test+1@gmail.com")).toBe(true);
    expect(isValidEmail("a.b.c@dominio.com.br")).toBe(true);
  });

  it("apara espaços nas pontas", () => {
    expect(isValidEmail("  teste@gmail.com  ")).toBe(true);
  });

  it("rejeita e-mails malformados", () => {
    expect(isValidEmail("sem-arroba.com")).toBe(false);
    expect(isValidEmail("sem-dominio@host")).toBe(false);
    expect(isValidEmail("com espaco@gmail.com")).toBe(false);
    expect(isValidEmail("@gmail.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

// =============================================================================
// isAdultByCredenciamento — idade ≥ 18 até 24/06/2026 → nascido até 24/06/2008
// =============================================================================
describe("isAdultByCredenciamento", () => {
  it("aceita quem nasceu exatamente no limite (24/06/2008)", () => {
    expect(isAdultByCredenciamento("2008-06-24")).toBe(true);
  });

  it("aceita quem nasceu antes do limite", () => {
    expect(isAdultByCredenciamento("2008-06-23")).toBe(true);
    expect(isAdultByCredenciamento("2000-01-15")).toBe(true);
    expect(isAdultByCredenciamento("1990-12-31")).toBe(true);
  });

  it("rejeita quem nasceu depois do limite (menor de 18)", () => {
    expect(isAdultByCredenciamento("2008-06-25")).toBe(false);
    expect(isAdultByCredenciamento("2010-01-01")).toBe(false);
  });

  it("rejeita data vazia ou inválida", () => {
    expect(isAdultByCredenciamento("")).toBe(false);
    expect(isAdultByCredenciamento("não-é-data")).toBe(false);
    expect(isAdultByCredenciamento("2008-13-45")).toBe(false);
  });
});

// =============================================================================
// isValidLinkedIn
// =============================================================================
describe("isValidLinkedIn", () => {
  it("aceita variações válidas de perfil", () => {
    expect(isValidLinkedIn("linkedin.com/in/joao")).toBe(true);
    expect(isValidLinkedIn("https://www.linkedin.com/in/joao-silva")).toBe(true);
    expect(isValidLinkedIn("https://linkedin.com/in/joao/")).toBe(true);
    expect(isValidLinkedIn("www.linkedin.com/in/abc123")).toBe(true);
  });

  it("rejeita URLs que não são perfil /in/", () => {
    expect(isValidLinkedIn("linkedin.com/joao")).toBe(false);
    expect(isValidLinkedIn("linkedin.com/in/")).toBe(false);
    expect(isValidLinkedIn("github.com/joao")).toBe(false);
    expect(isValidLinkedIn("")).toBe(false);
  });
});

// =============================================================================
// isValidUrl
// =============================================================================
describe("isValidUrl", () => {
  it("aceita URLs com domínio (com ou sem protocolo)", () => {
    expect(isValidUrl("github.com/usuario")).toBe(true);
    expect(isValidUrl("https://meusite.com.br")).toBe(true);
    expect(isValidUrl("http://behance.net/perfil")).toBe(true);
  });

  it("rejeita texto sem domínio válido", () => {
    expect(isValidUrl("exemplo")).toBe(false);
    expect(isValidUrl("https://localhost")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

// =============================================================================
// validateEquipe
// =============================================================================
describe("validateEquipe", () => {
  it("equipe completa não gera erro", () => {
    expect(validateEquipe(equipeValida())).toEqual({});
  });

  it("acusa nome faltando", () => {
    expect(validateEquipe(equipeValida({ nome: "  " })).nome).toBeDefined();
  });

  it("acusa e-mail oficial inválido", () => {
    expect(validateEquipe(equipeValida({ emailOficial: "invalido" })).emailOficial).toBeDefined();
  });

  it("acusa telefone inválido", () => {
    expect(validateEquipe(equipeValida({ telefone: "123" })).telefone).toBeDefined();
  });

  it("acusa cidade e estado faltando", () => {
    const e = validateEquipe(equipeValida({ cidade: "", estado: "" }));
    expect(e.cidade).toBeDefined();
    expect(e.estado).toBeDefined();
  });
});

// =============================================================================
// validateTrilha
// =============================================================================
describe("validateTrilha", () => {
  it("não gera erro quando há trilha escolhida", () => {
    expect(validateTrilha(equipeValida())).toEqual({});
  });

  it("acusa trilha não escolhida", () => {
    expect(validateTrilha(equipeValida({ trilha: "" })).trilha).toBeDefined();
  });
});

// =============================================================================
// validateIntegrante
// =============================================================================
describe("validateIntegrante", () => {
  it("integrante completo não gera erro", () => {
    expect(validateIntegrante(integranteValido(), [CPFS_VALIDOS[0]!], 0)).toEqual({});
  });

  it("acusa nome sem sobrenome", () => {
    const e = validateIntegrante(integranteValido({ nomeCompleto: "João" }), [CPFS_VALIDOS[0]!], 0);
    expect(e.nomeCompleto).toBeDefined();
  });

  it("acusa CPF inválido", () => {
    const e = validateIntegrante(integranteValido({ cpf: "111.111.111-11" }), ["111.111.111-11"], 0);
    expect(e.cpf).toBeDefined();
  });

  it("acusa CPF repetido entre integrantes da equipe", () => {
    const cpf = CPFS_VALIDOS[0]!;
    // O integrante no índice 1 tem o mesmo CPF do índice 0.
    const e = validateIntegrante(integranteValido({ cpf }), [cpf, cpf], 1);
    expect(e.cpf).toContain("repetido");
  });

  it("acusa menor de 18 anos", () => {
    const e = validateIntegrante(integranteValido({ dataNascimento: "2010-01-01" }), [CPFS_VALIDOS[0]!], 0);
    expect(e.dataNascimento).toBeDefined();
  });

  it("LinkedIn é opcional: vazio não gera erro", () => {
    const e = validateIntegrante(integranteValido({ linkedin: "" }), [CPFS_VALIDOS[0]!], 0);
    expect(e.linkedin).toBeUndefined();
  });

  it("LinkedIn preenchido com formato errado gera erro", () => {
    const e = validateIntegrante(integranteValido({ linkedin: "github.com/joao" }), [CPFS_VALIDOS[0]!], 0);
    expect(e.linkedin).toBeDefined();
  });

  it("acusa experiência relevante curta demais (< 20 caracteres)", () => {
    const e = validateIntegrante(integranteValido({ experienciaRelevante: "curto" }), [CPFS_VALIDOS[0]!], 0);
    expect(e.experienciaRelevante).toBeDefined();
  });

  it("acusa aceites individuais não marcados", () => {
    const semAceites = integranteValido({ aceites: {} });
    const e = validateIntegrante(semAceites, [CPFS_VALIDOS[0]!], 0);
    expect(e[`aceite_${ACEITES_INDIVIDUAIS[0]!.key}`]).toBeDefined();
  });

  it("acusa nenhuma área de conhecimento marcada", () => {
    const e = validateIntegrante(integranteValido({ areasConhecimento: [] }), [CPFS_VALIDOS[0]!], 0);
    expect(e.areasConhecimento).toBeDefined();
  });
});

// =============================================================================
// validateProposta
// =============================================================================
describe("validateProposta", () => {
  it("proposta completa não gera erro", () => {
    expect(validateProposta(propostaValida())).toEqual({});
  });

  it("acusa cada campo curto demais", () => {
    const e = validateProposta({
      ideiaDiferencial: "curto",
      problemaPublico: "curto",
      aderencia: "curto",
      tecnologias: "x",
    });
    expect(e.ideiaDiferencial).toBeDefined();
    expect(e.problemaPublico).toBeDefined();
    expect(e.aderencia).toBeDefined();
    expect(e.tecnologias).toBeDefined();
  });
});

// =============================================================================
// validateAceitesColetivos
// =============================================================================
describe("validateAceitesColetivos", () => {
  it("todos marcados não gera erro", () => {
    const todos: Record<string, boolean> = {};
    for (const a of ACEITES_COLETIVOS) todos[a.key] = true;
    expect(validateAceitesColetivos(todos)).toEqual({});
  });

  it("acusa aceite coletivo faltando", () => {
    const todos: Record<string, boolean> = {};
    for (const a of ACEITES_COLETIVOS) todos[a.key] = true;
    todos[ACEITES_COLETIVOS[0]!.key] = false;
    const e = validateAceitesColetivos(todos);
    expect(e[ACEITES_COLETIVOS[0]!.key]).toBeDefined();
  });
});

// =============================================================================
// validateLiderConfirmacao
// =============================================================================
describe("validateLiderConfirmacao", () => {
  const lider = integranteValido({ nomeCompleto: "Maria de Souza", cpf: CPFS_VALIDOS[1]! });

  it("confirmação correta não gera erro", () => {
    const e = validateLiderConfirmacao(
      { nomeConfirmacao: "Maria de Souza", cpfConfirmacao: CPFS_VALIDOS[1]!, aceiteFinal: true },
      lider
    );
    expect(e).toEqual({});
  });

  it("tolera diferença de caixa e espaços no nome", () => {
    const e = validateLiderConfirmacao(
      { nomeConfirmacao: "  maria   DE  souza ", cpfConfirmacao: CPFS_VALIDOS[1]!, aceiteFinal: true },
      lider
    );
    expect(e.nomeConfirmacao).toBeUndefined();
  });

  it("acusa nome divergente", () => {
    const e = validateLiderConfirmacao(
      { nomeConfirmacao: "Outro Nome", cpfConfirmacao: CPFS_VALIDOS[1]!, aceiteFinal: true },
      lider
    );
    expect(e.nomeConfirmacao).toBeDefined();
  });

  it("acusa CPF divergente", () => {
    const e = validateLiderConfirmacao(
      { nomeConfirmacao: "Maria de Souza", cpfConfirmacao: CPFS_VALIDOS[2]!, aceiteFinal: true },
      lider
    );
    expect(e.cpfConfirmacao).toBeDefined();
  });

  it("acusa aceite final não marcado", () => {
    const e = validateLiderConfirmacao(
      { nomeConfirmacao: "Maria de Souza", cpfConfirmacao: CPFS_VALIDOS[1]!, aceiteFinal: false },
      lider
    );
    expect(e.aceiteFinal).toBeDefined();
  });
});

// =============================================================================
// validateAll — validação completa server-side
// =============================================================================
describe("validateAll", () => {
  it("um formulário inteiramente válido passa (ok: true, sem erros)", () => {
    const r = validateAll(formValido());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("acusa erro na equipe quando um campo está quebrado", () => {
    const form = formValido();
    form.equipe.nome = "";
    const r = validateAll(form);
    expect(r.ok).toBe(false);
    expect(r.errors.equipe).toBeDefined();
  });

  it("detecta CPF duplicado entre integrantes diferentes", () => {
    const form = formValido();
    form.integrantes[1].cpf = form.integrantes[0].cpf;
    const r = validateAll(form);
    expect(r.ok).toBe(false);
    expect(r.errors.integrantes).toBeDefined();
  });

  it("acusa aceites coletivos faltando", () => {
    const form = formValido();
    form.aceitesColetivos[ACEITES_COLETIVOS[0]!.key] = false;
    const r = validateAll(form);
    expect(r.ok).toBe(false);
    expect(r.errors.aceitesColetivos).toBeDefined();
  });

  it("acusa confirmação do líder divergente", () => {
    const form = formValido();
    form.liderConfirmacao.nomeConfirmacao = "Nome Errado";
    const r = validateAll(form);
    expect(r.ok).toBe(false);
    expect(r.errors.liderConfirmacao).toBeDefined();
  });
});

// =============================================================================
// normalizeForm
// =============================================================================
describe("normalizeForm", () => {
  it("apara espaços, deixa estado em maiúsculas e e-mail em minúsculas", () => {
    const form = formValido();
    form.equipe.nome = "  Equipe Teste  ";
    form.equipe.estado = "rn";
    form.equipe.emailOficial = "  EQUIPE@Example.COM ";
    const out = normalizeForm(form);
    expect(out.equipe.nome).toBe("Equipe Teste");
    expect(out.equipe.estado).toBe("RN");
    expect(out.equipe.emailOficial).toBe("equipe@example.com");
  });

  it("formata CPF e telefone dos integrantes", () => {
    const form = formValido();
    form.integrantes[0].cpf = "11144477735";
    form.integrantes[0].telefoneCelular = "84999998888";
    const out = normalizeForm(form);
    expect(out.integrantes[0].cpf).toBe("111.444.777-35");
    expect(out.integrantes[0].telefoneCelular).toBe("(84) 99999-8888");
  });

  it("apara os campos da proposta", () => {
    const form = formValido();
    form.proposta.tecnologias = "  Next.js, Postgres  ";
    expect(normalizeForm(form).proposta.tecnologias).toBe("Next.js, Postgres");
  });
});

// =============================================================================
// sanitizeDraft — rascunho é dado NÃO confiável
// =============================================================================
describe("sanitizeDraft", () => {
  it("entrada lixo devolve um estado íntegro com 4 integrantes", () => {
    for (const lixo of [null, undefined, "texto", 123, [], true]) {
      const out = sanitizeDraft(lixo);
      expect(out.integrantes).toHaveLength(4);
      expect(out.equipe).toBeDefined();
      expect(out.proposta).toBeDefined();
      expect(out.liderConfirmacao).toBeDefined();
    }
  });

  it("aproveita campos válidos e completa o resto com o padrão", () => {
    const out = sanitizeDraft({ equipe: { nome: "Minha Equipe" } });
    expect(out.equipe.nome).toBe("Minha Equipe");
    expect(out.equipe.cidade).toBe("");
  });

  it("garante sempre 4 integrantes mesmo recebendo menos", () => {
    const out = sanitizeDraft({ integrantes: [{ nomeCompleto: "Só Um" }] });
    expect(out.integrantes).toHaveLength(4);
    expect(out.integrantes[0].nomeCompleto).toBe("Só Um");
    expect(out.integrantes[3].nomeCompleto).toBe("");
  });

  it("aceita liderIndex válido e zera valores fora de 0-3", () => {
    expect(sanitizeDraft({ equipe: { liderIndex: 2 } }).equipe.liderIndex).toBe(2);
    expect(sanitizeDraft({ equipe: { liderIndex: 99 } }).equipe.liderIndex).toBe(0);
    expect(sanitizeDraft({ equipe: { liderIndex: "x" } }).equipe.liderIndex).toBe(0);
  });

  it("ignora valores de tipo errado (não-string, não-boolean)", () => {
    const out = sanitizeDraft({
      equipe: { nome: 999 },
      integrantes: [{ aceites: { maioridade: "sim" } }],
    });
    expect(out.equipe.nome).toBe("");
    expect(out.integrantes[0].aceites.maioridade).toBe(false);
  });

  it("filtra não-strings de areasConhecimento", () => {
    const out = sanitizeDraft({
      integrantes: [{ areasConhecimento: ["Marketing", 5, null, "Design gráfico"] }],
    });
    expect(out.integrantes[0].areasConhecimento).toEqual(["Marketing", "Design gráfico"]);
  });
});

// =============================================================================
// createInitialIntegrante — fábrica precisa devolver instâncias FRESCAS
// =============================================================================
describe("createInitialIntegrante", () => {
  it("não compartilha referências de aceites/areasConhecimento entre chamadas", () => {
    const a = createInitialIntegrante();
    const b = createInitialIntegrante();
    expect(a.aceites).not.toBe(b.aceites);
    expect(a.areasConhecimento).not.toBe(b.areasConhecimento);
    // Mutar um não afeta o outro.
    a.areasConhecimento.push("Marketing");
    expect(b.areasConhecimento).toEqual([]);
  });

  it("já vem com restrições alimentares 'Nenhuma'", () => {
    expect(createInitialIntegrante().restricoesAlimentares).toBe("Nenhuma");
  });
});
