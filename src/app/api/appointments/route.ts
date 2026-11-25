import { store } from "@/lib/store";
import { bookingSchema } from "@/lib/schedule";
import { body, failure, noStore } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = bookingSchema.parse(await body(request));
    const db = store();
    db.limit(`phone:${input.phone}`, 8);
    return Response.json(db.reserve(input), { status: 201, headers: noStore });
  } catch (error) { return failure(error); }
}
