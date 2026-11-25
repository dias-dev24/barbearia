import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { services, barbers } from "./catalog";
import {
  availabilitySchema,
  bookingSchema,
  minutes,
  overlaps,
  possibleSlots,
  type BookingInput,
} from "./schedule";

export class BookingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type Row = {
  id: string;
  service_id: string;
  barber_id: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  name: string;
  status: string;
  request_id: string;
  payload_hash: string;
};
export type Receipt = {
  id: string;
  service: string;
  barber: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  name: string;
  status: string;
};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function receipt(row: Row): Receipt {
  return {
    id: row.id,
    service: services.find((s) => s.id === row.service_id)!.name,
    barber: barbers.find((b) => b.id === row.barber_id)!.name,
    date: row.date,
    time: row.time,
    duration: row.duration,
    price: row.price,
    name: row.name,
    status: row.status,
  };
}

export function createStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
      service_id TEXT NOT NULL, barber_id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
      duration INTEGER NOT NULL CHECK(duration > 0), price INTEGER NOT NULL,
      name TEXT NOT NULL, phone TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled')),
      consent_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS appointments_schedule ON appointments(barber_id, date, status);
    CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    PRAGMA user_version=1;`);

  function availability(input: unknown, now = new Date()) {
    const { serviceId, barberId, date } = availabilitySchema.parse(input);
    const duration = services.find((s) => s.id === serviceId)!.duration;
    const occupied = db
      .prepare(
        "SELECT time, duration FROM appointments WHERE barber_id=? AND date=? AND status='confirmed'",
      )
      .all(barberId, date) as { time: string; duration: number }[];
    return possibleSlots(date, duration, now).filter(
      (time) =>
        !occupied.some((row) =>
          overlaps(
            minutes(time),
            minutes(time) + duration,
            minutes(row.time),
            minutes(row.time) + row.duration,
          ),
        ),
    );
  }

  function reserve(raw: unknown, now = new Date()) {
    const input: BookingInput = bookingSchema.parse(raw);
    const hash = digest(JSON.stringify(input));
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = db
        .prepare("SELECT * FROM appointments WHERE request_id=?")
        .get(input.requestId) as Row | undefined;
      if (previous) {
        if (previous.payload_hash !== hash)
          throw new BookingError("Esta solicitação já foi utilizada. Reinicie o agendamento.", 409);
        // Reissues a secret only to a caller with the original 128-bit request ID and identical payload.
        const token = randomBytes(32).toString("hex");
        db.prepare("UPDATE appointments SET token_hash=? WHERE id=?").run(
          digest(token),
          previous.id,
        );
        db.exec("COMMIT");
        return { appointment: receipt(previous), token };
      }
      if (!availability(input, now).includes(input.time))
        throw new BookingError(
          "Esse horário acabou de ficar indisponível. Escolha outro para continuar.",
          409,
        );
      const service = services.find((s) => s.id === input.serviceId)!;
      const id = randomUUID();
      const token = randomBytes(32).toString("hex");
      db.prepare(
        `INSERT INTO appointments (id, request_id, payload_hash, service_id, barber_id, date, time, duration, price, name, phone, token_hash, consent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        input.requestId,
        hash,
        input.serviceId,
        input.barberId,
        input.date,
        input.time,
        service.duration,
        service.price,
        input.name,
        input.phone,
        digest(token),
        now.toISOString(),
      );
      const row = db.prepare("SELECT * FROM appointments WHERE id=?").get(id) as Row;
      db.exec("COMMIT");
      return { appointment: receipt(row), token };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function read(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new BookingError("Comprovante não encontrado.", 404);
    const row = db.prepare("SELECT * FROM appointments WHERE token_hash=?").get(digest(token)) as
      Row | undefined;
    if (!row) throw new BookingError("Comprovante não encontrado.", 404);
    return receipt(row);
  }
  function cancel(token: string, now = new Date()) {
    const record = read(token);
    if (new Date(`${record.date}T${record.time}:00-03:00`) <= now)
      throw new BookingError("Este horário já passou e não pode ser cancelado.");
    db.prepare("UPDATE appointments SET status='cancelled' WHERE token_hash=?").run(digest(token));
    return read(token);
  }
  function limit(key: string, max = 30, now = Date.now()) {
    const bucket = Math.floor(now / 3_600_000);
    const hashed = digest(`${key}:${bucket}`);
    db.prepare("DELETE FROM request_limits WHERE expires < ?").run(now);
    const result = db
      .prepare(
        `INSERT INTO request_limits(key, count, expires) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`,
      )
      .get(hashed, (bucket + 1) * 3_600_000) as { count: number };
    if (result.count > max)
      throw new BookingError("Muitas tentativas. Tente novamente em uma hora.", 429);
  }
  return { availability, reserve, read, cancel, limit, close: () => db.close() };
}
let instance: ReturnType<typeof createStore> | undefined;
export function store() {
  return (instance ??= createStore(process.env.DATABASE_PATH || "data/bravo.sqlite"));
}
