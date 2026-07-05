import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

// Reverte a quitação mais recente do período: splits e repasses
// voltam a pendentes e o registro da quitação é removido.
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

  let settlementQuery = supabaseAdmin
    .from("settlements")
    .select("id")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (month && year) {
    settlementQuery = settlementQuery.eq("month", month).eq("year", year);
  } else {
    settlementQuery = settlementQuery.is("month", null);
  }

  const { data: settlements, error: findError } = await settlementQuery;
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  const settlement = settlements?.[0];
  if (!settlement) {
    return NextResponse.json(
      { error: "Nenhuma quitação encontrada para reverter neste período" },
      { status: 400 },
    );
  }

  const { error: splitsError } = await supabaseAdmin
    .from("account_splits")
    .update({ status: "PENDING", settlement_id: null })
    .eq("settlement_id", settlement.id);
  if (splitsError) return NextResponse.json({ error: splitsError.message }, { status: 500 });

  const { error: transfersError } = await supabaseAdmin
    .from("transfers")
    .update({ status: "PENDING", confirmed_at: null, settlement_id: null })
    .eq("settlement_id", settlement.id)
    .eq("status", "OFFSET");
  if (transfersError) return NextResponse.json({ error: transfersError.message }, { status: 500 });

  const { error: deleteError } = await supabaseAdmin
    .from("settlements")
    .delete()
    .eq("id", settlement.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

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
        type: "SETTLEMENT_REVERTED",
        payload: {
          groupId,
          groupName: groupData?.name ?? "",
          month: month ?? null,
          year: year ?? null,
        },
      }));
    if (notifications.length) await supabaseAdmin.from("notifications").insert(notifications);
  }

  return NextResponse.json({ ok: true });
}
