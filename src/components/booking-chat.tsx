"use client";
import { useEffect, useRef, useState } from "react";
import {
  Scissors,
  Check,
  Clock3,
  RotateCcw,
  ChevronLeft,
  CalendarDays,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { services, barbers, money } from "@/lib/catalog";
import { addDays, bookingSchema, displayDate, isOpen, MAX_DAYS, today } from "@/lib/schedule";
import type { Receipt } from "@/lib/store";

type Selection = { serviceId: string; barberId: string; date: string; time: string };
const empty: Selection = { serviceId: "", barberId: "", date: "", time: "" };
type Saved = { appointment: Receipt; token: string };
const storageKey = "bravo-receipt";
function remember(token: string | null) {
  try {
    if (token) sessionStorage.setItem(storageKey, token);
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Receipt still works without browser storage. */
  }
}
async function api(url: string, data: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || "Não foi possível concluir. Tente novamente."), {
      status: response.status,
    });
  return result;
}
function googleCalendarUrl(record: Receipt) {
  const start = new Date(`${record.date}T${record.time}:00-03:00`);
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const end = new Date(start.valueOf() + record.duration * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `BRAVO — ${record.service}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    stz: "America/Sao_Paulo",
    etz: "America/Sao_Paulo",
    details: `Agendamento demonstrativo com ${record.barber}. Nenhum atendimento real será realizado. Cancelar a reserva no site não remove este evento da sua agenda.`,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${params}`;
}

export function BookingChat() {
  const [selection, setSelection] = useState<Selection>(empty);
  const [details, setDetails] = useState({ name: "", phone: "", consent: false });
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const requestId = useRef("");
  const conversation = useRef<HTMLDivElement>(null);
  const { serviceId, barberId, date, time } = selection;
  const service = services.find((s) => s.id === serviceId);
  const barber = barbers.find((b) => b.id === barberId);
  const step = !serviceId ? 0 : !barberId ? 1 : !date ? 2 : !time ? 3 : !review ? 4 : 5;
  const startDate = today();
  const days: string[] = [];
  for (let i = 0; days.length < 6; i++) {
    const value = addDays(startDate, i);
    if (isOpen(value)) days.push(value);
  }

  useEffect(() => {
    requestId.current = crypto.randomUUID();
    const initial = new URLSearchParams(window.location.search).get("servico");
    if (services.some((s) => s.id === initial)) setSelection({ ...empty, serviceId: initial! });
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(storageKey);
    } catch {
      /* Optional browser storage. */
    }
    if (!token) {
      setRestoring(false);
      return;
    }
    let active = true;
    api("/api/appointments/receipt", { token })
      .then((result) => {
        if (active) setSaved({ ...result, token });
      })
      .catch(() => {
        remember(null);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!serviceId || !barberId || !date || saved) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSlots([]);
    fetch(`/api/availability?${new URLSearchParams({ serviceId, barberId, date })}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => setSlots(data.slots))
      .catch((reason) => {
        if (reason.name !== "AbortError")
          setError("Não conseguimos consultar a agenda. Tente novamente.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [serviceId, barberId, date, refresh, saved]);

  useEffect(() => {
    conversation.current?.scrollTo({
      top: conversation.current.scrollHeight,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [step]);

  function choose(key: keyof Selection, value: string) {
    const keys: (keyof Selection)[] = ["serviceId", "barberId", "date", "time"];
    setSelection((previous) => {
      const next = { ...previous, [key]: value };
      keys.slice(keys.indexOf(key) + 1).forEach((k) => {
        next[k] = "";
      });
      return next;
    });
    setReview(false);
    setError("");
    requestId.current = crypto.randomUUID();
  }
  function reset() {
    setSelection(empty);
    setDetails({ name: "", phone: "", consent: false });
    setReview(false);
    setSaved(null);
    setError("");
    setCancelConfirm(false);
    remember(null);
    requestId.current = crypto.randomUUID();
  }
  function back() {
    setError("");
    if (review) {
      setReview(false);
      return;
    }
    const keys: (keyof Selection)[] = ["serviceId", "barberId", "date", "time"];
    if (step > 0) choose(keys[step - 1], "");
  }
  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const result: Saved = await api("/api/appointments", {
        ...selection,
        ...details,
        requestId: requestId.current,
      });
      setSaved(result);
      remember(result.token);
    } catch (reason) {
      const err = reason as Error & { status?: number };
      if (err.status === 409) {
        setSelection((previous) => ({ ...previous, time: "" }));
        setReview(false);
        setRefresh((v) => v + 1);
      }
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function cancel() {
    if (!saved) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api("/api/appointments/receipt", { token: saved.token }, "DELETE");
      setSaved({ ...saved, appointment: result.appointment });
      setCancelConfirm(false);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="chat-card" aria-label="Agendamento com a recepção BRAVO">
      <div className="chat-header">
        <span className="chat-avatar">
          <Scissors size={21} />
        </span>
        <div>
          <strong>Recepção BRAVO</strong>
          <p>Agendamento digital · sem espera</p>
        </div>
        {!saved && !restoring && (
          <button
            onClick={reset}
            className="chat-reset"
            aria-label="Recomeçar agendamento"
            title="Recomeçar"
          >
            <RotateCcw size={17} />
          </button>
        )}
      </div>
      <div className="chat-demo">EXPERIMENTE O AGENDAMENTO · PROJETO DEMONSTRATIVO</div>
      {restoring ? (
        <div className="chat-loading" role="status">
          <LoaderCircle className="spin" size={20} />
          Preparando sua recepção…
        </div>
      ) : saved ? (
        <div className="receipt">
          <div
            className={`receipt-check ${saved.appointment.status === "cancelled" ? "cancelled" : ""}`}
          >
            <Check size={29} />
          </div>
          <p className="eyebrow">
            {saved.appointment.status === "cancelled"
              ? "ATÉ A PRÓXIMA"
              : "SEU MOMENTO ESTÁ RESERVADO"}
          </p>
          <h3>
            {saved.appointment.status === "cancelled"
              ? "Agendamento cancelado."
              : `Tudo certo, ${saved.appointment.name.split(" ")[0]}!`}
          </h3>
          <p>
            {saved.appointment.status === "cancelled"
              ? "O horário foi liberado. Quando quiser, escolha um novo momento."
              : "Seu agendamento demonstrativo foi salvo. Aqui estão os detalhes:"}
          </p>
          <dl className="receipt-details">
            <div>
              <dt>Cuidado</dt>
              <dd>{saved.appointment.service}</dd>
            </div>
            <div>
              <dt>Profissional</dt>
              <dd>{saved.appointment.barber}</dd>
            </div>
            <div>
              <dt>Quando</dt>
              <dd>
                {displayDate(saved.appointment.date)} · {saved.appointment.time}
              </dd>
            </div>
            <div>
              <dt>Duração / valor</dt>
              <dd>
                {saved.appointment.duration} min · {money(saved.appointment.price)}
              </dd>
            </div>
          </dl>
          <p className="receipt-zone">
            Horário de Brasília · Comprovante {saved.appointment.id.slice(0, 8).toUpperCase()}
          </p>
          {saved.appointment.status !== "cancelled" && (
            <>
              <a
                className="button w-full"
                href={googleCalendarUrl(saved.appointment)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalendarDays size={16} />
                Adicionar ao Google Agenda
              </a>
              <p className="control-note">
                Confira os detalhes e salve o agendamento no Google Agenda.
              </p>
              {cancelConfirm ? (
                <div className="cancel-confirm">
                  <p>Deseja mesmo cancelar este horário?</p>
                  <button onClick={cancel} disabled={submitting}>
                    Sim, cancelar
                  </button>
                  <button onClick={() => setCancelConfirm(false)} disabled={submitting}>
                    Manter horário
                  </button>
                </div>
              ) : (
                <button className="quiet-button" onClick={() => setCancelConfirm(true)}>
                  Cancelar agendamento
                </button>
              )}
            </>
          )}
          <button className="quiet-button" onClick={reset}>
            Fazer um novo agendamento
          </button>
          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}
          <p className="privacy-note">
            Esta é uma demonstração. Não há cobrança, atendimento real ou mensagem por WhatsApp. O
            comprovante fica disponível nesta sessão do navegador.
          </p>
        </div>
      ) : (
        <>
          <div className="chat-progress" aria-label={`Etapa ${Math.min(step + 1, 6)} de 6`}>
            <span style={{ width: `${((step + 1) / 6) * 100}%` }} />
          </div>
          <div
            className="chat-conversation"
            ref={conversation}
            role="log"
            aria-live="polite"
            aria-label="Conversa de agendamento"
          >
            <div className="bubble bot">
              Olá! Que bom ter você por aqui. ✦<br />
              Vamos reservar um momento para cuidar do seu estilo?
            </div>
            {service && (
              <>
                <div className="bubble user">
                  {service.name} · {money(service.price)}
                </div>
                <div className="bubble bot">Boa escolha! Quem vai cuidar de você?</div>
              </>
            )}
            {barber && (
              <>
                <div className="bubble user">{barber.name}</div>
                <div className="bubble bot">Combinado. Qual dia fica melhor?</div>
              </>
            )}
            {date && (
              <>
                <div className="bubble user">{displayDate(date)}</div>
                <div className="bubble bot">
                  {loading ? "Consultando a agenda…" : "Agora escolha um dos horários disponíveis."}
                </div>
              </>
            )}
            {time && (
              <>
                <div className="bubble user">Às {time}</div>
                <div className="bubble bot">Perfeito! Como podemos te chamar?</div>
              </>
            )}
            {review && (
              <div className="bubble user">
                {details.name} · {details.phone}
              </div>
            )}
          </div>
          <div className="chat-controls" key={step}>
            <div className="chat-step-label">
              <span>
                {
                  [
                    "ESCOLHA SEU CUIDADO",
                    "ESCOLHA O PROFISSIONAL",
                    "ESCOLHA O DIA",
                    "ESCOLHA O HORÁRIO",
                    "UM ÚLTIMO DETALHE",
                    "CONFIRA SEU AGENDAMENTO",
                  ][step]
                }
              </span>
              <small>{step + 1}/6</small>
            </div>
            {step === 0 && (
              <div className="chat-options">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => choose("serviceId", s.id)}
                    className="choice service-choice"
                  >
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        <Clock3 size={12} />
                        {s.duration} min
                      </small>
                    </span>
                    <b>{money(s.price)}</b>
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="chat-options">
                {barbers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => choose("barberId", b.id)}
                    className="choice barber-choice"
                  >
                    <span className="initials">{b.initials}</span>
                    <span>
                      <strong>{b.name}</strong>
                      <small>{b.specialty}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <>
                <div className="date-grid">
                  {days.map((day) => (
                    <button
                      className="choice date-choice"
                      key={day}
                      onClick={() => choose("date", day)}
                    >
                      <small>
                        {new Intl.DateTimeFormat("pt-BR", {
                          weekday: "short",
                          timeZone: "America/Sao_Paulo",
                        }).format(new Date(`${day}T12:00:00-03:00`))}
                      </small>
                      <strong>{day.slice(-2)}</strong>
                      <small>
                        {new Intl.DateTimeFormat("pt-BR", {
                          month: "short",
                          timeZone: "America/Sao_Paulo",
                        }).format(new Date(`${day}T12:00:00-03:00`))}
                      </small>
                    </button>
                  ))}
                </div>
                <label className="other-date">
                  <CalendarDays size={16} />
                  Ou escolha outra data
                  <input
                    type="date"
                    aria-label="Outra data"
                    min={startDate}
                    max={addDays(startDate, MAX_DAYS)}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      if (!isOpen(event.target.value)) {
                        setError(
                          "Descansamos aos domingos e às segundas. Escolha de terça a sábado.",
                        );
                        return;
                      }
                      choose("date", event.target.value);
                    }}
                  />
                </label>
                <p className="control-note">Até 30 dias à frente · Horário de Brasília</p>
              </>
            )}
            {step === 3 && (
              <>
                {loading ? (
                  <div className="chat-loading" role="status">
                    <LoaderCircle size={20} className="spin" />
                    Buscando horários…
                  </div>
                ) : error ? (
                  <button className="quiet-button" onClick={() => setRefresh((v) => v + 1)}>
                    Tentar consultar novamente
                  </button>
                ) : slots.length === 0 ? (
                  <div className="empty-slots">
                    <CalendarDays size={25} />
                    <p>
                      Esse dia está sem horários disponíveis.
                      <br />
                      Que tal escolher outra data?
                    </p>
                    <button className="quiet-button" onClick={() => choose("date", "")}>
                      Escolher outro dia
                    </button>
                  </div>
                ) : (
                  <div className="time-grid">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        className="choice time-choice"
                        onClick={() => choose("time", slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
                <p className="control-note">
                  Horários de Brasília · Pausa para almoço das 12h às 13h
                </p>
              </>
            )}
            {step === 4 && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const checked = bookingSchema.safeParse({
                    ...selection,
                    ...details,
                    requestId: requestId.current,
                  });
                  if (!checked.success) {
                    setError(checked.error.issues[0].message);
                    return;
                  }
                  setDetails({ name: checked.data.name, phone: checked.data.phone, consent: true });
                  setError("");
                  setReview(true);
                }}
                className="details-form"
              >
                <label>
                  Seu nome
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="given-name"
                    placeholder="Como você gosta de ser chamado?"
                    value={details.name}
                    onChange={(event) => setDetails({ ...details, name: event.target.value })}
                  />
                </label>
                <label>
                  Celular com DDD
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    maxLength={20}
                    placeholder="(11) 99999-9999"
                    value={details.phone}
                    onChange={(event) => setDetails({ ...details, phone: event.target.value })}
                  />
                </label>
                <label className="consent">
                  <input
                    type="checkbox"
                    required
                    checked={details.consent}
                    onChange={(event) => setDetails({ ...details, consent: event.target.checked })}
                  />
                  <span>
                    Concordo em salvar meu nome e celular para este agendamento demonstrativo. Os
                    dados não serão usados para marketing.
                  </span>
                </label>
                <button className="button w-full" type="submit">
                  Revisar agendamento
                </button>
                <p className="control-note">
                  Dica: use dados fictícios para testar este portfólio.
                </p>
              </form>
            )}
            {step === 5 && (
              <div>
                <dl className="receipt-details">
                  <div>
                    <dt>Cuidado</dt>
                    <dd>{service?.name}</dd>
                  </div>
                  <div>
                    <dt>Profissional</dt>
                    <dd>{barber?.name}</dd>
                  </div>
                  <div>
                    <dt>Quando</dt>
                    <dd>
                      {displayDate(date)} · {time}
                    </dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd>
                      {money(service!.price)} · {service?.duration} min
                    </dd>
                  </div>
                </dl>
                <button className="button w-full" onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle size={16} className="spin" />
                      Reservando…
                    </>
                  ) : (
                    <>
                      <Check size={17} />
                      Confirmar meu horário
                    </>
                  )}
                </button>
                <p className="control-note">Sem cobrança. O valor é apenas demonstrativo.</p>
              </div>
            )}
            {error && (
              <p className="chat-error" role="alert">
                {error}
              </p>
            )}
            {step > 0 && (
              <button className="chat-back" onClick={back} disabled={submitting}>
                <ChevronLeft size={14} />
                Voltar
              </button>
            )}
          </div>
          <div className="chat-bottom">
            <ShieldCheck size={13} />
            <span>Seus dados são usados apenas para a reserva.</span>
          </div>
        </>
      )}
    </div>
  );
}
