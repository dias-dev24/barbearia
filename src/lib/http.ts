import { ZodError } from "zod";
import { BookingError } from "./store";
export const noStore = { "Cache-Control": "no-store" };
export function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message || "Confira os dados informados." }, { status: 400, headers: noStore });
  if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status, headers: noStore });
  if (error instanceof SyntaxError) return Response.json({ error: "Envie um JSON válido." }, { status: 400, headers: noStore });
  console.error("[booking]", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500, headers: noStore });
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new BookingError("Origem não permitida.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new BookingError("Envie os dados em JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new BookingError("Informe os dados.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new BookingError("Solicitação muito grande.", 413); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
