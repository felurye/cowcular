import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: membership } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .is("left_at", null)
    .single();

  if (!membership) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (membership.role !== "ADMIN")
    return NextResponse.json({ error: "Apenas admins podem editar o grupo" }, { status: 403 });

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("status, type")
    .eq("id", id)
    .single();

  if (!group) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });
  if (group.status === "CLOSED")
    return NextResponse.json({ error: "Grupo encerrado não pode ser editado" }, { status: 400 });

  const body = (await req.json()) as {
    name?: string;
    eventType?: string | null;
    closingMode?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name.trim())
      return NextResponse.json({ error: "Nome não pode ser vazio" }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (body.eventType !== undefined && group.type === "EVENT") updates.event_type = body.eventType;
  if (body.closingMode !== undefined && group.type === "HOME")
    updates.closing_mode = body.closingMode;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("groups")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("groups")
    .select(
      `id, name, type, event_type, code, status, closing_mode, default_split,
       members:group_members(id, user_id, role, joined_at, left_at, external_name, external_contact,
         user:profiles(id, username, name, avatar)),
       balances:monthly_balances(id, month, year, status, total_expense, total_by_member, closed_at)`,
    )
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const isMember = (data.members as Array<{ user_id: string | null; left_at: string | null }>).some(
    (m) => m.user_id === user.id,
  );
  if (!isMember) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  return NextResponse.json(data);
}
