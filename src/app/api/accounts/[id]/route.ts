import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";

// Refaz os repasses pendentes de uma conta a partir dos splits
// atuais (M-01): contas com valor zero não geram repasses; editar
// para valor > 0 recria os repasses com os novos valores.
async function recalcAccountTransfers(
  accountId: string,
  groupId: string,
  paidByMemberId: string | null,
  currency: string,
  dueDate: string | null,
) {
  await supabaseAdmin
    .from("transfers")
    .delete()
    .eq("status", "PENDING")
    .contains("related_account_ids", [accountId]);

  if (!paidByMemberId) return;

  const { data: splits } = await supabaseAdmin
    .from("account_splits")
    .select("member_id, amount_due")
    .eq("account_id", accountId);

  const ref = dueDate ? new Date(dueDate) : new Date();
  const month = ref.getUTCMonth() + 1;
  const year = ref.getUTCFullYear();

  for (const s of splits ?? []) {
    if (s.member_id === paidByMemberId || Number(s.amount_due) <= 0) continue;
    await supabaseAdmin.from("transfers").insert({
      from_member_id: s.member_id,
      to_member_id: paidByMemberId,
      group_id: groupId,
      amount: Number(s.amount_due),
      currency,
      month,
      year,
      status: "PENDING",
      related_account_ids: [accountId],
    });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: account } = await supabaseAdmin
    .from("accounts")
    .select(
      "id, title, amount, currency, status, recurrence, due_date, group_id, paid_by_member_id",
    )
    .eq("id", id)
    .single();

  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  if (account.status !== "OPEN") {
    return NextResponse.json(
      { error: "Apenas contas abertas podem ser editadas." },
      { status: 409 },
    );
  }

  const { data: groupData } = await supabaseAdmin
    .from("groups")
    .select("status")
    .eq("id", account.group_id)
    .single();

  if (groupData?.status === "CLOSED") {
    return NextResponse.json({ error: "Este grupo foi encerrado." }, { status: 409 });
  }

  if (account.due_date) {
    const d = new Date(account.due_date);
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();

    const { data: balance } = await supabaseAdmin
      .from("monthly_balances")
      .select("status")
      .eq("group_id", account.group_id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (balance?.status === "CLOSED") {
      return NextResponse.json(
        { error: "Este mês já foi fechado e não pode ser editado." },
        { status: 409 },
      );
    }
  }

  const body = (await request.json()) as {
    title?: string;
    amount?: number;
    dueDate?: string | null;
    categoryId?: string | null;
    type?: string;
    paidByMemberId?: string;
    splits?: Array<{ memberId: string; percentage: number }>;
    replicateToFuture?: boolean;
  };

  const originalTitle = account.title;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.amount !== undefined) patch.amount = body.amount;
  if (body.dueDate !== undefined) patch.due_date = body.dueDate || null;
  if (body.categoryId !== undefined) patch.category_id = body.categoryId || null;
  if (body.type !== undefined) patch.type = body.type;
  if (body.paidByMemberId !== undefined) patch.paid_by_member_id = body.paidByMemberId;

  const { error: updateError } = await supabaseAdmin.from("accounts").update(patch).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const amountChanged = body.amount !== undefined && Number(body.amount) !== Number(account.amount);

  if (body.splits !== undefined) {
    await supabaseAdmin.from("account_splits").delete().eq("account_id", id);
    if (body.splits.length > 0) {
      const newAmount = body.amount ?? Number(account.amount);
      await supabaseAdmin.from("account_splits").insert(
        body.splits.map((s) => ({
          account_id: id,
          member_id: s.memberId,
          percentage: s.percentage,
          amount_due: (newAmount * s.percentage) / 100,
          status: "PENDING",
        })),
      );
    }
  } else if (amountChanged) {
    // Só o valor mudou: recalcula amount_due mantendo os percentuais
    const { data: existingSplits } = await supabaseAdmin
      .from("account_splits")
      .select("id, percentage")
      .eq("account_id", id);
    for (const s of existingSplits ?? []) {
      await supabaseAdmin
        .from("account_splits")
        .update({ amount_due: (Number(body.amount) * Number(s.percentage)) / 100 })
        .eq("id", s.id);
    }
  }

  if ((amountChanged || body.splits !== undefined) && account.group_id) {
    await recalcAccountTransfers(
      id,
      account.group_id,
      body.paidByMemberId ?? account.paid_by_member_id,
      account.currency,
      body.dueDate !== undefined ? body.dueDate : account.due_date,
    );
  }

  if (body.replicateToFuture && account.recurrence === "RECURRING" && account.due_date) {
    const { data: closedBalances } = await supabaseAdmin
      .from("monthly_balances")
      .select("month, year")
      .eq("group_id", account.group_id)
      .eq("status", "CLOSED");

    const closedKeys = new Set(closedBalances?.map((b) => `${b.year}-${b.month}`) ?? []);

    const { data: futureAccounts } = await supabaseAdmin
      .from("accounts")
      .select("id, amount, due_date")
      .eq("group_id", account.group_id)
      .eq("recurrence", "RECURRING")
      .eq("status", "OPEN")
      .eq("title", originalTitle)
      .gt("due_date", account.due_date);

    for (const fa of futureAccounts ?? []) {
      const fd = new Date(fa.due_date);
      const key = `${fd.getUTCFullYear()}-${fd.getUTCMonth() + 1}`;
      if (closedKeys.has(key)) continue;

      const futurePatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.title !== undefined) futurePatch.title = body.title;
      if (body.amount !== undefined) futurePatch.amount = body.amount;
      if (body.categoryId !== undefined) futurePatch.category_id = body.categoryId || null;
      if (body.type !== undefined) futurePatch.type = body.type;
      if (body.paidByMemberId !== undefined) futurePatch.paid_by_member_id = body.paidByMemberId;

      await supabaseAdmin.from("accounts").update(futurePatch).eq("id", fa.id);

      if (body.splits !== undefined) {
        await supabaseAdmin.from("account_splits").delete().eq("account_id", fa.id);
        if (body.splits.length > 0) {
          const newAmount = body.amount ?? Number(fa.amount);
          await supabaseAdmin.from("account_splits").insert(
            body.splits.map((s) => ({
              account_id: fa.id,
              member_id: s.memberId,
              percentage: s.percentage,
              amount_due: (newAmount * s.percentage) / 100,
              status: "PENDING",
            })),
          );
        }
      }

      if ((amountChanged || body.splits !== undefined) && account.group_id) {
        await recalcAccountTransfers(
          fa.id,
          account.group_id,
          body.paidByMemberId ?? account.paid_by_member_id,
          account.currency,
          fa.due_date,
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

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
