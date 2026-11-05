import { describe, expect, it } from "vitest";
import {
  type BalanceEntry,
  buildBalanceData,
  buildBalanceDataFromTransfers,
  calculateMinTransfers,
  getMemberName,
  type MemberRef,
  type TransferInput,
} from "@/lib/balance-utils";

const alice: MemberRef = {
  id: "m1",
  user_id: "u1",
  external_name: null,
  user: { id: "u1", name: "Alice" },
};
const bob: MemberRef = {
  id: "m2",
  user_id: "u2",
  external_name: null,
  user: { id: "u2", name: "Bob" },
};
const charlie: MemberRef = {
  id: "m3",
  user_id: "u3",
  external_name: null,
  user: { id: "u3", name: "Charlie" },
};

describe("getMemberName", () => {
  it("retorna o nome do usuário quando disponível", () => {
    expect(getMemberName(alice)).toBe("Alice");
  });

  it("usa external_name quando não há usuário registrado", () => {
    const ext: MemberRef = { id: "e1", user_id: null, external_name: "Visitante", user: null };
    expect(getMemberName(ext)).toBe("Visitante");
  });

  it("retorna 'Externo' como fallback final", () => {
    const anon: MemberRef = { id: "e2", user_id: null, external_name: null, user: null };
    expect(getMemberName(anon)).toBe("Externo");
  });

  it("prefere user.name sobre external_name", () => {
    const m: MemberRef = {
      id: "e3",
      user_id: "u9",
      external_name: "Apelido",
      user: { id: "u9", name: "Nome Real" },
    };
    expect(getMemberName(m)).toBe("Nome Real");
  });
});

describe("buildBalanceData", () => {
  it("retorna mapas vazios e totais zerados para lista vazia", () => {
    const { balanceMap, categoryMap, totalExpense, totalIncome } = buildBalanceData([]);
    expect(balanceMap.size).toBe(0);
    expect(categoryMap.size).toBe(0);
    expect(totalExpense).toBe(0);
    expect(totalIncome).toBe(0);
  });

  it("ignora contas sem pagador", () => {
    const { balanceMap } = buildBalanceData([
      {
        amount: 100,
        type: "EXPENSE",
        category: null,
        paid_by: null,
        splits: [{ member_id: "m2", amount_due: 100, member: bob }],
      },
    ]);
    expect(balanceMap.size).toBe(0);
  });

  it("ignora contas sem divisões", () => {
    const { balanceMap } = buildBalanceData([
      { amount: 100, type: "EXPENSE", category: null, paid_by: alice, splits: [] },
    ]);
    expect(balanceMap.size).toBe(0);
  });

  it("credita o pagador e debita os membros nas divisões de EXPENSE", () => {
    const { balanceMap, totalExpense } = buildBalanceData([
      {
        amount: 100,
        type: "EXPENSE",
        category: null,
        paid_by: alice,
        splits: [
          { member_id: "m1", amount_due: 50, member: alice },
          { member_id: "m2", amount_due: 50, member: bob },
        ],
      },
    ]);

    expect(totalExpense).toBe(100);
    expect(balanceMap.get("m1")!.balance).toBe(50);
    expect(balanceMap.get("m2")!.balance).toBe(-50);
  });

  it("acumula totais por categoria apenas para EXPENSE", () => {
    const food = { id: "cat1", name: "Alimentação", icon: "🍕" };
    const { categoryMap, totalIncome, totalExpense } = buildBalanceData([
      {
        amount: 60,
        type: "EXPENSE",
        category: food,
        paid_by: alice,
        splits: [
          { member_id: "m1", amount_due: 30, member: alice },
          { member_id: "m2", amount_due: 30, member: bob },
        ],
      },
      {
        amount: 40,
        type: "EXPENSE",
        category: food,
        paid_by: bob,
        splits: [
          { member_id: "m1", amount_due: 20, member: alice },
          { member_id: "m2", amount_due: 20, member: bob },
        ],
      },
    ]);

    expect(totalExpense).toBe(100);
    expect(totalIncome).toBe(0);
    expect(categoryMap.get("cat1")!.total).toBe(100);
  });

  it("ignora splits quitados (PAID) no saldo, mas mantém o total do período", () => {
    const { balanceMap, totalExpense } = buildBalanceData([
      {
        amount: 100,
        type: "EXPENSE",
        category: null,
        paid_by: alice,
        splits: [
          { member_id: "m1", amount_due: 50, status: "PAID", member: alice },
          { member_id: "m2", amount_due: 50, status: "PAID", member: bob },
        ],
      },
      {
        amount: 40,
        type: "EXPENSE",
        category: null,
        paid_by: alice,
        splits: [
          { member_id: "m1", amount_due: 20, status: "PENDING", member: alice },
          { member_id: "m2", amount_due: 20, status: "PENDING", member: bob },
        ],
      },
    ]);

    expect(totalExpense).toBe(140);
    expect(balanceMap.get("m1")!.balance).toBe(20);
    expect(balanceMap.get("m2")!.balance).toBe(-20);
  });

  it("trata splits sem status como pendentes", () => {
    const { balanceMap } = buildBalanceData([
      {
        amount: 100,
        type: "EXPENSE",
        category: null,
        paid_by: alice,
        splits: [
          { member_id: "m1", amount_due: 50, member: alice },
          { member_id: "m2", amount_due: 50, member: bob },
        ],
      },
    ]);

    expect(balanceMap.get("m1")!.balance).toBe(50);
    expect(balanceMap.get("m2")!.balance).toBe(-50);
  });

  it("não registra categoria para INCOME", () => {
    const { categoryMap, totalIncome, totalExpense } = buildBalanceData([
      {
        amount: 200,
        type: "INCOME",
        category: { id: "cat2", name: "Salário", icon: null },
        paid_by: alice,
        splits: [{ member_id: "m1", amount_due: 200, member: alice }],
      },
    ]);

    expect(totalIncome).toBe(200);
    expect(totalExpense).toBe(0);
    expect(categoryMap.size).toBe(0);
  });
});

