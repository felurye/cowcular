import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
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

  const isSelf = memberId === myMember?.role ? false : true;
  if (myMember?.role !== "ADMIN" && !isSelf) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("group_members")
    .update({ left_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("group_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
