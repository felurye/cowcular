import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const memberIds: string[] = [];

  if (groupId) {
    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("group_id", groupId);
    if (members) memberIds.push(...members.map((m) => m.id));
  } else {
    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("id")
      .eq("user_id", user.id);
    if (members) memberIds.push(...members.map((m) => m.id));
  }

  if (!memberIds.length) return NextResponse.json([]);

  let query = supabaseAdmin
    .from("transfers")
    .select(
      `id, amount, currency, month, year, status, group_id,
       from_member:group_members!from_member_id(id, user_id, external_name, user:profiles(id, username, name)),
       to_member:group_members!to_member_id(id, user_id, external_name, user:profiles(id, username, name))`,
    )
    .order("created_at", { ascending: false });

  if (groupId) {
    query = query.eq("group_id", groupId);
  } else {
    query = query.or(
      `from_member_id.in.(${memberIds.join(",")}),to_member_id.in.(${memberIds.join(",")})`,
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
