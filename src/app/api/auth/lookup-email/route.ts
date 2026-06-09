import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { username } = (await request.json()) as { username?: string };
  if (!username) return NextResponse.json({ error: "Username obrigatório" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("username", username.toLowerCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ email: data.email });
}
