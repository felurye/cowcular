import { NextResponse } from "next/server";
import { generateCode } from "@/lib/group-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("group_members")
    .select(
      "group:groups(id, name, type, event_type, code, status, closing_mode, default_split, created_at, members:group_members(id, user_id, role, left_at))",
    )
    .eq("user_id", user.id)
    .is("left_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groups = data
    .map((r) => r.group)
    .filter(Boolean)
    .filter((g) => (g as unknown as { status: string }).status !== "CLOSED" || true);

  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    type?: string;
    eventType?: string;
    closingMode?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  // Tenta inserir com código único — em caso de conflito de código, regenera
  let group: Record<string, unknown> | null = null;
  let groupError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const result = await supabaseAdmin
      .from("groups")
      .insert({
        name: body.name.trim(),
        type: body.type ?? "HOME",
        event_type: body.eventType ?? null,
        code,
        status: "ACTIVE",
        closing_mode: body.closingMode ?? null,
      })
      .select()
      .single();

    group = result.data;
    groupError = result.error;

    // código 23505 = unique_violation no PostgreSQL
    if (!groupError || groupError.code !== "23505") break;
  }

  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });

  const { error: memberError } = await supabaseAdmin.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    role: "ADMIN",
  });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json(group, { status: 201 });
}
