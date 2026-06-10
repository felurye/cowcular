export type MemberRef = {
  id: string;
  user_id: string | null;
  external_name: string | null;
  user: { id: string; name: string } | null;
};

export type CategoryRef = { id: string; name: string; icon: string | null } | null;

export type AccountInput = {
  amount: number | string;
  type: string;
  category: CategoryRef;
  paid_by: MemberRef | null;
  splits: Array<{
    member_id: string;
    amount_due: number | string;
    member: MemberRef;
  }> | null;
};

export type BalanceEntry = {
  member: MemberRef;
  balance: number;
};

export type CategoryEntry = {
  id: string;
  name: string;
  icon: string | null;
  total: number;
};

export type NetTransfer = {
  fromMemberId: string;
  fromName: string;
  fromUserId: string | null;
  toMemberId: string;
  toName: string;
  toUserId: string | null;
  amount: number;
};

export function getMemberName(m: MemberRef): string {
  return m.user?.name ?? m.external_name ?? "Externo";
}

export function buildBalanceData(accounts: AccountInput[]): {
  balanceMap: Map<string, BalanceEntry>;
  categoryMap: Map<string, CategoryEntry>;
  totalExpense: number;
  totalIncome: number;
} {
  const balanceMap = new Map<string, BalanceEntry>();
  const categoryMap = new Map<string, CategoryEntry>();
  let totalExpense = 0;
  let totalIncome = 0;

  const ensure = (m: MemberRef) => {
    if (!balanceMap.has(m.id)) balanceMap.set(m.id, { member: m, balance: 0 });
  };

  for (const acc of accounts) {
    const paidBy = acc.paid_by;
    if (!paidBy || !acc.splits?.length) continue;

    const amount = Number(acc.amount);
    if (acc.type === "INCOME") {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      if (acc.category?.id) {
        const cat = acc.category;
        const existing = categoryMap.get(cat.id);
        if (existing) {
          existing.total += amount;
        } else {
          categoryMap.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon, total: amount });
        }
      }
    }

    ensure(paidBy);

    for (const split of acc.splits) {
      const m = split.member;
      ensure(m);
      const due = Number(split.amount_due);
      balanceMap.get(paidBy.id)!.balance += due;
      balanceMap.get(m.id)!.balance -= due;
    }
  }

  return { balanceMap, categoryMap, totalExpense, totalIncome };
}

export function calculateMinTransfers(balanceMap: Map<string, BalanceEntry>): NetTransfer[] {
  const entries = Array.from(balanceMap.values());
  const creditors = entries
    .filter((e) => e.balance > 0.005)
    .map((e) => ({ ...e }))
    .sort((a, b) => b.balance - a.balance);
  const debtors = entries
    .filter((e) => e.balance < -0.005)
    .map((e) => ({ ...e }))
    .sort((a, b) => a.balance - b.balance);

  const netTransfers: NetTransfer[] = [];

  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.balance, Math.abs(d.balance));
    if (amount > 0.005) {
      netTransfers.push({
        fromMemberId: d.member.id,
        fromName: getMemberName(d.member),
        fromUserId: d.member.user_id,
        toMemberId: c.member.id,
        toName: getMemberName(c.member),
        toUserId: c.member.user_id,
        amount: Math.round(amount * 100) / 100,
      });
    }
    c.balance -= amount;
    d.balance += amount;
    if (c.balance < 0.005) ci++;
    if (d.balance > -0.005) di++;
  }

  return netTransfers;
}
