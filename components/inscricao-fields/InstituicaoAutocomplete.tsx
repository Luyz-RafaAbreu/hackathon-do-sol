"use client";
// ============================================================================
// components/inscricao-fields/InstituicaoAutocomplete.tsx
// ----------------------------------------------------------------------------
// Autocomplete da instituição de ensino. Lazy-load do dataset baseado em
// `nivelFormacao`:
//   • Ensino Médio (em andamento/completo) → lib/escolas-data (~3MB)
//   • Demais níveis → lib/ies-data (~260KB)
//
// Aceita texto livre como fallback. Quando o user seleciona da lista, os
// callbacks recebem também `uf` e `municipio` (auto-preenchimento).
// Extraído do Inscricao.tsx pra reuso no fluxo individual.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { FIELD_MAX } from "@/lib/inscricao-schema";

type Suggestion = {
  sigla?: string;
  nome: string;
  uf: string;
  municipio: string;
};

type SearchFn = (
  query: string,
  limit?: number,
  userLoc?: { cidade: string; uf: string }
) => Suggestion[];

function makeDisplay(s: Suggestion): string {
  return s.sigla ? `${s.nome} (${s.sigla})` : s.nome;
}

type Props = {
  value: string;
  uf: string;
  municipio: string;
  nivelFormacao: string;
  userCidade: string;
  userUf: string;
  onChange: (updates: {
    instituicao: string;
    instituicaoUF: string;
    instituicaoMunicipio: string;
  }) => void;
};

export default function InstituicaoAutocomplete({
  value,
  uf,
  municipio,
  nivelFormacao,
  userCidade,
  userUf,
  onChange,
}: Props) {
  const isEnsMedio = nivelFormacao.startsWith("Ensino Médio");
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [searchFn, setSearchFn] = useState<SearchFn | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 150);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!nivelFormacao) {
      setSearchFn(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (isEnsMedio) {
          const { searchEscolas } = await import("@/lib/escolas-data");
          if (!cancelled) setSearchFn(() => searchEscolas as SearchFn);
        } else {
          const { searchIES } = await import("@/lib/ies-data");
          if (!cancelled) setSearchFn(() => searchIES as SearchFn);
        }
      } catch (err) {
        console.error("Falha ao carregar dataset de instituições:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nivelFormacao, isEnsMedio]);

  const results = useMemo<Suggestion[]>(() => {
    if (!searchFn) return [];
    return searchFn(debouncedQuery, 8, { cidade: userCidade, uf: userUf });
  }, [debouncedQuery, searchFn, userCidade, userUf]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (s: Suggestion) => {
    const display = makeDisplay(s);
    onChange({
      instituicao: display,
      instituicaoUF: s.uf,
      instituicaoMunicipio: s.municipio,
    });
    setQuery(display);
    setOpen(false);
  };

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
        placeholder={isEnsMedio ? "Ex: IFRN" : "Ex: UFRN"}
        maxLength={FIELD_MAX.instituicao}
        autoComplete="off"
      />
      {open && (results.length > 0 || (loading && query.length >= 2)) && (
        <ul
          role="listbox"
          data-lenis-prevent
          className="absolute z-20 mt-1 w-full max-h-60 overflow-auto overscroll-contain rounded-lg border border-white/15 bg-sol-bgDeep shadow-2xl"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-white/55 normal-case tracking-normal font-normal italic">
              Carregando opções…
            </li>
          )}
          {results.map((s, i) => (
            <li
              key={`${s.sigla || ""}-${s.nome}-${s.municipio}-${i}`}
              role="option"
              aria-selected={
                value === makeDisplay(s) && municipio === s.municipio
              }
              onMouseDown={(e) => {
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
          Unidade: {municipio}/{uf}
        </p>
      )}
    </div>
  );
}
