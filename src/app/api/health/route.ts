import { getHealth } from "@/lib/health";

// Dipakai untuk pemeriksaan cepat dan healthcheck container di VPS nanti.
export async function GET() {
  const health = await getHealth();
  const ok = health.database.ok && health.redis.ok;
  return Response.json({ ok, ...health }, { status: ok ? 200 : 503 });
}