describe("buildBalanceDataFromTransfers", () => {
  it("retorna mapa vazio para lista vazia", () => {
    const balanceMap = buildBalanceDataFromTransfers([]);
    expect(balanceMap.size).toBe(0);
  });

  it("gera o repasse sugerido a partir de um repasse PENDING do mês", () => {
    const transfers: TransferInput[] = [
      { amount: 50, status: "PENDING", from_member: bob, to_member: alice },
    ];
    const balanceMap = buildBalanceDataFromTransfers(transfers);
    const netTransfers = calculateMinTransfers(balanceMap);

    expect(netTransfers).toEqual([
      {
        fromMemberId: "m2",
        fromName: "Bob",
        fromUserId: "u2",
        toMemberId: "m1",
        toName: "Alice",
        toUserId: "u1",
        amount: 50,
      },
    ]);
  });

  it("soma repasses PENDING entre os mesmos membros antes de sugerir o valor líquido", () => {
    // Bob deve 50 e 30 a Alice, em contas separadas do mesmo mês
    const transfers: TransferInput[] = [
      { amount: 50, status: "PENDING", from_member: bob, to_member: alice },
      { amount: 30, status: "PENDING", from_member: bob, to_member: alice },
    ];
    const balanceMap = buildBalanceDataFromTransfers(transfers);
    const netTransfers = calculateMinTransfers(balanceMap);

    expect(netTransfers).toHaveLength(1);
    expect(netTransfers[0].amount).toBe(80);
  });

  it("líquida repasses em sentidos opostos entre os mesmos dois membros", () => {
    // Bob deve 50 a Alice numa conta; Alice deve 20 a Bob em outra
    const transfers: TransferInput[] = [
      { amount: 50, status: "PENDING", from_member: bob, to_member: alice },
      { amount: 20, status: "PENDING", from_member: alice, to_member: bob },
    ];
    const balanceMap = buildBalanceDataFromTransfers(transfers);
    const netTransfers = calculateMinTransfers(balanceMap);

    expect(netTransfers).toEqual([
      {
        fromMemberId: "m2",
        fromName: "Bob",
        fromUserId: "u2",
        toMemberId: "m1",
        toName: "Alice",
        toUserId: "u1",
        amount: 30,
      },
    ]);
  });

  it("considera AWAITING_CONFIRMATION como dívida ainda em aberto", () => {
    const transfers: TransferInput[] = [
      { amount: 40, status: "AWAITING_CONFIRMATION", from_member: bob, to_member: alice },
    ];
    const balanceMap = buildBalanceDataFromTransfers(transfers);
    expect(calculateMinTransfers(balanceMap)).toHaveLength(1);
  });

  it.each([
    "CONFIRMED",
    "OFFSET",
    "EXTERNAL_PAID",
  ])("ignora repasses já resolvidos (status %s) no saldo", (status) => {
    const transfers: TransferInput[] = [{ amount: 40, status, from_member: bob, to_member: alice }];
    const balanceMap = buildBalanceDataFromTransfers(transfers);
    expect(calculateMinTransfers(balanceMap)).toHaveLength(0);
  });

  it("recalcula o repasse sugerido quando um repasse isolado é marcado como pago", () => {
    // Duas contas do mesmo mês geraram dois repasses de Bob para Alice
    const beforePayment: TransferInput[] = [
      { amount: 50, status: "PENDING", from_member: bob, to_member: alice },
      { amount: 30, status: "PENDING", from_member: bob, to_member: alice },
    ];
    const netBefore = calculateMinTransfers(buildBalanceDataFromTransfers(beforePayment));
    expect(netBefore).toHaveLength(1);
    expect(netBefore[0].amount).toBe(80);

    // O repasse de 30 é confirmado como pago isoladamente; o de 50 continua pendente
    const afterPayment: TransferInput[] = [
      { amount: 50, status: "PENDING", from_member: bob, to_member: alice },
      { amount: 30, status: "CONFIRMED", from_member: bob, to_member: alice },
    ];
    const netAfter = calculateMinTransfers(buildBalanceDataFromTransfers(afterPayment));
    expect(netAfter).toHaveLength(1);
    expect(netAfter[0].amount).toBe(50);
  });

  it("não sugere mais nenhum repasse quando o único pendente é marcado como pago", () => {
    const afterPayment: TransferInput[] = [
      { amount: 50, status: "CONFIRMED", from_member: bob, to_member: alice },
    ];
    const netAfter = calculateMinTransfers(buildBalanceDataFromTransfers(afterPayment));
    expect(netAfter).toHaveLength(0);
  });

  it("minimiza transferências com repasses pendentes entre três membros", () => {
    // Alice pagou as contas; Bob e Charlie têm repasses pendentes de 30 cada para Alice
    const transfers: TransferInput[] = [
      { amount: 30, status: "PENDING", from_member: bob, to_member: alice },
      { amount: 30, status: "PENDING", from_member: charlie, to_member: alice },
    ];
    const netTransfers = calculateMinTransfers(buildBalanceDataFromTransfers(transfers));

    expect(netTransfers).toHaveLength(2);
    const total = netTransfers.reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(60);
    expect(netTransfers.every((t) => t.toMemberId === "m1")).toBe(true);
  });
});

