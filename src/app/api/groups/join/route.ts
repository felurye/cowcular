import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { code } = (await request.json()) as { code?: string };
  if (!code) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id")
    .eq("code", code.toUpperCase())
    .eq("status", "ACTIVE")
    .single();

  if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

  const { data: existing } = await supabaseAdmin
    .from("group_members")
    .select("id, left_at")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .single();

  if (existing && !existing.left_at) {
    return NextResponse.json({ groupId: group.id });
  }

  if (existing?.left_at) {
    await supabaseAdmin.from("group_members").update({ left_at: null }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "MEMBER",
    });
  }

  return NextResponse.json({ groupId: group.id });
}
