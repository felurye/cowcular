import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!groupId) return NextResponse.json({ error: "groupId obrigatório" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("monthly_balances")
    .select("id, month, year, status, total_expense, total_by_member, closed_at")
    .eq("group_id", groupId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
