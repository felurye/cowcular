import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

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
