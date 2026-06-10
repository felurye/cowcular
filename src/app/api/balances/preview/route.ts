import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!groupId) return NextResponse.json({ error: "groupId obrigatório" }, { status: 400 });

  let query = supabaseAdmin
    .from("accounts")
    .select(
      `id, amount, type, status,
       category:categories(id, name, icon),
       paid_by:group_members!paid_by_member_id(id, user_id, external_name, user:profiles(id, name)),
       splits:account_splits(member_id, amount_due,
         member:group_members(id, user_id, external_name, user:profiles(id, name)))`,
    )
    .eq("group_id", groupId)
    .in("status", ["OPEN", "PAID"]);

  if (month && year) {
    const m = Number(month);
    const y = Number(year);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    query = query
      .gte("due_date", `${y}-${String(m).padStart(2, "0")}-01`)
      .lt("due_date", `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  }

  const { data: accounts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type MemberRef = {
    id: string;
    user_id: string | null;
    external_name: string | null;
    user: { id: string; name: string } | null;
  };

  type CategoryRef = { id: string; name: string; icon: string | null } | null;

  const getName = (m: MemberRef) => m.user?.name ?? m.external_name ?? "Externo";

  // Balance per member: credit (paid) - debit (owes)
  const balanceMap = new Map<string, { member: MemberRef; balance: number }>();
  const categoryMap = new Map<
    string,
    { id: string; name: string; icon: string | null; total: number }
  >();

  const ensure = (m: MemberRef) => {
    if (!balanceMap.has(m.id)) balanceMap.set(m.id, { member: m, balance: 0 });
  };

  let totalExpense = 0;
  let totalIncome = 0;

  for (const acc of accounts ?? []) {
    const paidBy = acc.paid_by as unknown as MemberRef | null;
    if (!paidBy || !acc.splits?.length) continue;

    const amount = Number(acc.amount);
    if (acc.type === "INCOME") {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      const cat = acc.category as unknown as CategoryRef;
      if (cat?.id) {
        const existing = categoryMap.get(cat.id);
        if (existing) {
          existing.total += amount;
        } else {
          categoryMap.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon, total: amount });
        }
      }
    }

    ensure(paidBy);

    for (const split of acc.splits as unknown as {
      member_id: string;
      amount_due: number;
      member: MemberRef;
    }[]) {
      const m = split.member;
      ensure(m);
      const due = Number(split.amount_due);

      // paidBy gave money → credit
      balanceMap.get(paidBy.id)!.balance += due;
      // split member received value → debit
      balanceMap.get(m.id)!.balance -= due;
    }
  }

  // Minimum-transfer algorithm
  const entries = Array.from(balanceMap.values());
  const creditors = entries
    .filter((e) => e.balance > 0.005)
    .map((e) => ({ ...e }))
    .sort((a, b) => b.balance - a.balance);
  const debtors = entries
    .filter((e) => e.balance < -0.005)
    .map((e) => ({ ...e }))
    .sort((a, b) => a.balance - b.balance);

  const netTransfers: {
    fromMemberId: string;
    fromName: string;
    fromUserId: string | null;
    toMemberId: string;
    toName: string;
    toUserId: string | null;
    amount: number;
  }[] = [];

  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.balance, Math.abs(d.balance));
    if (amount > 0.005) {
      netTransfers.push({
        fromMemberId: d.member.id,
        fromName: getName(d.member),
        fromUserId: d.member.user_id,
        toMemberId: c.member.id,
        toName: getName(c.member),
        toUserId: c.member.user_id,
        amount: Math.round(amount * 100) / 100,
      });
    }
    c.balance -= amount;
    d.balance += amount;
    if (c.balance < 0.005) ci++;
    if (d.balance > -0.005) di++;
  }

  const byMember = entries.map((e) => ({
    memberId: e.member.id,
    name: getName(e.member),
    userId: e.member.user_id,
    balance: Math.round(e.balance * 100) / 100,
  }));

  const byCategory = Array.from(categoryMap.values())
    .map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      categoryIcon: c.icon,
      totalExpense: Math.round(c.total * 100) / 100,
    }))
    .sort((a, b) => b.totalExpense - a.totalExpense);

  return NextResponse.json({
    totalExpense: Math.round(totalExpense * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    byMember,
    byCategory,
    netTransfers,
  });
}
