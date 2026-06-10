import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    authId?: string;
    username?: string;
    name?: string;
    email?: string;
  };

  const { authId, username, name, email } = body;
  if (!authId || !username || !name || !email) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const { error: checkError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .single();

  if (!checkError) {
    return NextResponse.json({ error: "Username já em uso" }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("profiles").insert({
    id: authId,
    username: username.toLowerCase(),
    name,
    email,
    default_currency: "BRL",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
