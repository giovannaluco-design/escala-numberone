"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import { FUNCOES_PADRAO, type Funcionario } from "@/lib/tipos";

type Formulario = {
  id: string | null; // null = novo funcionário
  nome: string;
  funcao: string;
  telefone: string;
};

const FORMULARIO_VAZIO: Formulario = {
  id: null,
  nome: "",
  funcao: FUNCOES_PADRAO[0],
  telefone: "",
};

export default function Equipe() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(() => variaveisConfiguradas());
  const [erro, setErro] = useState<string | null>(() =>
    variaveisConfiguradas() ? null : "As variáveis do Supabase não foram configuradas.",
  );
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(
    () =>
      supabase()
        .from("funcionarios")
        .select("id, nome, funcao, telefone, cpf, ativo")
        .order("nome"),
    [],
  );

  const aplicar = useCallback(
    ({ data, error }: Awaited<ReturnType<typeof buscar>>) => {
      if (error) setErro("Não foi possível carregar a equipe. " + error.message);
      else {
        setErro(null);
        setFuncionarios(data ?? []);
      }
      setCarregando(false);
    },
    [],
  );

  async function carregar() {
    aplicar(await buscar());
  }

  useEffect(() => {
    if (!variaveisConfiguradas()) return;
    buscar().then(aplicar);
  }, [buscar, aplicar]);

  // Funções da lista: as padrão e qualquer outra que já exista no banco.
  const funcoes = Array.from(
    new Set([...FUNCOES_PADRAO, ...funcionarios.map((f) => f.funcao)]),
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!formulario) return;
    const nome = formulario.nome.trim();
    if (!nome) {
      setErro("Preencha o nome.");
      return;
    }
    setSalvando(true);
    const dados = {
      nome,
      funcao: formulario.funcao,
      telefone: formulario.telefone.trim() || null,
    };
    const db = supabase().from("funcionarios");
    const { error } = formulario.id
      ? await db.update(dados).eq("id", formulario.id)
      : await db.insert(dados);
    setSalvando(false);
    if (error) {
      setErro("Não foi possível salvar. " + error.message);
      return;
    }
    setFormulario(null);
    carregar();
  }

  async function mudarAtivo(funcionario: Funcionario, ativo: boolean) {
    if (!ativo && !confirm(`Desativar ${funcionario.nome}? Ele(a) sai da escala, mas o cadastro fica guardado.`)) {
      return;
    }
    const { error } = await supabase()
      .from("funcionarios")
      .update({ ativo })
      .eq("id", funcionario.id);
    if (error) setErro("Não foi possível atualizar. " + error.message);
    else carregar();
  }

  const ativos = funcionarios.filter((f) => f.ativo);
  const inativos = funcionarios.filter((f) => !f.ativo);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Equipe</h1>
        {!formulario && (
          <button className="botao" onClick={() => setFormulario(FORMULARIO_VAZIO)}>
            + Adicionar
          </button>
        )}
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      {formulario && (
        <form onSubmit={salvar} className="cartao space-y-3">
          <h2 className="text-lg font-semibold">
            {formulario.id ? "Editar funcionário" : "Novo funcionário"}
          </h2>
          <label className="block">
            <span className="mb-1 block font-medium">Nome</span>
            <input
              className="campo"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Função</span>
            <select
              className="campo"
              value={formulario.funcao}
              onChange={(e) => setFormulario({ ...formulario, funcao: e.target.value })}
            >
              {funcoes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Telefone</span>
            <input
              className="campo"
              type="tel"
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
            />
          </label>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="botao flex-1" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="botao-secundario flex-1"
              onClick={() => setFormulario(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {carregando && <p className="text-neutral-600">Carregando...</p>}

      {!carregando && ativos.length === 0 && !erro && (
        <p className="cartao text-neutral-600">Nenhum funcionário ativo.</p>
      )}

      <ul className="space-y-3">
        {ativos.map((f) => (
          <li key={f.id} className="cartao">
            <p className="text-lg font-semibold">{f.nome}</p>
            <p className="text-neutral-700">{f.funcao}</p>
            {f.telefone && (
              <a href={`tel:${f.telefone}`} className="text-neutral-700 underline">
                {f.telefone}
              </a>
            )}
            <div className="mt-3 flex gap-3">
              <button
                className="botao-secundario flex-1"
                onClick={() =>
                  setFormulario({
                    id: f.id,
                    nome: f.nome,
                    funcao: f.funcao,
                    telefone: f.telefone ?? "",
                  })
                }
              >
                Editar
              </button>
              <button className="botao-secundario flex-1" onClick={() => mudarAtivo(f, false)}>
                Desativar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {inativos.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold text-neutral-600">Desativados</h2>
          <ul className="space-y-3">
            {inativos.map((f) => (
              <li key={f.id} className="cartao opacity-70">
                <p className="text-lg font-semibold">{f.nome}</p>
                <p className="text-neutral-700">{f.funcao}</p>
                <button className="botao-secundario mt-3 w-full" onClick={() => mudarAtivo(f, true)}>
                  Reativar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
