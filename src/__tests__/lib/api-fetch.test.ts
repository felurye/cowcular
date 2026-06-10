import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, jsonPost } from "@/lib/api-fetch";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  it("retorna os dados em resposta bem-sucedida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: "test" }),
      }),
    );

    const result = await apiFetch<{ id: number; name: string }>("/api/test");
    expect(result).toEqual({ id: 1, name: "test" });
  });

  it("lança erro com a mensagem da resposta quando não é ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Não encontrado" }),
      }),
    );

    await expect(apiFetch("/api/test")).rejects.toThrow("Não encontrado");
  });

  it("lança mensagem padrão quando resposta de erro não tem campo 'error'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    );

    await expect(apiFetch("/api/test")).rejects.toThrow("Erro na requisição");
  });

  it("repassa as opções de RequestInit para o fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiFetch("/api/test", { method: "DELETE" });
    expect(mockFetch).toHaveBeenCalledWith("/api/test", { method: "DELETE" });
  });

  it("chama fetch com o path correto", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await apiFetch("/api/accounts?groupId=123");
    expect(mockFetch).toHaveBeenCalledWith("/api/accounts?groupId=123", undefined);
  });
});

describe("jsonPost", () => {
  it("envia POST com Content-Type JSON e corpo serializado", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await jsonPost("/api/groups", { name: "Casa" });

    expect(mockFetch).toHaveBeenCalledWith("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Casa" }),
    });
  });

  it("retorna os dados da resposta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "abc" }),
      }),
    );

    const result = await jsonPost<{ id: string }>("/api/groups", { name: "Casa" });
    expect(result).toEqual({ id: "abc" });
  });

  it("lança erro quando a resposta não é ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Nome obrigatório" }),
      }),
    );

    await expect(jsonPost("/api/groups", {})).rejects.toThrow("Nome obrigatório");
  });
});
