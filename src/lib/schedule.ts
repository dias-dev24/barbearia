import { z } from "zod";
import { services, barbers } from "./catalog";

export const TIME_ZONE = "America/Sao_Paulo";
export const MAX_DAYS = 30;
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00-03:00`);
  value.setUTCDate(value.getUTCDate() + days);
  return today(value);
}
export function weekday(date: string) {
  return new Date(`${date}T12:00:00-03:00`).getUTCDay();
}
export function isOpen(date: string) {
  return ![0, 1].includes(weekday(date));
}
export function displayDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(`${date}T12:00:00-03:00`));
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00-03:00`);
    return !Number.isNaN(parsed.valueOf()) && today(parsed) === value;
  }, "Data inválida");
export const availabilitySchema = z.object({
  serviceId: z.enum(services.map((s) => s.id)),
  barberId: z.enum(barbers.map((b) => b.id)),
  date: dateSchema,
});
export const bookingSchema = availabilitySchema.extend({
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(80)
    .refine((v) => /^[\p{L}\p{M} .'-]+$/u.test(v), "Use apenas letras no nome"),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^[1-9]{2}9\d{8}$/.test(v), "Informe um celular com DDD (11 dígitos)"),
  consent: z.literal(true),
  requestId: z.uuid(),
});
export type BookingInput = z.infer<typeof bookingSchema>;
export function validWindow(date: string, now = new Date()) {
  return date >= today(now) && date <= addDays(today(now), MAX_DAYS) && isOpen(date);
}
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function timeLabel(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
export function overlaps(a: number, b: number, c: number, d: number) {
  return a < d && b > c;
}
export function possibleSlots(date: string, duration: number, now = new Date()) {
  if (!validWindow(date, now)) return [];
  const closing = weekday(date) === 6 ? 17 * 60 : 19 * 60;
  const slots: string[] = [];
  for (let start = 9 * 60; start + duration <= closing; start += 15) {
    if (overlaps(start, start + duration, 12 * 60, 13 * 60)) continue;
    const time = timeLabel(start);
    if (new Date(`${date}T${time}:00-03:00`).valueOf() >= now.valueOf() + 30 * 60_000)
      slots.push(time);
  }
  return slots;
}
