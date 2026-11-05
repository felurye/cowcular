import { NextResponse } from "next/server";
import {
  type AccountInput,
  buildBalanceData,
  buildBalanceDataFromTransfers,
  calculateMinTransfers,
  getMemberName,
  type TransferInput,
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
       splits:account_splits(member_id, amount_due, status,
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

  // Repasses sugeridos (M-07): gerados a partir dos repasses ainda
  // pendentes/aguardando confirmação do período, não do saldo bruto
  // das contas - assim, um repasse marcado como pago individualmente
  // some da sugestão sem precisar de uma quitação em lote.
  let transfersQuery = supabaseAdmin
    .from("transfers")
    .select(
      `amount, status,
       from_member:group_members!from_member_id(id, user_id, external_name, user:profiles(id, name)),
       to_member:group_members!to_member_id(id, user_id, external_name, user:profiles(id, name))`,
    )
    .eq("group_id", groupId);

  if (month && year) {
    transfersQuery = transfersQuery.eq("month", Number(month)).eq("year", Number(year));
  }

  const { data: transfers, error: transfersError } = await transfersQuery;
  if (transfersError) return NextResponse.json({ error: transfersError.message }, { status: 500 });

  const transferBalanceMap = buildBalanceDataFromTransfers(
    (transfers ?? []) as unknown as TransferInput[],
  );
  const netTransfers = calculateMinTransfers(transferBalanceMap);

  const byMember = Array.from(balanceMap.values()).map((e) => ({
    memberId: e.member.id,
    name: getMemberName(e.member),
    userId: e.member.user_id,
    balance: Math.round(e.balance * 100) / 100,
  }));

  let settlementQuery = supabaseAdmin
    .from("settlements")
    .select(
      "id, month, year, total_amount, net_transfers, created_at, settled_by_user:profiles!settled_by(id, name)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (month && year) {
    settlementQuery = settlementQuery.eq("month", Number(month)).eq("year", Number(year));
  } else {
    settlementQuery = settlementQuery.is("month", null);
  }

  const { data: settlements } = await settlementQuery;
  const lastSettlement = settlements?.[0] ?? null;

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
    settlement: lastSettlement
      ? {
          id: lastSettlement.id,
          createdAt: lastSettlement.created_at,
          totalAmount: Number(lastSettlement.total_amount),
          netTransfers: lastSettlement.net_transfers ?? [],
          settledBy:
            (lastSettlement.settled_by_user as unknown as { id: string; name: string } | null) ??
            null,
        }
      : null,
  });
}
