import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

async function isGroupOpenForBudget(
  groupId: string,
  month: number,
  year: number,
): Promise<{ ok: boolean; reason?: string }> {
  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("status")
    .eq("id", groupId)
    .single();

  if (!group) return { ok: false, reason: "Grupo não encontrado" };
  if (group.status === "CLOSED") return { ok: false, reason: "Grupo está fechado" };

  const { data: balance } = await supabaseAdmin
    .from("monthly_balances")
    .select("status")
    .eq("group_id", groupId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (balance?.status === "CLOSED") return { ok: false, reason: "Mês está fechado" };
  return { ok: true };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as { limitAmount?: number };
  if (!body.limitAmount || body.limitAmount <= 0) {
    return NextResponse.json({ error: "Limite deve ser maior que zero" }, { status: 400 });
  }

  const { data: budget } = await supabaseAdmin
    .from("category_budgets")
    .select("group_id, month, year")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

  const { data: member } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", budget.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const check = await isGroupOpenForBudget(budget.group_id, budget.month, budget.year);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

  const { data, error } = await supabaseAdmin
    .from("category_budgets")
    .update({ limit_amount: body.limitAmount })
    .eq("id", id)
    .select("id, category_id, month, year, limit_amount")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: budget } = await supabaseAdmin
    .from("category_budgets")
    .select("group_id, month, year")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!budget) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

  const { data: member } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", budget.group_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const check = await isGroupOpenForBudget(budget.group_id, budget.month, budget.year);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

  const { error } = await supabaseAdmin
    .from("category_budgets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
