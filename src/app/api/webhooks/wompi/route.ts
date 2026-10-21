import { NextResponse } from "next/server";
import { applyWompiEvent } from "../../../../services/wompi.service";

export const runtime = "nodejs";

/** Wompi calls this with a signed event. The checksum is the authentication; there is no user session. */
export async function POST(request: Request) {
  const headerChecksum = request.headers.get("x-event-checksum");
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    await applyWompiEvent(payload, headerChecksum);
  } catch {
    console.error("[wompi] event");
    return NextResponse.json({ error: "not processed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
