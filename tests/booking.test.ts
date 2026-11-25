import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, BookingError } from "../src/lib/store";
import { addDays, bookingSchema, dateSchema, possibleSlots, today } from "../src/lib/schedule";
import { body } from "../src/lib/http";

const now = new Date("2026-11-25T10:00:00-03:00");
const input = () => ({
  serviceId: "corte",
  barberId: "rafael",
  date: "2026-11-26",
  time: "09:00",
  name: "Cliente Teste",
  phone: "(11) 99999-9999",
  consent: true,
  requestId: randomUUID(),
});

test("Brasília define o dia mesmo quando a data UTC já mudou", () => {
  assert.equal(today(new Date("2026-11-26T01:00:00Z")), "2026-11-25");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("datas impossíveis, dados inválidos e falta de consentimento são rejeitados", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  for (const change of [
    { consent: false },
    { phone: "11999" },
    { name: "<script>" },
    { barberId: "inexistente" },
    { serviceId: "gratuito" },
  ])
    assert.equal(bookingSchema.safeParse({ ...input(), ...change }).success, false);
});
test("agenda respeita almoço, fechamento, dias fechados, antecedência e limite de 30 dias", () => {
  const slots = possibleSlots("2026-11-26", 75, now);
  assert.ok(slots.includes("10:45"));
  assert.ok(!slots.includes("11:00"));
  assert.ok(!slots.includes("12:45"));
  assert.ok(slots.includes("13:00"));
  assert.ok(!slots.includes("18:00"));
  assert.deepEqual(possibleSlots("2026-11-29", 30, now), []);
  assert.deepEqual(possibleSlots("2026-11-30", 30, now), []);
  assert.deepEqual(possibleSlots("2026-11-24", 30, now), []);
  assert.deepEqual(possibleSlots("2027-01-01", 30, now), []);
  assert.ok(!possibleSlots("2026-11-25", 30, now).includes("10:15"));
  assert.ok(possibleSlots("2026-11-25", 30, now).includes("10:30"));
  assert.equal(possibleSlots("2026-11-28", 30, now).at(-1), "16:30");
});
test("reserva persiste e bloqueia toda a duração, mantendo os outros barbeiros livres", () => {
  const db = createStore(":memory:");
  try {
    const saved = db.reserve(input(), now);
    assert.equal(db.read(saved.token).service, "Corte de cabelo");
    assert.equal(saved.appointment.price, 55);
    const slots = db.availability(input(), now);
    for (const time of ["09:00", "09:15", "09:30"]) assert.ok(!slots.includes(time));
    assert.ok(slots.includes("09:45"));
    assert.ok(db.availability({ ...input(), barberId: "lucas" }, now).includes("09:00"));
    assert.throws(
      () => db.reserve({ ...input(), time: "09:30" }, now),
      (error: unknown) => error instanceof BookingError && error.status === 409,
    );
    assert.doesNotThrow(() => db.reserve({ ...input(), time: "09:45" }, now));
  } finally {
    db.close();
  }
});
test("uma reserva futura bloqueia serviços que começariam antes dela", () => {
  const db = createStore(":memory:");
  try {
    db.reserve({ ...input(), time: "10:00" }, now);
    assert.ok(!db.availability({ ...input(), serviceId: "combo" }, now).includes("09:00"));
    assert.ok(db.availability({ ...input(), serviceId: "barba" }, now).includes("09:30"));
  } finally {
    db.close();
  }
});
test("repetir uma solicitação não duplica reservas e preço e duração vêm do servidor", () => {
  const db = createStore(":memory:");
  try {
    const request = { ...input(), price: 0, duration: 1 };
    const first = db.reserve(request, now);
    const second = db.reserve(request, now);
    assert.equal(first.appointment.id, second.appointment.id);
    assert.equal(second.appointment.price, 55);
    assert.equal(second.appointment.duration, 45);
    assert.throws(() => db.reserve({ ...request, time: "14:00" }, now), BookingError);
  } finally {
    db.close();
  }
});
test("cancelamento exige segredo, é idempotente e libera o horário", () => {
  const db = createStore(":memory:");
  try {
    const saved = db.reserve(input(), now);
    assert.throws(() => db.cancel("a".repeat(64), now), BookingError);
    assert.equal(db.cancel(saved.token, now).status, "cancelled");
    assert.equal(db.cancel(saved.token, now).status, "cancelled");
    assert.ok(db.availability(input(), now).includes("09:00"));
    assert.equal(db.reserve(input(), now).appointment.status, "confirmed");
  } finally {
    db.close();
  }
});
test("não permite cancelamento de atendimento que já começou", () => {
  const db = createStore(":memory:");
  try {
    const saved = db.reserve(input(), now);
    assert.throws(
      () => db.cancel(saved.token, new Date("2026-11-26T09:01:00-03:00")),
      BookingError,
    );
  } finally {
    db.close();
  }
});
test("dados sobrevivem à reabertura e conexões diferentes enxergam os bloqueios", () => {
  const dir = mkdtempSync(join(tmpdir(), "bravo-test-"));
  const path = join(dir, "test.sqlite");
  const first = createStore(path);
  const second = createStore(path);
  let token = "";
  try {
    token = first.reserve(input(), now).token;
    assert.throws(() => second.reserve(input(), now), BookingError);
  } finally {
    first.close();
    second.close();
  }
  const reopened = createStore(path);
  try {
    assert.equal(reopened.read(token).name, "Cliente Teste");
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("limite de tentativas expira sem armazenar o celular em texto na chave", () => {
  const db = createStore(":memory:");
  try {
    db.limit("test", 1, 0);
    assert.throws(
      () => db.limit("test", 1, 1),
      (error: unknown) => error instanceof BookingError && error.status === 429,
    );
    assert.doesNotThrow(() => db.limit("test", 1, 3_600_001));
  } finally {
    db.close();
  }
});
test("API rejeita origem externa, conteúdo incorreto e corpo grande", async () => {
  await assert.rejects(
    () =>
      body(
        new Request("http://localhost/api", {
          method: "POST",
          headers: { origin: "https://other.example" },
          body: "{}",
        }),
      ),
    BookingError,
  );
  await assert.rejects(
    () => body(new Request("http://localhost/api", { method: "POST", body: "{}" })),
    BookingError,
  );
  await assert.rejects(
    () =>
      body(
        new Request("http://localhost/api", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ large: "a".repeat(5000) }),
        }),
      ),
    BookingError,
  );
});

test("origem usa o Host quando o servidor normaliza a URL para localhost", async () => {
  const result = await body(
    new Request("http://localhost:3100/api", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:3100",
        "content-type": "application/json",
      },
      body: JSON.stringify({ example: true }),
    }),
  );
  assert.deepEqual(result, { example: true });
});
