import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

const createAccountSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(200),
  amount: z.number().positive("Valor deve ser positivo"),
  dueDate: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  type: z.enum(["EXPENSE", "INCOME"]).optional().default("EXPENSE"),
  recurrence: z.enum(["ONCE", "RECURRING", "INSTALLMENT"]).optional().default("ONCE"),
  totalInstallments: z.number().int().min(2).optional().nullable(),
  groupId: z.string().uuid("groupId inválido"),
  paidByMemberId: z.string().uuid("paidByMemberId inválido"),
  splits: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        percentage: z.number().min(0).max(100),
      }),
    )
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const status = searchParams.get("status");
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(limitParam ?? "50", 10) || 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

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
    .order("due_date", { ascending: false })
    .range(from, to);

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

  const raw = await request.json();
  const parsed = createAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const body = parsed.data;

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
    if (notifications.length) {
      try {
        await supabaseAdmin.from("notifications").insert(notifications);
      } catch (notifError) {
        console.error("[notifications] falha ao inserir notificações:", notifError);
      }
    }
  }

  return NextResponse.json(account, { status: 201 });
}
