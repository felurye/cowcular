import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  let query = supabaseAdmin
    .from("categories")
    .select("id, name, icon, color, is_system")
    .is("deleted_at", null)
    .order("name");

  if (groupId) {
    query = query.or(`is_system.eq.true,group_id.eq.${groupId}`);
  } else {
    query = query.eq("is_system", true);
  }

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

  const body = (await request.json()) as { name?: string; icon?: string; groupId?: string };
  if (!body.name?.trim() || !body.groupId) {
    return NextResponse.json({ error: "Nome e grupo são obrigatórios" }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", body.groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({
      name: body.name.trim(),
      icon: body.icon?.trim() || null,
      is_system: false,
      group_id: body.groupId,
    })
    .select("id, name, icon, color, is_system")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
