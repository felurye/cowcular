export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string | undefined) ?? "Erro na requisição");
  return data as T;
}

export function jsonPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
