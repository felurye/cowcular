import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: category } = await supabaseAdmin
    .from("categories")
    .select("is_system, group_id")
    .eq("id", id)
    .single();

  if (!category) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
  if (category.is_system)
    return NextResponse.json(
      { error: "Categorias do sistema não podem ser removidas" },
      { status: 403 },
    );

  const { data: member } = await supabaseAdmin
    .from("group_members")
    .select("id")
    .eq("group_id", category.group_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
