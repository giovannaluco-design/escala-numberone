"use client";

import { useEffect, useState } from "react";
import { supabase, variaveisConfiguradas } from "@/lib/supabase";
import type { Escala, Funcionario, Turno } from "@/lib/tipos";
import {
  DIAS_SEMANA,
  diaMes,
  diasDaSemana,
  hojeISO,
  horaCurta,
  inicioDaSemana,
  paraData,
  rotuloDia,
  somarDias,
} from "@/lib/datas";

type CelulaAberta = { data: string; turno: Turno } | null;

export default function EscalaDaSemana() {
  const [segunda, setSegunda] = useState(() => inicioDaSemana(hojeISO()));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(() => variaveisConfiguradas());
  const [erro, setErro] = useState<string | null>(() =>
    variaveisConfiguradas() ? null : "As variáveis do Supabase não foram configuradas.",
  );
  const [celula, setCelula] = useState<CelulaAberta>(null);
  const [ocupado, setOcupado] = useState<string | null>(null); // id do funcionário sendo salvo

  const dias = diasDaSemana(segunda);

  function mudarSemana(novaSegunda: string) {
    if (novaSegunda === segunda) return;
    if (variaveisConfiguradas()) setCarregando(true);
    setSegunda(novaSegunda);
  }
  const hoje = hojeISO();

  // Turnos e funcionários: carregados uma vez.
  useEffect(() => {
    if (!variaveisConfiguradas()) return;
    (async () => {
      const db = supabase();
      const [t, f] = await Promise.all([
        db.from("turnos").select("id, nome, hora_inicio, hora_fim, ordem").order("ordem"),
        db.from("funcionarios").select("id, nome, funcao, telefone, cpf, ativo").order("nome"),
      ]);
      if (t.error || f.error) {
        setErro("Não foi possível carregar os dados. " + (t.error ?? f.error)?.message);
        return;
      }
      setTurnos(t.data ?? []);
      setFuncionarios(f.data ?? []);
    })();
  }, []);

  // Escala da semana: recarregada quando a semana muda.
  useEffect(() => {
    if (!variaveisConfiguradas()) return;
    let valido = true;
    supabase()
      .from("escalas")
      .select("id, data, turno_id, funcionario_id")
      .gte("data", segunda)
      .lte("data", somarDias(segunda, 6))
      .then(({ data, error }) => {
        if (!valido) return; // o usuário já trocou de semana
        if (error) setErro("Não foi possível carregar a escala. " + error.message);
        else setEscalas(data ?? []);
        setCarregando(false);
      });
    return () => {
      valido = false;
    };
  }, [segunda]);

  const porId = new Map(funcionarios.map((f) => [f.id, f]));
  const ativos = funcionarios.filter((f) => f.ativo);

  function escaladosNa(data: string, turnoId: string): Escala[] {
    return escalas.filter((e) => e.data === data && e.turno_id === turnoId);
  }

  async function alternar(funcionario: Funcionario) {
    if (!celula) return;
    const { data, turno } = celula;
    const existente = escalas.find(
      (e) => e.data === data && e.turno_id === turno.id && e.funcionario_id === funcionario.id,
    );
    setOcupado(funcionario.id);
    setErro(null);
    const db = supabase().from("escalas");
    if (existente) {
      const { error } = await db.delete().eq("id", existente.id);
      if (error) setErro("Não foi possível tirar da escala. " + error.message);
      else setEscalas((atual) => atual.filter((e) => e.id !== existente.id));
    } else {
      const { data: nova, error } = await db
        .insert({ data, turno_id: turno.id, funcionario_id: funcionario.id })
        .select("id, data, turno_id, funcionario_id")
        .single();
      if (error) setErro("Não foi possível colocar na escala. " + error.message);
      else if (nova) setEscalas((atual) => [...atual, nova]);
    }
    setOcupado(null);
  }

  // Inclui na lista do painel quem está desativado mas já estava escalado nessa célula.
  const listaDoPainel = celula
    ? [
        ...ativos,
        ...escaladosNa(celula.data, celula.turno.id)
          .map((e) => porId.get(e.funcionario_id))
          .filter((f): f is Funcionario => Boolean(f && !f.ativo)),
      ]
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Escala da semana</h1>

      <div className="flex items-center gap-2">
        <button
          className="botao-secundario px-3"
          onClick={() => mudarSemana(somarDias(segunda, -7))}
          aria-label="Semana anterior"
        >
          ◀ Anterior
        </button>
        <div className="flex-1 text-center">
          <p className="font-semibold">
            {diaMes(segunda)} a {diaMes(somarDias(segunda, 6))}
          </p>
          {segunda !== inicioDaSemana(hoje) && (
            <button
              className="text-sm underline"
              style={{ color: "var(--cor-principal)" }}
              onClick={() => mudarSemana(inicioDaSemana(hoje))}
            >
              Voltar para esta semana
            </button>
          )}
        </div>
        <button
          className="botao-secundario px-3"
          onClick={() => mudarSemana(somarDias(segunda, 7))}
          aria-label="Próxima semana"
        >
          Próxima ▶
        </button>
      </div>

      {erro && <p className="cartao border-red-300 text-red-700">{erro}</p>}

      <p className="text-sm text-neutral-600">
        Toque em uma célula para escolher quem trabalha. Arraste a grade para o lado para ver
        todos os dias.
      </p>

      <div className={`cartao overflow-x-auto p-0 ${carregando ? "opacity-60" : ""}`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] min-w-[84px] border-b border-neutral-200 bg-white p-2 text-left">
                Turno
              </th>
              {dias.map((d) => (
                <th
                  key={d}
                  className={`min-w-[96px] border-b border-l border-neutral-200 p-2 text-center ${
                    d === hoje ? "bg-neutral-100" : ""
                  }`}
                >
                  {rotuloDia(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <th className="sticky left-0 z-[1] border-b border-neutral-200 bg-white p-2 text-left align-top">
                  <span className="block font-semibold">{t.nome}</span>
                  <span className="block text-xs font-normal text-neutral-500">
                    {horaCurta(t.hora_inicio)}–{horaCurta(t.hora_fim)}
                  </span>
                </th>
                {dias.map((d) => {
                  const escalados = escaladosNa(d, t.id);
                  return (
                    <td key={d} className="border-b border-l border-neutral-200 p-1 align-top">
                      <button
                        className={`flex min-h-[88px] w-full flex-col items-start gap-1 rounded-lg p-1.5 text-left active:bg-neutral-100 ${
                          d === hoje ? "bg-neutral-50" : ""
                        }`}
                        onClick={() => setCelula({ data: d, turno: t })}
                      >
                        {escalados.length === 0 ? (
                          <span className="text-neutral-400">+ Escolher</span>
                        ) : (
                          escalados.map((e) => (
                            <span
                              key={e.id}
                              className="w-full truncate rounded-md bg-neutral-100 px-1.5 py-0.5"
                            >
                              {porId.get(e.funcionario_id)?.nome.split(" ")[0] ?? "?"}
                            </span>
                          ))
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {celula && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setCelula(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">
              {celula.turno.nome} · {DIAS_SEMANA[paraData(celula.data).getDay()]}{" "}
              {diaMes(celula.data)}
            </h2>
            <p className="mb-3 text-sm text-neutral-600">
              Toque no nome para colocar ou tirar da escala. Salva na hora.
            </p>
            {erro && <p className="mb-3 text-red-700">{erro}</p>}
            <ul className="space-y-2">
              {listaDoPainel.map((f) => {
                const marcado = escaladosNa(celula.data, celula.turno.id).some(
                  (e) => e.funcionario_id === f.id,
                );
                return (
                  <li key={f.id}>
                    <button
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left disabled:opacity-50 ${
                        marcado ? "border-transparent text-white" : "border-neutral-300 bg-white"
                      }`}
                      style={marcado ? { background: "var(--cor-principal)" } : undefined}
                      onClick={() => alternar(f)}
                      disabled={ocupado !== null}
                    >
                      <span className="text-xl">{marcado ? "✓" : "○"}</span>
                      <span className="flex-1">
                        <span className="block font-semibold">{f.nome}</span>
                        <span className={`block text-sm ${marcado ? "text-white/80" : "text-neutral-600"}`}>
                          {f.funcao}
                          {!f.ativo && " · desativado"}
                        </span>
                      </span>
                      {ocupado === f.id && <span className="text-sm">...</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {listaDoPainel.length === 0 && (
              <p className="text-neutral-600">Nenhum funcionário ativo. Cadastre na tela Equipe.</p>
            )}
            <button className="botao mt-4 w-full" onClick={() => setCelula(null)}>
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
