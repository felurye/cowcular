import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const status = searchParams.get("status");

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!groupId) return NextResponse.json({ error: "groupId obrigatório" }, { status: 400 });

  let query = supabaseAdmin
    .from("accounts")
    .select(
      `id, title, amount, currency, due_date, status, type, recurrence,
       total_installments, installment_number,
       category:categories(id, name, icon, color),
       paid_by:group_members!paid_by_member_id(id, user_id, external_name, user:profiles(id, username, name)),
       splits:account_splits(id, member_id, percentage, amount_due, status,
         member:group_members(id, user_id, external_name, user:profiles(id, username, name)))`,
    )
    .eq("group_id", groupId)
    .order("due_date", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    title?: string;
    amount?: number;
    dueDate?: string;
    categoryId?: string;
    type?: string;
    recurrence?: string;
    totalInstallments?: number;
    groupId?: string;
    paidByMemberId?: string;
    splits?: Array<{ memberId: string; percentage: number }>;
  };

  if (!body.title || !body.amount || !body.groupId || !body.paidByMemberId) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .insert({
      title: body.title,
      amount: body.amount,
      currency: "BRL",
      due_date: body.dueDate ?? null,
      category_id: body.categoryId ?? null,
      type: body.type ?? "EXPENSE",
      recurrence: body.recurrence ?? "ONCE",
      total_installments: body.totalInstallments ?? null,
      status: "OPEN",
      group_id: body.groupId,
      paid_by_member_id: body.paidByMemberId,
    })
    .select()
    .single();

  if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (body.splits?.length) {
    const splitsToInsert = body.splits.map((s) => ({
      account_id: account.id,
      member_id: s.memberId,
      percentage: s.percentage,
      amount_due: (body.amount! * s.percentage) / 100,
      status: "PENDING",
    }));
    await supabaseAdmin.from("account_splits").insert(splitsToInsert);

    for (const s of body.splits) {
      if (s.memberId === body.paidByMemberId) continue;
      const amountDue = (body.amount! * s.percentage) / 100;
      if (amountDue <= 0) continue;

      await supabaseAdmin.from("transfers").insert({
        from_member_id: s.memberId,
        to_member_id: body.paidByMemberId,
        group_id: body.groupId,
        amount: amountDue,
        currency: "BRL",
        month,
        year,
        status: "PENDING",
      });
    }
  }

  const { data: groupData } = await supabaseAdmin
    .from("groups")
    .select("name")
    .eq("id", body.groupId)
    .single();

  const { data: members } = await supabaseAdmin
    .from("group_members")
    .select("user_id")
    .eq("group_id", body.groupId)
    .is("left_at", null)
    .not("user_id", "is", null);

  if (members) {
    const notifications = members
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({
        user_id: m.user_id as string,
        type: "NEW_ACCOUNT",
        payload: {
          groupId: body.groupId,
          groupName: groupData?.name ?? "",
          accountTitle: body.title,
        },
      }));
    if (notifications.length) await supabaseAdmin.from("notifications").insert(notifications);
  }

  return NextResponse.json(account, { status: 201 });
}
