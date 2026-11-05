import { NextResponse } from "next/server";
import {
  buildBalanceDataFromTransfers,
  calculateMinTransfers,
  type TransferInput,
} from "@/lib/balance-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

// Quitação por abatimento: registra que o valor líquido final do
// período foi pago e encerra todos os repasses pendentes do período.
export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { groupId, month, year } = (await request.json()) as {
    groupId?: string;
    month?: number;
    year?: number;
  };
  if (!groupId || (month != null) !== (year != null)) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const { data: myMember } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();
  if (!myMember) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  let query = supabaseAdmin
    .from("accounts")
    .select("id, status")
    .eq("group_id", groupId)
    .in("status", ["OPEN", "PAID"]);

  if (month && year) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    query = query
      .gte("due_date", `${year}-${String(month).padStart(2, "0")}-01`)
      .lt("due_date", `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  }

  const { data: accounts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Repasses sugeridos (M-07): o valor líquido quitado parte dos
  // repasses ainda pendentes/aguardando confirmação do período, não
  // do saldo bruto das contas - o que já foi pago individualmente
  // não entra na quitação em lote.
  let transfersQuery = supabaseAdmin
    .from("transfers")
    .select(
      `amount, status,
       from_member:group_members!from_member_id(id, user_id, external_name, user:profiles(id, name)),
       to_member:group_members!to_member_id(id, user_id, external_name, user:profiles(id, name))`,
    )
    .eq("group_id", groupId);
  if (month && year) {
    transfersQuery = transfersQuery.eq("month", month).eq("year", year);
  }

  const { data: transfersForBalance, error: transfersBalanceError } = await transfersQuery;
  if (transfersBalanceError) {
    return NextResponse.json({ error: transfersBalanceError.message }, { status: 500 });
  }

  const balanceMap = buildBalanceDataFromTransfers(
    (transfersForBalance ?? []) as unknown as TransferInput[],
  );
  const netTransfers = calculateMinTransfers(balanceMap);

  if (!netTransfers.length) {
    return NextResponse.json(
      { error: "Nenhum repasse pendente para quitar neste período" },
      { status: 400 },
    );
  }

  const totalAmount = netTransfers.reduce((s, t) => s + t.amount, 0);

  const { data: settlement, error: settlementError } = await supabaseAdmin
    .from("settlements")
    .insert({
      group_id: groupId,
      month: month ?? null,
      year: year ?? null,
      settled_by: user.id,
      net_transfers: netTransfers,
      total_amount: Math.round(totalAmount * 100) / 100,
    })
    .select("id")
    .single();
  if (settlementError) {
    return NextResponse.json({ error: settlementError.message }, { status: 500 });
  }

  const accountIds = (accounts ?? []).map((a) => a.id);
  if (accountIds.length) {
    const { error: splitsError } = await supabaseAdmin
      .from("account_splits")
      .update({ status: "PAID", settlement_id: settlement.id })
      .in("account_id", accountIds)
      .eq("status", "PENDING");
    if (splitsError) {
      return NextResponse.json({ error: splitsError.message }, { status: 500 });
    }
  }

  let transfersUpdate = supabaseAdmin
    .from("transfers")
    .update({
      status: "OFFSET",
      confirmed_at: new Date().toISOString(),
      settlement_id: settlement.id,
    })
    .eq("group_id", groupId)
    .in("status", ["PENDING", "AWAITING_CONFIRMATION"]);
  if (month && year) {
    transfersUpdate = transfersUpdate.eq("month", month).eq("year", year);
  }
  const { error: transfersError } = await transfersUpdate;
  if (transfersError) {
    return NextResponse.json({ error: transfersError.message }, { status: 500 });
  }

  const { data: groupData } = await supabaseAdmin
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .is("left_at", null)
    .not("user_id", "is", null);

  if (members) {
    const notifications = members
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({
        user_id: m.user_id as string,
        type: "MONTH_SETTLED",
        payload: {
          groupId,
          groupName: groupData?.name ?? "",
          month: month ?? null,
          year: year ?? null,
        },
      }));
    if (notifications.length) await supabaseAdmin.from("notifications").insert(notifications);
  }

  return NextResponse.json({ ok: true, settlementId: settlement.id });
}
