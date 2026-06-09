import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { newPassword } = (await request.json()) as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 8 caracteres" },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
