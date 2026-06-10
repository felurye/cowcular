import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: account, error: fetchError } = await supabaseAdmin
    .from("accounts")
    .select("status, due_date, group_id")
    .eq("id", id)
    .single();

  if (fetchError || !account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  if (account.status !== "PAID") {
    return NextResponse.json({ error: "Conta não está marcada como paga" }, { status: 409 });
  }

  if (account.due_date) {
    const d = new Date(account.due_date);
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();

    const { data: balance } = await supabaseAdmin
      .from("monthly_balances")
      .select("status")
      .eq("group_id", account.group_id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (balance?.status === "CLOSED") {
      return NextResponse.json(
        { error: "Este mês já foi fechado e não pode ser editado." },
        { status: 409 },
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("accounts")
    .update({ status: "OPEN", paid_by_member_id: null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
