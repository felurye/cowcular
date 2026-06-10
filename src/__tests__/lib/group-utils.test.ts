import { describe, expect, it, vi } from "vitest";
import { generateCode } from "@/lib/group-utils";

describe("generateCode", () => {
  it("gera código com 6 caracteres por padrão", () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it("gera apenas caracteres alfanuméricos maiúsculos", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it("gera código com comprimento personalizado", () => {
    expect(generateCode(4)).toHaveLength(4);
    expect(generateCode(8)).toHaveLength(8);
  });

  it("gera códigos diferentes a cada chamada", () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it("usa Math.random internamente", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    generateCode();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("código gerado com Math.random mockado é determinístico", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const code1 = generateCode();
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
    const code2 = generateCode();
    expect(code1).toBe(code2);
    vi.restoreAllMocks();
  });
});
