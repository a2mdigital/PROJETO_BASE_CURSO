const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkDatabase(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health/db`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkMigrations(): Promise<{ ok: boolean; versions: number[] }> {
  try {
    const res = await fetch(`${BASE_URL}/health/migrations`);
    if (!res.ok) return { ok: false, versions: [] };
    const data = await res.json();
    return { ok: true, versions: data.migrations.map((m: { version: number }) => m.version) };
  } catch {
    return { ok: false, versions: [] };
  }
}

export async function checkSelect(): Promise<{ ok: boolean; total: number }> {
  try {
    const res = await fetch(`${BASE_URL}/health/select`);
    if (!res.ok) return { ok: false, total: 0 };
    const data = await res.json();
    return { ok: true, total: data.total };
  } catch {
    return { ok: false, total: 0 };
  }
}

export async function getItems() {
  const res = await fetch(`${BASE_URL}/api/items`);
  return res.json();
}

export async function createItem(nome: string) {
  const res = await fetch(`${BASE_URL}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome }),
  });
  return res.json();
}
