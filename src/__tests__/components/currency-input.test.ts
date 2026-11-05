import { describe, expect, it } from "vitest";
import { centsFromRawInput, centsToDisplay, toCents } from "@/components/currency-input";

describe("centsToDisplay", () => {
  it("formata centavos como moeda brasileira", () => {
    expect(centsToDisplay(0)).toBe("R$ 0,00");
    expect(centsToDisplay(1)).toBe("R$ 0,01");
    expect(centsToDisplay(123456)).toBe("R$ 1.234,56");
  });
});

describe("toCents", () => {
  it("converte um valor em reais para centavos", () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents("10")).toBe(1000);
  });

  it("trata valores inválidos como zero", () => {
    expect(toCents(Number.NaN)).toBe(0);
    expect(toCents("")).toBe(0);
  });
});

describe("centsFromRawInput", () => {
  it("extrai somente os dígitos do texto exibido e os interpreta como centavos", () => {
    expect(centsFromRawInput("R$ 1.234,56")).toBe(123456);
  });

  it("permite construir o valor dígito a dígito, deslocando os centavos", () => {
    expect(centsFromRawInput("1")).toBe(1);
    expect(centsFromRawInput("12")).toBe(12);
    expect(centsFromRawInput("125")).toBe(125);
  });

  it("remove o último dígito ao apagar o caractere final do texto formatado", () => {
    const afterBackspace = centsToDisplay(123456).slice(0, -1);
    expect(centsFromRawInput(afterBackspace)).toBe(12345);
  });

  it("retorna zero quando não há dígitos", () => {
    expect(centsFromRawInput("")).toBe(0);
    expect(centsFromRawInput("R$ ")).toBe(0);
  });
});
