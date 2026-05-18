// Schema canônico da inscrição do Hackathon do Sol 2026.
//
// Esta inscrição é POR EQUIPE de 4 integrantes (item 4.5 do Edital). O schema
// define os tipos, valores iniciais, opções de selects, limites de tamanho e
// validadores puros — compartilhados entre client (components/Inscricao.tsx)
// e server (app/api/inscricao/route.ts).
//
// Aceites (cláusulas individuais e coletivas) seguem o que está descrito no
// arquivo `Formulario_GoogleForms_Hackathon_do_Sol.gs` (fornecido pelo
// chefe), que por sua vez referencia diretamente os itens do Edital
// (3.1, 4.9, 4.12, 4.13.3, 4.15, 11.6, 11.7, 11.9, 12.2, 13.13, etc).
//
// O Apps Script vive no Google e não consegue importar daqui — ele mantém
// constantes equivalentes. Se mudar algum item aqui, atualizar lá também.

export const TRILHAS = [
  "Trilha 1 — Turismo Inteligente e Experiências do Sol",
  "Trilha 2 — Tecnologia para o Bem e Impacto Social",
  "Trilha 3 — Supermercados do Futuro e Varejo Inteligente",
] as const;

// Descrições conforme Formulário de Inscrição (Seção 2), pra ajudar a equipe
// a escolher a trilha. As descrições completas com exemplos estão nos itens
// 5.3.3.1, 5.3.3.2 e 5.3.3.3 do Edital — aqui só o resumo.
export const TRILHAS_DESCRICAO: Record<string, string> = {
  "Trilha 1 — Turismo Inteligente e Experiências do Sol":
    "Para equipes que desejam criar soluções para turismo, experiências, roteiros, cultura, natureza, eventos, mobilidade, gastronomia, hospedagem e promoção do Rio Grande do Norte.",
  "Trilha 2 — Tecnologia para o Bem e Impacto Social":
    "Para equipes que desejam criar soluções para beneficência, voluntariado, doações, transparência, instituições sociais, campanhas solidárias, impacto comunitário e redes de colaboração.",
  "Trilha 3 — Supermercados do Futuro e Varejo Inteligente":
    "Para equipes que desejam criar soluções para supermercados, mercadinhos, varejo alimentar, gestão de estoque, redução de perdas, experiência do consumidor, fidelização, delivery, sustentabilidade e eficiência operacional.",
};

export const AREAS_CONHECIMENTO = [
  "Programação e desenvolvimento de aplicativos web / mobile",
  "Design gráfico",
  "Design digital (UX/UI)",
  "Gestão de negócios",
  "Marketing",
  "Inteligência Artificial / Engenharias e áreas correlatas",
] as const;

export const GENEROS = [
  "Homem cis",
  "Homem trans",
  "Mulher cis",
  "Mulher trans",
  "Não-binário / outra identidade — prefiro conversar com a COMISSÃO ORGANIZADORA sobre acomodação",
] as const;

// Faixas de tempo de experiência na área — pra padronizar a resposta e
// facilitar agrupamento depois. Granularidade maior nos primeiros anos
// porque público do hackathon inclui muito estudante/iniciante.
export const TEMPO_EXPERIENCIA_OPCOES = [
  "Menos de 6 meses",
  "6 meses a 1 ano",
  "1 a 2 anos",
  "2 a 5 anos",
  "5 a 10 anos",
  "Mais de 10 anos",
] as const;

// Opções comuns pro "grau de parentesco" do contato de emergência. A opção
// "Outro" abre input livre na UI pra digitar valor custom.
export const PARENTESCO_OPCOES = [
  "Mãe",
  "Pai",
  "Irmão(ã)",
  "Cônjuge",
  "Filho(a)",
  "Avô(ó)",
  "Tio(a)",
  "Primo(a)",
  "Namorado(a)",
  "Amigo(a)",
  "Responsável legal",
] as const;

export const COMO_SOUBE_OPCOES = [
  "Instagram",
  "LinkedIn",
  "Indicação de amigo / colega",
  "Universidade / faculdade / escola técnica",
  "Empresa onde trabalho",
  "Site oficial do Hackathon do Sol",
  "Outro",
] as const;

