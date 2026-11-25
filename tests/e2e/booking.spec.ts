import { test, expect } from "@playwright/test";
import { addDays, isOpen, today } from "../../src/lib/schedule";
import { randomUUID } from "node:crypto";

test("página responsiva, navegação acessível e movimento reduzido", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth))
      .toBe(true);
    const chat = page.getByLabel("Agendamento com a recepção BRAVO");
    await chat.scrollIntoViewIfNeeded();
    await expect(chat.getByRole("button", { name: /Corte de cabelo/ })).toBeVisible();
    expect(
      await page.locator(".hero-photo").evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  }
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 390 : 1440,
    height: 900,
  });
  if (testInfo.project.name === "mobile") {
    const menu = page.getByRole("button", { name: "Abrir menu" });
    await menu.click();
    await expect(page.getByRole("navigation")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  }
  const question = page.locator("summary").filter({ hasText: "Posso cancelar meu horário?" });
  await question.click();
  await expect(
    page.getByText("Sim. No comprovante, toque em Cancelar agendamento", { exact: false }),
  ).toBeVisible();
  await page
    .locator("#servicos")
    .screenshot({ path: `test-results/${testInfo.project.name}-services.png` });
  await page.screenshot({ path: `test-results/${testInfo.project.name}-full.png`, fullPage: true });
});

test("página responsiva e agendamento até o cancelamento", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Seu estilo. Sua assinatura." })).toBeVisible();
  await expect
    .poll(() => page.locator(".hero-photo").evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-hero.png` });
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("navigation").getByRole("link", { name: "Agendar horário" }).click();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  } else await page.getByRole("link", { name: "Reserve seu momento" }).click();
  const chat = page.getByLabel("Agendamento com a recepção BRAVO");
  await chat.getByRole("button", { name: /Corte \+ barba/ }).click();
  await chat.getByRole("button", { name: /Lucas Almeida/ }).click();
  await chat.locator(".date-choice").last().click();
  await chat.locator(".time-choice").first().click();
  await chat.getByLabel("Seu nome").fill("Cliente Demonstração");
  await chat
    .getByLabel("Celular com DDD")
    .fill(testInfo.project.name === "mobile" ? "11988881111" : "11988882222");
  await chat.getByRole("checkbox").check();
  await chat.getByRole("button", { name: "Revisar agendamento" }).click();
  await expect(chat.getByText("R$ 85", { exact: false }).last()).toBeVisible();
  await chat.getByRole("button", { name: "Confirmar meu horário" }).click();
  await expect(chat.getByRole("heading", { name: "Tudo certo, Cliente!" })).toBeVisible();
  const calendarLink = chat.getByRole("link", { name: "Adicionar ao Google Agenda" });
  await expect(calendarLink).toBeVisible();
  await expect(calendarLink).toHaveAttribute("target", "_blank");
  const calendarUrl = new URL((await calendarLink.getAttribute("href"))!);
  expect(calendarUrl.origin).toBe("https://calendar.google.com");
  expect(calendarUrl.searchParams.get("text")).toBe("BRAVO — Corte + barba");
  expect(calendarUrl.searchParams.get("stz")).toBe("America/Sao_Paulo");
  const dates = calendarUrl.searchParams.get("dates")!.split("/");
  expect(dates[0]).toMatch(/T120000Z$/);
  expect(dates[1]).toMatch(/T131500Z$/);
  expect(calendarUrl.searchParams.get("details")).toContain("Lucas Almeida");
  expect(calendarUrl.toString()).not.toContain("1198888");
  await page.reload();
  await expect(chat.getByRole("heading", { name: "Tudo certo, Cliente!" })).toBeVisible();
  await chat.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/${testInfo.project.name}-booking.png` });
  await chat.getByRole("button", { name: "Cancelar agendamento", exact: true }).click();
  await chat.getByRole("button", { name: "Sim, cancelar" }).click();
  await expect(chat.getByRole("heading", { name: "Agendamento cancelado." })).toBeVisible();
  await chat.getByRole("button", { name: "Fazer um novo agendamento" }).click();
  await expect(chat.getByRole("button", { name: /Corte de cabelo/ })).toBeVisible();
  expect(errors).toEqual([]);
  await expect
    .poll(() => page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth))
    .toBe(true);
});

test("API resolve duas tentativas simultâneas para o mesmo horário", async ({ request }) => {
  let date = addDays(today(), 2);
  while (!isOpen(date)) date = addDays(date, 1);
  const availability = await request.get(
    `/api/availability?serviceId=corte&barberId=andre&date=${date}`,
  );
  expect(availability.ok()).toBe(true);
  const { slots } = await availability.json();
  const data = {
    serviceId: "corte",
    barberId: "andre",
    date,
    time: slots[0],
    name: "Teste Concorrência",
    phone: "11977776666",
    consent: true,
  };
  const results = await Promise.all(
    [1, 2].map(() =>
      request.post("/api/appointments", { data: { ...data, requestId: randomUUID() } }),
    ),
  );
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
  const saved = await results.find((r) => r.status() === 201)!.json();
  const occupied = await request.get(
    `/api/availability?serviceId=corte&barberId=andre&date=${date}`,
  );
  expect((await occupied.json()).slots).not.toContain(data.time);
  const cancelled = await request.delete("/api/appointments/receipt", {
    data: { token: saved.token },
  });
  expect(cancelled.ok()).toBe(true);
  const freed = await request.get(`/api/availability?serviceId=corte&barberId=andre&date=${date}`);
  expect((await freed.json()).slots).toContain(data.time);
});