describe("calculateMinTransfers", () => {
  it("retorna array vazio para mapa sem devedores", () => {
    const map = new Map<string, BalanceEntry>([
      ["m1", { member: alice, balance: 0 }],
      ["m2", { member: bob, balance: 0 }],
    ]);
    expect(calculateMinTransfers(map)).toEqual([]);
  });

  it("ignora saldos abaixo do limiar de 0.005", () => {
    const map = new Map<string, BalanceEntry>([
      ["m1", { member: alice, balance: 0.001 }],
      ["m2", { member: bob, balance: -0.001 }],
    ]);
    expect(calculateMinTransfers(map)).toHaveLength(0);
  });

  it("gera uma transferência para dívida simples entre dois membros", () => {
    const map = new Map<string, BalanceEntry>([
      ["m1", { member: alice, balance: 50 }],
      ["m2", { member: bob, balance: -50 }],
    ]);
    const transfers = calculateMinTransfers(map);

    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toEqual({
      fromMemberId: "m2",
      fromName: "Bob",
      fromUserId: "u2",
      toMemberId: "m1",
      toName: "Alice",
      toUserId: "u1",
      amount: 50,
    });
  });

  it("minimiza transferências num cenário com três membros", () => {
    // Alice pagou tudo; Bob e Charlie devem 30 cada
    const map = new Map<string, BalanceEntry>([
      ["m1", { member: alice, balance: 60 }],
      ["m2", { member: bob, balance: -30 }],
      ["m3", { member: charlie, balance: -30 }],
    ]);
    const transfers = calculateMinTransfers(map);

    expect(transfers).toHaveLength(2);
    const total = transfers.reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(60);
    expect(transfers.every((t) => t.toMemberId === "m1")).toBe(true);
  });

  it("reduz transferências quando um devedor quita múltiplos credores", () => {
    // Bob deve 80; Alice tem crédito de 50, Charlie tem crédito de 30
    const map = new Map<string, BalanceEntry>([
      ["m1", { member: alice, balance: 50 }],
      ["m2", { member: bob, balance: -80 }],
      ["m3", { member: charlie, balance: 30 }],
    ]);
    const transfers = calculateMinTransfers(map);

    expect(transfers).toHaveLength(2);
    const total = transfers.reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(80);
  });

  it("arredonda valores para 2 casas decimais", () => {
    const map = new Map<string, BalanceEntry>([
      ["m1", { member: alice, balance: 33.335 }],
      ["m2", { member: bob, balance: -33.335 }],
    ]);
    const [transfer] = calculateMinTransfers(map);
    expect(transfer.amount).toBe(Math.round(33.335 * 100) / 100);
  });
});