// Nível de formação acadêmica — usado no dropdown obrigatório por integrante.
// Inclui "em andamento" do ensino médio porque terceiranistas (17-18 anos)
// podem completar 18 anos até a data do credenciamento (24/06/2026).
// Assume que todo participante tem pelo menos ensino médio em andamento —
// daí não tem "Outro" como fallback.
export const NIVEIS_FORMACAO = [
  "Ensino Médio em andamento",
  "Ensino Médio completo",
  "Graduação em andamento",
  "Graduação completa",
  "Pós-graduação em andamento",
  "Pós-graduação completa",
] as const;

// Áreas/cursos de formação principal — lista enxuta cobrindo as áreas mais
// relevantes pra hackathon. "Outra" no fim pra fallback de texto livre.
export const CURSOS_AREAS = [
  "Ciência da Computação / Engenharia de Software",
  "Sistemas de Informação / Análise e Desenvolvimento",
  "Engenharia (outras)",
  "Design / UX / UI",
  "Administração / Gestão",
  "Marketing / Comunicação",
  "Economia / Negócios",
  "Direito",
  "Saúde / Medicina",
  "Educação / Pedagogia",
  "Letras / Humanas",
  "Outra",
] as const;

// Estados brasileiros — usado nos selects de UF.
export const UFS: ReadonlyArray<readonly [string, string]> = [
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

// =============================================================================
// ACEITES — individuais (por integrante) e coletivos (pela equipe inteira)
// -----------------------------------------------------------------------------
// Cada aceite vira um checkbox obrigatório. A `key` é o identificador interno
// que vai pro payload/planilha; `titulo` aparece em negrito e `texto` é o
// corpo do aceite. Cada texto cita o item do Edital de origem.
// =============================================================================
export type Aceite = {
  key: string;
  titulo: string;
  texto: string;
};

export const ACEITES_INDIVIDUAIS: ReadonlyArray<Aceite> = [
  {
    key: "maioridade",
    titulo: "Declaração de maioridade",
    texto:
      "Declaro, sob as penas da lei, ter idade igual ou superior a 18 (dezoito) anos completos até 24 de junho de 2026 (data do credenciamento), conforme exigência do item 3.1 do Edital, e comprometo-me a apresentar documento original de identificação no credenciamento.",
  },
  {
    key: "edital",
    titulo: "Aceite integral do Edital",
    texto:
      "Declaro que li, compreendi e aceito integralmente o Edital do Hackathon do Sol 2026, em todos os seus itens, anexos e cláusulas, incluindo regras de inscrição, participação, julgamento, premiação, propriedade intelectual e código de conduta.",
  },
  {
    key: "lgpd",
    titulo: "Autorização LGPD — Seção 12 do Edital",
    texto:
      "Autorizo expressamente, nos termos da Lei nº 13.709/2018 (LGPD), o tratamento dos meus dados pessoais fornecidos neste formulário (nome, CPF, e-mail, telefone, endereço, dados profissionais, portfólio e demais informações) pela Convívia LTDA, na qualidade de controladora, para as finalidades previstas no item 12.2 do Edital. Reconheço os direitos previstos no art. 18 da LGPD.",
  },
  {
    key: "imagem",
    titulo: "Autorização de uso de imagem, voz e participação audiovisual — Seção 13 do Edital",
    texto:
      "Autorizo, de forma livre, expressa, gratuita, definitiva e por prazo indeterminado, o uso da minha imagem, voz, nome, depoimentos, entrevistas, falas, reações, participação e demais elementos de identificação pessoal no documentário oficial do Hackathon do Sol, no reality show/documentário \"Inovação em Ação\", em vídeos curtos, Reels, Shorts, Stories, publicações em tempo real e em todo material de divulgação, cobertura, promoção, redes sociais, streaming, televisão e demais meios físicos ou digitais relacionados ao evento, seus realizadores, parceiros, apoiadores e patrocinadores.",
  },
  {
    key: "acomodacao",
    titulo: "Concordância com as regras de acomodação — Item 4.13.3 do Edital",
    texto:
      "Concordo expressamente com as regras de distribuição e ocupação dos quartos previstas no item 4.13.3 do Edital, autorizando: (i) o compartilhamento do quarto com participantes de outras equipes, conforme as regras de recombinação para equipes mistas; (ii) o compartilhamento de cama de casal com outro(a) participante do mesmo gênero, considerando que os quartos comportam 04 (quatro) pessoas em 02 (duas) camas de casal; (iii) que a alocação final dos quartos será definida pela COMISSÃO ORGANIZADORA, de forma soberana.",
  },
  {
    key: "presenca",
    titulo: "Presença obrigatória e permanência no evento — Itens 4.9, 2.3.4 e 13.13 do Edital",
    texto:
      "Comprometo-me a participar de TODAS as atividades obrigatórias do Hackathon do Sol nos dias 26, 27 e 28 de junho de 2026, incluindo programação oficial, palestras, mentorias, dinâmicas, gincanas, jogos, gravações, entrevistas e cerimônia de encerramento. Estou ciente de que ausências injustificadas, saída sem autorização ou recusa em participar das atividades obrigatórias poderão ensejar advertência, perda de pontuação, desclassificação ou eliminação.",
  },
  {
    key: "hotel",
    titulo: "Conformidade com normas do Hotel Praiamar Arena — Item 4.15 do Edital",
    texto:
      "Comprometo-me a cumprir integralmente as normas internas do Hotel Praiamar Arena, incluindo horários de silêncio, regras de uso das áreas comuns, tratamento respeitoso aos funcionários e demais hóspedes, e preservação do mobiliário e instalações. Assumo responsabilidade exclusiva por eventuais danos materiais causados às instalações ou bens do hotel.",
  },
  {
    key: "bens",
    titulo: "Responsabilidade por bens pessoais — Item 4.12 do Edital",
    texto:
      "Reconheço que sou o(a) único(a) responsável pela guarda e cuidado com meus pertences pessoais e equipamentos (notebook, tablet, celular, documentos, bagagens etc.) durante todo o evento, isentando a COMISSÃO ORGANIZADORA, a Convívia LTDA e o Hotel Praiamar Arena de qualquer responsabilidade por perdas, furtos, roubos, extravios ou danos.",
  },
  {
    key: "veracidade",
    titulo: "Veracidade das informações",
    texto:
      "Declaro, sob as penas da lei, que todas as informações por mim prestadas neste formulário são verdadeiras, completas e fidedignas, estando ciente de que a constatação de informações falsas, omissas ou divergentes implicará na desclassificação imediata da equipe.",
  },
];

export const ACEITES_COLETIVOS: ReadonlyArray<Aceite> = [
  {
    key: "originalidade",
    titulo: "Originalidade do projeto e respeito a direitos de terceiros",
    texto:
      "Declaramos que a solução a ser desenvolvida durante o Hackathon do Sol será original, criada exclusivamente por esta equipe durante o evento, e não envolverá violação a direitos autorais, propriedade intelectual, dados pessoais ou quaisquer outros direitos de terceiros. Responsabilizamo-nos integralmente por eventuais danos a terceiros decorrentes do nosso projeto, conforme itens 11.6, 11.7 e 11.9 do Edital.",
  },
  {
    key: "maioridade_equipe",
    titulo: "Maioridade de todos os integrantes",
    texto:
      "Declaramos que TODOS os 04 (quatro) integrantes desta equipe têm idade igual ou superior a 18 (dezoito) anos completos até 24/06/2026, e estamos cientes de que a verificação documental será realizada no ato do credenciamento, sob pena de desclassificação imediata.",
  },
  {
    key: "transporte",
    titulo: "Despesas de transporte — Item 4.13.1 do Edital",
    texto:
      "Reconhecemos que as despesas com transporte de ida e volta ao local do evento são de responsabilidade exclusiva da equipe.",
  },
  {
    key: "decisoes",
    titulo: "Decisões soberanas e irrecorríveis — Itens 8.2.6 e 11.10 do Edital",
    texto:
      "Reconhecemos como soberanas e irrecorríveis as decisões da Banca Julgadora e da COMISSÃO ORGANIZADORA, não cabendo qualquer contestação dos resultados.",
  },
  {
    key: "solidaria",
    titulo: "Responsabilidade solidária da equipe",
    texto:
      "Reconhecemos que a equipe responde de forma solidária pelo cumprimento das regras do Edital e deste Formulário. Estamos cientes de que o descumprimento por qualquer integrante poderá ensejar a desclassificação de toda a equipe, a critério da COMISSÃO ORGANIZADORA.",
  },
  {
    key: "confirmacao",
    titulo: "Confirmação de presença até 16/06/2026",
    texto:
      "Estamos cientes de que, em caso de seleção, devemos confirmar a presença até o dia 16 de junho de 2026 pelo e-mail oficial, sob pena de cancelamento da inscrição e disponibilização da vaga para outra equipe.",
  },
  {
    key: "credenciamento",
    titulo: "Credenciamento presencial em 24/06/2026",
    texto:
      "Estamos cientes de que cada integrante deverá comparecer pessoalmente ao Hotel Praiamar Arena no dia 24 de junho de 2026, das 10h às 14h, munido dos documentos obrigatórios (item 3.3.4 do Edital).",
  },
];

export const ACEITE_LIDER: Aceite = {
  key: "lider_final",
  titulo: "Confirmação final do Líder",
  texto:
    "Eu, na qualidade de Líder da equipe, confirmo que: (a) todos os 04 (quatro) integrantes leram, compreenderam e marcaram pessoalmente os termos de aceite individuais; (b) todos os campos obrigatórios foram preenchidos por completo e com informações verdadeiras; (c) a equipe está ciente de todas as regras, prazos e obrigações do Edital; e (d) reconheço, em nome da equipe, todas as cláusulas marcadas neste formulário, em especial as constantes do Edital do Hackathon do Sol 2026.",
};

// =============================================================================
// TIPOS DO FORM STATE
// =============================================================================

export type AceitesIndividuaisState = Record<string, boolean>;
export type AceitesColetivosState = Record<string, boolean>;

export type IntegranteState = {
  nomeCompleto: string;
  nomeSocial: string;
  cpf: string;
  rg: string;
  dataNascimento: string; // formato ISO yyyy-mm-dd (input type=date)
  nacionalidade: string;
  naturalidade: string;
  cidade: string;
  estado: string;
  enderecoCompleto: string;
  emailPessoal: string;
  telefoneCelular: string;
  contatoEmergenciaNome: string;
  contatoEmergenciaTelefone: string;
  contatoEmergenciaParentesco: string;
  genero: string;
  areasConhecimento: string[]; // multi-select
  ocupacaoAtual: string;
  tempoExperiencia: string;
  // Formação Acadêmica (substituiu o campo único de texto livre).
  // Apenas `nivelFormacao` é obrigatório; o resto é opcional.
  nivelFormacao: string;        // uma das opções de NIVEIS_FORMACAO
  cursoFormacao: string;        // uma das opções de CURSOS_AREAS (opcional)
  anoFormacao: string;          // ano de ingresso ou previsão de formatura
  instituicao: string;          // nome completo da IES (auto-preenchido pelo autocomplete)
  instituicaoUF: string;        // UF da sede da IES (auto-preenchido)
  instituicaoMunicipio: string; // município da sede (auto-preenchido)
  projetoAcademico: string;     // descrição livre, opcional
  linkedin: string;
  portfolio: string;
  outrasRedes: string; // opcional — outras redes sociais relevantes
  experienciaRelevante: string;
  restricoesAlimentares: string;
  alergias: string;
  medicamentos: string; // opcional — medicamentos contínuos relevantes
  acessibilidade: string;
  outrasObservacoes: string;
  comoSoube: string;
  aceites: AceitesIndividuaisState;
};

export type EquipeState = {
  nome: string;
  slogan: string;
  cidade: string;
  estado: string;
  emailOficial: string;
  telefone: string;
  trilha: string;
  liderIndex: 0 | 1 | 2 | 3;
};

export type PropostaState = {
  // Fundidos do schema original (6 → 4 campos):
  //   • ideiaDiferencial = resumo + diferencial (ideia + o que a torna inovadora)
  //   • problemaPublico  = problema + público beneficiado
  //   • aderencia        = mantido (critério de avaliação do item 5.3.4 do Edital)
  //   • tecnologias      = mantido (lista específica)
  ideiaDiferencial: string;
  problemaPublico: string;
  aderencia: string;
  tecnologias: string;
};

export type LiderConfirmacaoState = {
  nomeConfirmacao: string;
  cpfConfirmacao: string;
  aceiteFinal: boolean;
};

export type InscricaoFormState = {
  equipe: EquipeState;
  integrantes: [IntegranteState, IntegranteState, IntegranteState, IntegranteState];
  proposta: PropostaState;
  aceitesColetivos: AceitesColetivosState;
  liderConfirmacao: LiderConfirmacaoState;
};

// =============================================================================
// INITIAL STATE
// =============================================================================

export const INITIAL_ACEITES_INDIVIDUAIS: AceitesIndividuaisState =
  ACEITES_INDIVIDUAIS.reduce<AceitesIndividuaisState>((acc, a) => {
    acc[a.key] = false;
    return acc;
  }, {});

export const INITIAL_ACEITES_COLETIVOS: AceitesColetivosState =
  ACEITES_COLETIVOS.reduce<AceitesColetivosState>((acc, a) => {
    acc[a.key] = false;
    return acc;
  }, {});

// Factory pra integrante zerado — sempre retorna instâncias FRESCAS de
// `aceites` (objeto) e `areasConhecimento` (array). Não exportamos um
// `INITIAL_INTEGRANTE` constante porque ele compartilharia referências entre
// os 4 integrantes do form (mutação em um afetaria os outros).
export function createInitialIntegrante(): IntegranteState {
  return {
    nomeCompleto: "",
    nomeSocial: "",
    cpf: "",
    rg: "",
    dataNascimento: "",
    nacionalidade: "",
    naturalidade: "",
    cidade: "",
    estado: "",
    enderecoCompleto: "",
    emailPessoal: "",
    telefoneCelular: "",
    contatoEmergenciaNome: "",
    contatoEmergenciaTelefone: "",
    contatoEmergenciaParentesco: "",
    genero: "",
    areasConhecimento: [],
    ocupacaoAtual: "",
    tempoExperiencia: "",
    nivelFormacao: "",
    cursoFormacao: "",
    anoFormacao: "",
    instituicao: "",
    instituicaoUF: "",
    instituicaoMunicipio: "",
    projetoAcademico: "",
    linkedin: "",
    portfolio: "",
    outrasRedes: "",
    experienciaRelevante: "",
    restricoesAlimentares: "Nenhuma",
    alergias: "",
    medicamentos: "",
    acessibilidade: "",
    outrasObservacoes: "",
    comoSoube: "",
    aceites: { ...INITIAL_ACEITES_INDIVIDUAIS },
  };
}

export const INITIAL_FORM_STATE: InscricaoFormState = {
  equipe: {
    nome: "",
    slogan: "",
    cidade: "",
    estado: "",
    emailOficial: "",
    telefone: "",
    trilha: "",
    liderIndex: 0,
  },
  integrantes: [
    createInitialIntegrante(),
    createInitialIntegrante(),
    createInitialIntegrante(),
    createInitialIntegrante(),
  ],
  proposta: {
    ideiaDiferencial: "",
    problemaPublico: "",
    aderencia: "",
    tecnologias: "",
  },
  aceitesColetivos: { ...INITIAL_ACEITES_COLETIVOS },
  liderConfirmacao: {
    nomeConfirmacao: "",
    cpfConfirmacao: "",
    aceiteFinal: false,
  },
};

// =============================================================================
// LIMITES DE TAMANHO POR CAMPO
// -----------------------------------------------------------------------------
// Usado em `maxLength` nos inputs E em validação server-side. Mantém o payload
// previsível e impede que alguém burle o front com curl. Os comentários abaixo
// explicam por que cada limite foi escolhido.
// =============================================================================
export const FIELD_MAX = {
  // Equipe
  equipeNome: 60,
  equipeSlogan: 120,
  equipeCidade: 60,
  equipeEstado: 2,
  equipeEmail: 254, // RFC 5321
  equipeTelefone: 20,
  equipeTrilha: 120,
  // Integrante — dados pessoais
  nomeCompleto: 120,
  nomeSocial: 120,
  cpf: 14, // formato visual "000.000.000-00"
  rg: 30,
  dataNascimento: 10, // yyyy-mm-dd
  nacionalidade: 50,
  naturalidade: 100,
  cidade: 60,
  estado: 2,
  enderecoCompleto: 250,
  emailPessoal: 254,
  telefoneCelular: 20,
  contatoEmergenciaNome: 120,
  contatoEmergenciaTelefone: 20,
  contatoEmergenciaParentesco: 50,
  genero: 120,
  ocupacaoAtual: 150,
  tempoExperiencia: 50,
  nivelFormacao: 60,
  cursoFormacao: 80,
  anoFormacao: 4,
  instituicao: 200,
  instituicaoUF: 2,
  instituicaoMunicipio: 80,
  projetoAcademico: 1000,
  linkedin: 200,
  portfolio: 200,
  outrasRedes: 250,
  experienciaRelevante: 1500,
  restricoesAlimentares: 500,
  alergias: 500,
  medicamentos: 500,
  acessibilidade: 500,
  outrasObservacoes: 1000,
  comoSoube: 60,
  // Proposta (4 campos, fundidos de 6)
  propostaIdeiaDiferencial: 2500, // resumo (2000) + diferencial (1000) → cap em 2500
  propostaProblemaPublico: 1500,  // problema (1000) + público (600) → cap em 1500
  propostaAderencia: 1000,
  propostaTecnologias: 1000,
} as const;

// =============================================================================
// VALIDADORES PUROS
// =============================================================================

// Valida CPF brasileiro pelo algoritmo dos dígitos verificadores. Aceita com ou
// sem máscara. Rejeita repetições óbvias (000.000.000-00, 111.111.111-11, etc).
export function isValidCPF(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (size: number) => {
    let sum = 0;
    for (let i = 0; i < size; i++) {
      sum += parseInt(digits[i]!, 10) * (size + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(9);
  if (d1 !== parseInt(digits[9]!, 10)) return false;
  const d2 = calc(10);
  if (d2 !== parseInt(digits[10]!, 10)) return false;
  return true;
}

export function formatCPF(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length < 3) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhoneBR(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

// Item 3.1 do Edital — idade ≥ 18 anos completos até 24/06/2026 (data do
// credenciamento). Ou seja: nascido em ou antes de 24/06/2008.
const CREDENCIAMENTO_LIMITE = new Date(2008, 5, 24); // mês é 0-indexed: 5 = junho
export function isAdultByCredenciamento(iso: string): boolean {
  if (!iso) return false;
  const dt = new Date(iso + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getTime() <= CREDENCIAMENTO_LIMITE.getTime();
}

// LinkedIn: aceita URL completa do linkedin.com/in/<perfil> ou versões com
// www., http(s) e barras finais. Loose mas pega o caso comum.
export function isValidLinkedIn(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return false;
  return /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-z0-9\-_%.]+\/?/.test(v);
}

// URL genérica — pra portfolio, GitHub, Behance, qualquer link de divulgação.
export function isValidUrl(raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

// =============================================================================
// VALIDAÇÕES POR ETAPA — usadas pelo wizard pra travar avanço e pelo server
// pra validar o payload final.
// =============================================================================
export type StepErrors = Record<string, string>;

export function validateEquipe(eq: EquipeState): StepErrors {
  const e: StepErrors = {};
  if (!eq.nome.trim()) e.nome = "Informe o nome da equipe.";
  if (!eq.cidade.trim()) e.cidade = "Informe a cidade base da equipe.";
  if (!eq.estado.trim()) e.estado = "Informe o estado.";
  if (!isValidEmail(eq.emailOficial))
    e.emailOficial = "E-mail oficial inválido.";
  if (!isValidPhoneBR(eq.telefone))
    e.telefone = "Telefone inválido. Inclua DDD.";
  return e;
}

export function validateTrilha(eq: EquipeState): StepErrors {
  const e: StepErrors = {};
  if (!eq.trilha) e.trilha = "Escolha a trilha temática da equipe.";
  return e;
}

export function validateIntegrante(
  i: IntegranteState,
  todosCPFs: string[],
  meuIndex: number
): StepErrors {
  const e: StepErrors = {};
  if (!/\S+\s+\S+/.test(i.nomeCompleto.trim()))
    e.nomeCompleto = "Informe o nome completo.";
  if (!isValidCPF(i.cpf)) e.cpf = "CPF inválido.";
  else {
    // Item 3.2 do Edital — 1 inscrição por CPF (não pode repetir entre
    // integrantes da mesma equipe).
    const meuDigits = i.cpf.replace(/\D/g, "");
    const dup = todosCPFs.some(
      (c, idx) => idx !== meuIndex && c.replace(/\D/g, "") === meuDigits && c
    );
    if (dup) e.cpf = "CPF repetido entre integrantes da equipe.";
  }
  if (!i.rg.trim()) e.rg = "Informe o RG e órgão expedidor.";
  if (!isAdultByCredenciamento(i.dataNascimento))
    e.dataNascimento = "Precisa ter 18 anos completos até 24/06/2026.";
  if (!i.nacionalidade.trim()) e.nacionalidade = "Informe a nacionalidade.";
  if (!i.naturalidade.trim())
    e.naturalidade = "Informe a naturalidade (cidade/UF).";
  if (!i.cidade.trim()) e.cidade = "Informe a cidade onde reside.";
  if (!i.estado.trim()) e.estado = "Informe o estado.";
  if (!i.enderecoCompleto.trim())
    e.enderecoCompleto = "Informe o endereço completo.";
  if (!isValidEmail(i.emailPessoal)) e.emailPessoal = "E-mail inválido.";
  if (!isValidPhoneBR(i.telefoneCelular))
    e.telefoneCelular = "Telefone inválido. Inclua DDD.";
  if (!i.contatoEmergenciaNome.trim())
    e.contatoEmergenciaNome = "Informe o contato de emergência.";
  if (!isValidPhoneBR(i.contatoEmergenciaTelefone))
    e.contatoEmergenciaTelefone = "Telefone do contato de emergência inválido.";
  if (!i.contatoEmergenciaParentesco.trim())
    e.contatoEmergenciaParentesco = "Informe o grau de parentesco.";
  if (!i.genero) e.genero = "Selecione uma opção.";
  if (i.areasConhecimento.length === 0)
    e.areasConhecimento = "Marque ao menos uma área.";
  if (!i.ocupacaoAtual.trim()) e.ocupacaoAtual = "Informe a ocupação atual.";
  if (!i.tempoExperiencia.trim())
    e.tempoExperiencia = "Informe o tempo de experiência.";
  // Apenas o nível é obrigatório — o resto é opcional pra reduzir fricção.
  if (!i.nivelFormacao.trim())
    e.nivelFormacao = "Selecione o seu nível de formação.";
  if (i.anoFormacao.trim() && !/^\d{4}$/.test(i.anoFormacao.trim()))
    e.anoFormacao = "Informe um ano com 4 dígitos (ex: 2024).";
  if (!isValidLinkedIn(i.linkedin))
    e.linkedin = "Informe o link do LinkedIn (linkedin.com/in/seu-perfil).";
  if (i.portfolio.trim() && !isValidUrl(i.portfolio))
    e.portfolio = "Link de portfólio inválido.";
  if (i.experienciaRelevante.trim().length < 20)
    e.experienciaRelevante = "Conte um pouco mais (mín. 20 caracteres).";
  if (!i.restricoesAlimentares.trim())
    e.restricoesAlimentares = "Descreva suas restrições ou desmarque a opção acima.";
  if (!i.comoSoube) e.comoSoube = "Selecione uma opção.";
  // Aceites individuais — todos obrigatórios.
  for (const a of ACEITES_INDIVIDUAIS) {
    if (!i.aceites[a.key]) e[`aceite_${a.key}`] = "Marque para continuar.";
  }
  return e;
}

export function validateProposta(p: PropostaState): StepErrors {
  const e: StepErrors = {};
  if (p.ideiaDiferencial.trim().length < 60)
    e.ideiaDiferencial =
      "Apresente a ideia + o que torna ela inovadora (mín. 60 caracteres).";
  if (p.problemaPublico.trim().length < 40)
    e.problemaPublico =
      "Descreva o problema e quem se beneficia (mín. 40 caracteres).";
  if (p.aderencia.trim().length < 30)
    e.aderencia = "Explique a aderência à trilha (mín. 30 caracteres).";
  if (p.tecnologias.trim().length < 10)
    e.tecnologias = "Liste as tecnologias previstas.";
  return e;
}

export function validateAceitesColetivos(a: AceitesColetivosState): StepErrors {
  const e: StepErrors = {};
  for (const ac of ACEITES_COLETIVOS) {
    if (!a[ac.key]) e[ac.key] = "Marque para continuar.";
  }
  return e;
}

export function validateLiderConfirmacao(
  l: LiderConfirmacaoState,
  lider: IntegranteState
): StepErrors {
  const e: StepErrors = {};
  if (l.nomeConfirmacao.trim().toLowerCase() !== lider.nomeCompleto.trim().toLowerCase())
    e.nomeConfirmacao = "Deve bater com o nome completo do líder.";
  if (l.cpfConfirmacao.replace(/\D/g, "") !== lider.cpf.replace(/\D/g, ""))
    e.cpfConfirmacao = "Deve bater com o CPF do líder.";
  if (!l.aceiteFinal) e.aceiteFinal = "Marque o aceite final para enviar.";
  return e;
}

// Validação completa (server-side) — devolve { ok, errors } pra resposta clara.
export function validateAll(state: InscricaoFormState): {
  ok: boolean;
  errors: Record<string, StepErrors | StepErrors[]>;
} {
  const errors: Record<string, StepErrors | StepErrors[]> = {};
  const eq = validateEquipe(state.equipe);
  if (Object.keys(eq).length) errors.equipe = eq;
  const tr = validateTrilha(state.equipe);
  if (Object.keys(tr).length) errors.trilha = tr;
  const todosCPFs = state.integrantes.map((i) => i.cpf);
  const integrantes = state.integrantes.map((i, idx) =>
    validateIntegrante(i, todosCPFs, idx)
  );
  if (integrantes.some((x) => Object.keys(x).length))
    errors.integrantes = integrantes;
  const prop = validateProposta(state.proposta);
  if (Object.keys(prop).length) errors.proposta = prop;
  const col = validateAceitesColetivos(state.aceitesColetivos);
  if (Object.keys(col).length) errors.aceitesColetivos = col;
  const liderIdx = state.equipe.liderIndex;
  const lid = validateLiderConfirmacao(
    state.liderConfirmacao,
    state.integrantes[liderIdx]!
  );
  if (Object.keys(lid).length) errors.liderConfirmacao = lid;
  return { ok: Object.keys(errors).length === 0, errors };
}

// Normaliza payload pré-envio (trim, formata telefones/CPFs, lowercase email).
export function normalizeForm(state: InscricaoFormState): InscricaoFormState {
  return {
    equipe: {
      ...state.equipe,
      nome: state.equipe.nome.trim(),
      slogan: state.equipe.slogan.trim(),
      cidade: state.equipe.cidade.trim(),
      estado: state.equipe.estado.trim().toUpperCase(),
      emailOficial: state.equipe.emailOficial.trim().toLowerCase(),
      telefone: formatPhoneBR(state.equipe.telefone),
    },
    integrantes: state.integrantes.map((i) => ({
      ...i,
      nomeCompleto: i.nomeCompleto.trim(),
      nomeSocial: i.nomeSocial.trim(),
      cpf: formatCPF(i.cpf),
      rg: i.rg.trim(),
      nacionalidade: i.nacionalidade.trim(),
      naturalidade: i.naturalidade.trim(),
      cidade: i.cidade.trim(),
      estado: i.estado.trim().toUpperCase(),
      enderecoCompleto: i.enderecoCompleto.trim(),
      emailPessoal: i.emailPessoal.trim().toLowerCase(),
      telefoneCelular: formatPhoneBR(i.telefoneCelular),
      contatoEmergenciaNome: i.contatoEmergenciaNome.trim(),
      contatoEmergenciaTelefone: formatPhoneBR(i.contatoEmergenciaTelefone),
      contatoEmergenciaParentesco: i.contatoEmergenciaParentesco.trim(),
      ocupacaoAtual: i.ocupacaoAtual.trim(),
      tempoExperiencia: i.tempoExperiencia.trim(),
      nivelFormacao: i.nivelFormacao.trim(),
      cursoFormacao: i.cursoFormacao.trim(),
      anoFormacao: i.anoFormacao.trim(),
      instituicao: i.instituicao.trim(),
      instituicaoUF: i.instituicaoUF.trim().toUpperCase(),
      instituicaoMunicipio: i.instituicaoMunicipio.trim(),
      projetoAcademico: i.projetoAcademico.trim(),
      linkedin: i.linkedin.trim(),
      portfolio: i.portfolio.trim(),
      outrasRedes: i.outrasRedes.trim(),
      experienciaRelevante: i.experienciaRelevante.trim(),
      restricoesAlimentares: i.restricoesAlimentares.trim(),
      alergias: i.alergias.trim(),
      medicamentos: i.medicamentos.trim(),
      acessibilidade: i.acessibilidade.trim(),
      outrasObservacoes: i.outrasObservacoes.trim(),
    })) as InscricaoFormState["integrantes"],
    proposta: {
      ideiaDiferencial: state.proposta.ideiaDiferencial.trim(),
      problemaPublico: state.proposta.problemaPublico.trim(),
      aderencia: state.proposta.aderencia.trim(),
      tecnologias: state.proposta.tecnologias.trim(),
    },
    aceitesColetivos: state.aceitesColetivos,
    liderConfirmacao: state.liderConfirmacao,
  };
}
