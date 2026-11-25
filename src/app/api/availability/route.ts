import { store } from "@/lib/store";
import { failure, noStore } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try {
    return Response.json(
      { slots: store().availability(Object.fromEntries(new URL(request.url).searchParams)) },
      { headers: noStore },
    );
  } catch (error) {
    return failure(error);
  }
}
