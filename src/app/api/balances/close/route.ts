import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

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
  if (!groupId || !month || !year) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const { data: myMember } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();
  if (myMember?.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("amount, account_splits(member_id, amount_due)")
    .eq("group_id", groupId)
    .eq("status", "PAID")
    .gte("due_date", `${year}-${String(month).padStart(2, "0")}-01`)
    .lt("due_date", `${year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`);

  const totalExpense = (accounts ?? []).reduce((s, a) => s + Number(a.amount), 0);

  const { data: existing } = await supabaseAdmin
    .from("monthly_balances")
    .select("id")
    .eq("group_id", groupId)
    .eq("month", month)
    .eq("year", year)
    .single();

  if (existing) {
    await supabaseAdmin
      .from("monthly_balances")
      .update({
        status: "CLOSED",
        total_expense: totalExpense,
        closed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("monthly_balances").insert({
      group_id: groupId,
      month,
      year,
      status: "CLOSED",
      total_expense: totalExpense,
      closed_at: new Date().toISOString(),
    });
  }

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .is("left_at", null)
    .not("user_id", "is", null);

  if (members) {
    const notifications = members.map((m) => ({
      user_id: m.user_id as string,
      type: "MONTH_CLOSED",
      payload: { groupId, month, year },
    }));
    if (notifications.length) await supabaseAdmin.from("notifications").insert(notifications);
  }

  return NextResponse.json({ ok: true });
}
