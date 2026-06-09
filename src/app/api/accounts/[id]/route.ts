import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: account } = await supabaseAdmin
    .from("accounts")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  if (account.status === "PAID" && !force) {
    return NextResponse.json({ error: "Conta já paga. Confirme a exclusão." }, { status: 409 });
  }

  await supabaseAdmin.from("account_splits").delete().eq("account_id", id);
  const { error } = await supabaseAdmin.from("accounts").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
