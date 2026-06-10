import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: transfer } = await supabaseAdmin
    .from("transfers")
    .select("from_member:group_members!from_member_id(user_id)")
    .eq("id", id)
    .single();

  const fromUserId = (transfer?.from_member as unknown as { user_id: string | null } | null)
    ?.user_id;

  const { error } = await supabaseAdmin
    .from("transfers")
    .update({ status: "CONFIRMED", confirmed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (fromUserId) {
    await supabaseAdmin.from("notifications").insert({
      user_id: fromUserId,
      type: "TRANSFER_CONFIRMED",
      payload: { transferId: id },
    });
  }

  return NextResponse.json({ ok: true });
}
