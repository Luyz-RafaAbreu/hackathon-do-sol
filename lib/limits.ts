// Limites de tamanho por campo do formulário de inscrição.
//
// Importado por:
//   - components/Inscricao.tsx → aplicado como maxLength nos inputs/textarea
//   - app/api/inscricao/route.ts → validação server-side (defesa quando o front é burlado)
//
// O scripts/apps-script.gs vive no Google e não consegue importar daqui —
// ele tem uma constante MAX_LENGTHS própria que precisa ser mantida sincronizada
// manualmente. Se mudar algum valor abaixo, atualize lá também.
export const FIELD_MAX_LENGTH = {
  nome: 100,
  email: 254, // RFC 5321 §4.5.3.1.3 — endereço completo até 254
  telefone: 15, // formato visual "(XX) XXXXX-XXXX"
  cidadeEstado: 100, // "Nome de cidade longo/UF"
  instituicao: 150,
  area: 60, // vem de <select>, mas tampa defensiva
  experiencia: 30, // vem de <select>, mas tampa defensiva
  motivacao: 2000,
} as const;

export type FieldName = keyof typeof FIELD_MAX_LENGTH;
