import { NextResponse } from "next/server";

import {
  DEMO_LAND_BY_ID,
  NBTRD_MEASUREMENT_BASE,
} from "@/lib/demo-data";

export const runtime = "nodejs";

/**
 * Server-side proxy for a curated set of NBTRD bullet-land downloads. NIST's
 * download endpoint does not send CORS headers, so the browser cannot fetch it
 * directly; this route fetches from the server and streams the `.x3p` payload
 * back with an explicit content-type so the client can hand it to `parseX3p`.
 *
 * The route only serves measurement IDs on the curated allowlist — it is not a
 * general-purpose open proxy for NIST.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const land = DEMO_LAND_BY_ID[id];
  if (!land) {
    return NextResponse.json(
      { success: false, error: `Unknown demo land: ${id}` },
      { status: 404 },
    );
  }

  const upstream = `${NBTRD_MEASUREMENT_BASE}${land.measurementId}`;
  let res: Response;
  try {
    // Demo files are several MB — larger than Next's 2MB fetch-cache cap.
    // We skip Next's data cache and rely on the outgoing `s-maxage` header to
    // let Vercel's CDN cache the response at the edge instead.
    res = await fetch(upstream, {
      headers: { "user-agent": "bullet-lens/1.0 (+https://github.com/erichare/bullet-lens)" },
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to reach NBTRD: ${(err as Error).message}`,
      },
      { status: 502 },
    );
  }

  if (!res.ok || !res.body) {
    return NextResponse.json(
      {
        success: false,
        error: `NBTRD returned ${res.status} ${res.statusText}`,
      },
      { status: 502 },
    );
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${land.filename}"`,
      "cache-control": "public, max-age=3600, s-maxage=604800, immutable",
    },
  });
}
