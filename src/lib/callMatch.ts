// src/lib/callMatch.ts
export async function callMatch(orderId: string) {
    const r = await fetch("/api/match-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
    });
    if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Match driver failed (${r.status})`);
    }
    return (await r.json()) as {
        ok: true;
        chosen?: { uid?: string | null; name?: string | null; vehicleType?: string | null };
    };
}
