"use client";
// ============================================================================
// components/inscricao-fields/CidadeIbgeSelect.tsx
// ----------------------------------------------------------------------------
// Select de cidade autopreenchido pela API do IBGE
// (https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios).
// Cache em memória por UF compartilhado via ref do componente pai pra evitar
// rede repetida ao trocar/voltar de UF.
// ============================================================================
import { useEffect, useState } from "react";

type Props = {
  estado: string;
  cidade: string;
  onChangeCidade: (v: string) => void;
  cacheCidades: Record<string, string[]>;
  disabled?: boolean;
};

export default function CidadeIbgeSelect({
  estado,
  cidade,
  onChangeCidade,
  cacheCidades,
  disabled,
}: Props) {
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
    <>
      <select
        value={cidade}
        onChange={(e) => onChangeCidade(e.target.value)}
        disabled={!estado || loading || disabled}
      >
        <option value="">
          {!estado
            ? "Escolha o estado primeiro"
            : loading
              ? "Carregando…"
              : "Selecione…"}
        </option>
        {cidades.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {errorFetch && (
        <p className="mt-1 text-xs text-amber-300 normal-case tracking-normal font-normal">
          Não foi possível carregar as cidades — você pode digitar manualmente
          recarregando a página.
        </p>
      )}
    </>
  );
}
