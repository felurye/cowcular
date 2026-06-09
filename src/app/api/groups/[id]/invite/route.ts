import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: myMember } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();
  if (myMember?.role !== "ADMIN")
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { mode, value } = (await request.json()) as { mode?: string; value?: string };
  if (!mode || !value) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

  const field = mode === "username" ? "username" : "email";
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, name")
    .eq(field, value.toLowerCase())
    .single();

  if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const { data: existing } = await supabaseAdmin
    .from("group_members")
    .select("id, left_at")
    .eq("group_id", id)
    .eq("user_id", target.id)
    .single();

  if (existing && !existing.left_at) {
    return NextResponse.json({ error: "Usuário já é membro" }, { status: 409 });
  }

  if (existing?.left_at) {
    await supabaseAdmin.from("group_members").update({ left_at: null }).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("group_members").insert({
      group_id: id,
      user_id: target.id,
      role: "MEMBER",
    });
  }

  const { data: group } = await supabaseAdmin.from("groups").select("name").eq("id", id).single();

  await supabaseAdmin.from("notifications").insert({
    user_id: target.id,
    type: "GROUP_INVITE",
    payload: { groupId: id, groupName: group?.name ?? "" },
  });

  return NextResponse.json({ ok: true });
}
