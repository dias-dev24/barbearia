import { z } from "zod";
import { store } from "@/lib/store";
import { body, failure, noStore } from "@/lib/http";
export const runtime = "nodejs";
const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export async function POST(request: Request) {
  try { const { token } = schema.parse(await body(request)); return Response.json({ appointment: store().read(token) }, { headers: noStore }); }
  catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try { const { token } = schema.parse(await body(request)); return Response.json({ appointment: store().cancel(token) }, { headers: noStore }); }
  catch (error) { return failure(error); }
}
