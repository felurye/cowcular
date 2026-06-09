import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Código obrigatório" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("groups")
    .select("id, name, type, event_type, code, status, _count:group_members(count)")
    .eq("code", code.toUpperCase())
    .eq("status", "ACTIVE")
    .single();

  if (error || !data) return NextResponse.json({ error: "Grupo não encontrado" }, { status: 404 });

  const count = Array.isArray(data._count)
    ? ((data._count[0] as { count: number })?.count ?? 0)
    : 0;
  return NextResponse.json({ ...data, _count: { members: count } });
}
