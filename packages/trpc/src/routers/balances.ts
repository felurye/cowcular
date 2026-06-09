import type { prisma } from "@cowcular/db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, z } from "../server.js";
import { createNotification } from "./notifications.js";

type PrismaLike = {
  account: typeof prisma.account;
  monthlyBalance: typeof prisma.monthlyBalance;
};

export async function performMonthClose(
  db: PrismaLike,
  groupId: string,
  month: number,
  year: number,
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const accounts = await db.account.findMany({
    where: { groupId, type: "EXPENSE", status: "PAID", dueDate: { gte: startDate, lt: endDate } },
    include: { splits: true },
  });

  const totalExpense = accounts.reduce((sum, a) => sum + Number(a.amount), 0);

  // Saldo líquido por membro: positivo = recebe, negativo = deve
  const totalByMember: Record<string, number> = {};
  for (const account of accounts) {
    if (account.paidByMemberId) {
      totalByMember[account.paidByMemberId] =
        (totalByMember[account.paidByMemberId] ?? 0) + Number(account.amount);
    }
    for (const split of account.splits) {
      totalByMember[split.memberId] =
        (totalByMember[split.memberId] ?? 0) - Number(split.amountDue);
    }
  }

  return db.monthlyBalance.upsert({
    where: { groupId_month_year: { groupId, month, year } },
    create: {
      groupId,
      month,
      year,
      status: "CLOSED",
      totalExpense,
      totalByMember,
      closedAt: new Date(),
    },
    update: { status: "CLOSED", totalExpense, totalByMember, closedAt: new Date() },
  });
}

export const balancesRouter = router({
  list: protectedProcedure.input(z.object({ groupId: z.string() })).query(({ ctx, input }) =>
    ctx.db.monthlyBalance.findMany({
      where: { groupId: input.groupId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ),

  close: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        month: z.number().int().min(1).max(12),
        year: z.number().int().min(2020),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.group.findUnique({ where: { id: input.groupId } });
      if (!group || group.type !== "HOME") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      const adminMember = await ctx.db.groupMember.findFirst({
        where: {
          groupId: input.groupId,
          userId: ctx.session.userId,
          role: "ADMIN",
          leftAt: null,
        },
      });
      if (!adminMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only group admins can close a month" });
      }

      const balance = await performMonthClose(ctx.db, input.groupId, input.month, input.year);

      const members = await ctx.db.groupMember.findMany({
        where: { groupId: input.groupId, leftAt: null, userId: { not: null } },
      });

      for (const member of members) {
        await createNotification(ctx.db, {
          userId: member.userId!,
          type: "MONTH_CLOSED",
          payload: { groupId: input.groupId, month: input.month, year: input.year },
        });
      }

      return balance;
    }),
});
