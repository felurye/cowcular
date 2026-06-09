import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

function generateCode(len = 6) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len)
    .toUpperCase();
}

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
    .filter((g) => (g as { status: string }).status !== "CLOSED" || true);

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

  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabaseAdmin
      .from("groups")
      .select("id")
      .eq("code", code)
      .single();
    if (!existing) break;
    code = generateCode();
  }

  const { data: group, error: groupError } = await supabaseAdmin
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

  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });

  const { error: memberError } = await supabaseAdmin.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    role: "ADMIN",
  });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json(group, { status: 201 });
}
