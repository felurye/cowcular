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
  if (!myMember) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { externalName, externalContact } = (await request.json()) as {
    externalName?: string;
    externalContact?: string;
  };
  if (!externalName?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("group_members")
    .insert({
      group_id: id,
      user_id: null,
      external_name: externalName.trim(),
      external_contact: externalContact ?? null,
      role: "MEMBER",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
