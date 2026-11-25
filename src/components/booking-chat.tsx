"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Scissors,
  Check,
  Clock3,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  UserRound,
  Sparkles,
  Pencil,
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
const stages = [
  {
    label: "Serviço",
    title: "Qual cuidado combina com você?",
    description: "Escolha o seu ritual. Cada serviço tem seu tempo e atenção.",
  },
  {
    label: "Profissional",
    title: "Nas mãos de quem entende.",
    description: "Escolha o profissional que vai cuidar do seu estilo.",
  },
  {
    label: "Dia",
    title: "Encontre o seu melhor dia.",
    description: "Selecione uma data no calendário. Atendemos de terça a sábado.",
  },
  {
    label: "Horário",
    title: "Um momento só para você.",
    description: "Estes são os horários disponíveis para o serviço e profissional escolhidos.",
  },
  {
    label: "Seus dados",
    title: "Como podemos te chamar?",
    description: "Só o essencial para identificar sua reserva. Sem criar uma conta.",
  },
  {
    label: "Revisão",
    title: "Tudo pronto para reservar.",
    description: "Confira os detalhes antes de confirmar seu horário.",
  },
];
function moveMonth(month: string, offset: number) {
  const value = new Date(`${month}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 7);
}
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
  const stageTitle = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const [calendarMonth, setCalendarMonth] = useState(() => today().slice(0, 7));
  const { serviceId, barberId, date, time } = selection;
  const service = services.find((s) => s.id === serviceId);
  const barber = barbers.find((b) => b.id === barberId);
  const step = !serviceId ? 0 : !barberId ? 1 : !date ? 2 : !time ? 3 : !review ? 4 : 5;
  const startDate = today();
  const lastDate = addDays(startDate, MAX_DAYS);
  const monthStart = `${calendarMonth}-01`;
  const monthDays = new Date(
    Date.UTC(Number(calendarMonth.slice(0, 4)), Number(calendarMonth.slice(5)), 0),
  ).getUTCDate();
  const leadingDays = (new Date(`${monthStart}T12:00:00Z`).getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T12:00:00Z`));
  const days = Array.from(
    { length: monthDays },
    (_, i) => `${calendarMonth}-${String(i + 1).padStart(2, "0")}`,
  );

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
    if (previousStep.current !== step) stageTitle.current?.focus({ preventScroll: true });
    previousStep.current = step;
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
    setCalendarMonth(today().slice(0, 7));
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
    <div className="chat-card booking-studio" aria-label="Agendamento com a recepção BRAVO">
      <div className="chat-header">
        <span className="chat-avatar">
          <Scissors size={21} />
        </span>
        <div>
          <strong>Seu momento BRAVO</strong>
          <p>Agendamento online · sem cadastro</p>
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
          <ol className="booking-stepper" aria-label="Etapas do agendamento">
            {stages.map((stage, index) => (
              <li
                key={stage.label}
                className={index < step ? "is-complete" : index === step ? "is-current" : ""}
                aria-current={index === step ? "step" : undefined}
              >
                <button
                  disabled={index >= step || submitting}
                  aria-label={`Etapa ${index + 1}: ${stage.label}`}
                  onClick={() => {
                    if (index === 4) setReview(false);
                    else choose((["serviceId", "barberId", "date", "time"] as const)[index], "");
                  }}
                >
                  <span className="step-number">
                    {index < step ? <Check size={15} /> : index + 1}
                  </span>
                  <span>{stage.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="booking-workspace">
            <div className="chat-controls" key={step}>
              <div className="booking-stage-intro">
                <span className="booking-stage-count">
                  PASSO {step + 1} DE 6 · {stages[step].label.toUpperCase()}
                </span>
                <h3 ref={stageTitle} tabIndex={-1}>
                  {stages[step].title}
                </h3>
                <p>{stages[step].description}</p>
              </div>
              {step === 0 && (
                <div className="chat-options booking-service-options">
                  {services.map((s, index) => (
                    <button
                      key={s.id}
                      onClick={() => choose("serviceId", s.id)}
                      className={`choice service-choice${index === 2 ? " service-premium" : ""}`}
                    >
                      <span className="booking-choice-icon">
                        {index === 2 ? <Sparkles size={24} /> : <Scissors size={24} />}
                      </span>
                      <span className="booking-choice-copy">
                        {index === 2 && (
                          <span className="booking-recommended">O RITUAL COMPLETO</span>
                        )}
                        <strong>{s.name}</strong>
                        <span className="booking-service-description">{s.description}</span>
                        <small>
                          <Clock3 size={14} />
                          {s.duration} min · Finalização incluída
                        </small>
                      </span>
                      <span className="booking-choice-price">
                        <b>{money(s.price)}</b>
                        <span>por sessão</span>
                      </span>
                      <span className="booking-choice-check" aria-hidden="true">
                        <Check size={15} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {step === 1 && (
                <div className="chat-options booking-barber-options">
                  {barbers.map((b, index) => (
                    <button
                      key={b.id}
                      onClick={() => choose("barberId", b.id)}
                      className="choice barber-choice"
                    >
                      <Image
                        src={`/images/barber-${index + 1}.jpg`}
                        width={72}
                        height={80}
                        alt=""
                        className="booking-barber-photo"
                      />
                      <span className="booking-choice-copy">
                        <strong>{b.name}</strong>
                        <small>{b.specialty}</small>
                        <span className="booking-barber-label">Profissional BRAVO</span>
                      </span>
                      <span className="booking-choice-check" aria-hidden="true">
                        <Check size={15} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {step === 2 && (
                <>
                  <div className="booking-calendar">
                    <div className="calendar-toolbar">
                      <strong aria-live="polite">{monthLabel}</strong>
                      <div>
                        <button
                          type="button"
                          aria-label="Mês anterior"
                          disabled={calendarMonth <= startDate.slice(0, 7)}
                          onClick={() => setCalendarMonth(moveMonth(calendarMonth, -1))}
                        >
                          <ChevronLeft size={19} />
                        </button>
                        <button
                          type="button"
                          aria-label="Próximo mês"
                          disabled={moveMonth(calendarMonth, 1) > lastDate.slice(0, 7)}
                          onClick={() => setCalendarMonth(moveMonth(calendarMonth, 1))}
                        >
                          <ChevronRight size={19} />
                        </button>
                      </div>
                    </div>
                    <div className="calendar-weekdays" aria-hidden="true">
                      {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div className="date-grid">
                      {Array.from({ length: leadingDays }, (_, index) => (
                        <span key={`empty-${index}`} />
                      ))}
                      {days.map((day) => {
                        const enabled = day >= startDate && day <= lastDate && isOpen(day);
                        return (
                          <button
                            type="button"
                            key={day}
                            className={`calendar-day ${enabled ? "choice date-choice" : "calendar-closed"}${day === startDate ? " is-today" : ""}`}
                            disabled={!enabled}
                            aria-label={displayDate(day)}
                            onClick={() => choose("date", day)}
                          >
                            {Number(day.slice(-2))}
                            {day === startDate && <span className="today-marker" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="calendar-legend">
                      <span>
                        <i />
                        Hoje
                      </span>
                      <span>Reservas com até 30 dias de antecedência</span>
                    </div>
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
                        if (event.target.value < startDate || event.target.value > lastDate) {
                          setError("Escolha uma data entre hoje e os próximos 30 dias.");
                          return;
                        }
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
                  <p className="control-note">Domingo e segunda: fechado · Horário de Brasília</p>
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
                    <div className="booking-time-groups">
                      <p className="booking-selected-day">
                        <CalendarDays size={17} />
                        {displayDate(date)}
                        <button onClick={() => choose("date", "")}>Alterar dia</button>
                      </p>
                      {[
                        {
                          label: "Manhã",
                          slots: slots.filter((slot) => slot < "12:00"),
                          description: "Comece o dia no seu melhor estilo",
                        },
                        {
                          label: "Tarde",
                          slots: slots.filter((slot) => slot >= "12:00"),
                          description: "Uma pausa para cuidar de você",
                        },
                      ]
                        .filter((group) => group.slots.length > 0)
                        .map((group) => (
                          <div className="booking-time-group" key={group.label}>
                            <div className="time-group-heading">
                              <strong>{group.label}</strong>
                              <span>{group.description}</span>
                            </div>
                            <div className="time-grid">
                              {group.slots.map((slot) => (
                                <button
                                  key={slot}
                                  className="choice time-choice"
                                  onClick={() => choose("time", slot)}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          </div>
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
                    setDetails({
                      name: checked.data.name,
                      phone: checked.data.phone,
                      consent: true,
                    });
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
                      autoComplete="name"
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
                      onChange={(event) =>
                        setDetails({ ...details, consent: event.target.checked })
                      }
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
                  Voltar à etapa anterior
                </button>
              )}
            </div>
            <aside className="booking-summary" aria-label="Resumo da reserva">
              <div className="booking-summary-heading">
                <Scissors size={20} />
                <span>SUA EXPERIÊNCIA</span>
              </div>
              <h4>Um tempo para você.</h4>
              <p className="booking-summary-intro">
                Os detalhes do seu próximo momento BRAVO, em um só lugar.
              </p>
              <dl className="booking-summary-details">
                {[
                  {
                    icon: Scissors,
                    label: "Serviço",
                    value: service?.name,
                    key: "serviceId" as const,
                  },
                  {
                    icon: UserRound,
                    label: "Profissional",
                    value: barber?.name,
                    key: "barberId" as const,
                  },
                  {
                    icon: CalendarDays,
                    label: "Dia",
                    value: date ? displayDate(date) : undefined,
                    key: "date" as const,
                  },
                  {
                    icon: Clock3,
                    label: "Horário",
                    value: time ? `${time} · Brasília` : undefined,
                    key: "time" as const,
                  },
                ].map(({ icon: Icon, label, value, key }) => (
                  <div key={key} className={value ? "is-filled" : ""}>
                    <Icon size={17} />
                    <div>
                      <dt>{label}</dt>
                      <dd>{value || "A escolher"}</dd>
                    </div>
                    {value && (
                      <button
                        type="button"
                        onClick={() => choose(key, "")}
                        disabled={submitting}
                        aria-label={`Alterar ${label.toLowerCase()}`}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </dl>
              <div className="booking-summary-total">
                <span>
                  Total da experiência
                  <small>
                    {service
                      ? `${service.duration} minutos de cuidado`
                      : "Escolha um serviço para começar"}
                  </small>
                </span>
                <strong>{service ? money(service.price) : "—"}</strong>
              </div>
              <div className="booking-summary-note">
                <ShieldCheck size={18} />
                <p>
                  Sem pagamento online.
                  <br />
                  Este agendamento é demonstrativo.
                </p>
              </div>
            </aside>
          </div>
          <div className="chat-bottom">
            <ShieldCheck size={13} />
            <span>Projeto demonstrativo · Seus dados são usados apenas para a reserva.</span>
          </div>
        </>
      )}
    </div>
  );
}
