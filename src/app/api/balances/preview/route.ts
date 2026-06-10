import { NextResponse } from "next/server";
import {
  type AccountInput,
  buildBalanceData,
  calculateMinTransfers,
  getMemberName,
} from "@/lib/balance-utils";
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

  const { balanceMap, categoryMap, totalExpense, totalIncome } = buildBalanceData(
    (accounts ?? []) as unknown as AccountInput[],
  );

  const netTransfers = calculateMinTransfers(balanceMap);

  const byMember = Array.from(balanceMap.values()).map((e) => ({
    memberId: e.member.id,
    name: getMemberName(e.member),
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
