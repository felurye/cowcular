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

  const { targetMonth } = (await request.json()) as { targetMonth?: string };

  const { data: original, error: fetchError } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  await supabaseAdmin.from("accounts").update({ status: "DEFERRED" }).eq("id", id);

  const { error: insertError } = await supabaseAdmin.from("accounts").insert({
    title: original.title,
    amount: original.amount,
    currency: original.currency,
    due_date: targetMonth ?? null,
    category_id: original.category_id,
    type: original.type,
    recurrence: "ONCE",
    status: "OPEN",
    group_id: original.group_id,
    paid_by_member_id: original.paid_by_member_id,
    origin_account_id: id,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
