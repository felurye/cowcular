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

export async function GET(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!groupId) return NextResponse.json({ error: "groupId obrigatório" }, { status: 400 });

  const { data: member } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let query = supabaseAdmin
    .from("category_budgets")
    .select("id, category_id, month, year, limit_amount")
    .eq("group_id", groupId)
    .is("deleted_at", null);

  if (month) query = query.eq("month", Number(month));
  if (year) query = query.eq("year", Number(year));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    groupId?: string;
    categoryId?: string;
    month?: number;
    year?: number;
    limitAmount?: number;
  };

  if (!body.groupId || !body.categoryId || !body.month || !body.year || !body.limitAmount) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }
  if (body.limitAmount <= 0) {
    return NextResponse.json({ error: "Limite deve ser maior que zero" }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", body.groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const check = await isGroupOpenForBudget(body.groupId, body.month, body.year);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 422 });

  const { data, error } = await supabaseAdmin
    .from("category_budgets")
    .insert({
      group_id: body.groupId,
      category_id: body.categoryId,
      month: body.month,
      year: body.year,
      limit_amount: body.limitAmount,
    })
    .select("id, category_id, month, year, limit_amount")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
