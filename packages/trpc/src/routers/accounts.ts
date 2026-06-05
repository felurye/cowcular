import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, z } from "../server.js";

const splitSchema = z
  .array(z.object({ memberId: z.string(), percentage: z.number().positive() }))
  .refine((splits) => {
    const total = splits.reduce((sum, s) => sum + s.percentage, 0);
    return Math.abs(total - 100) < 0.01;
  }, "A divisão deve somar 100%.");

export const accountsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        groupId: z.string().optional(),
        personal: z.boolean().optional(),
        status: z.enum(["OPEN", "PAID", "DEFERRED", "CLOSED"]).optional(),
        categoryId: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db.account.findMany({
        where: {
          ...(input.groupId ? { groupId: input.groupId } : {}),
          ...(input.personal ? { groupId: null, paidBy: { userId: ctx.session.userId } } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.from || input.to
            ? {
                dueDate: {
                  ...(input.from ? { gte: input.from } : {}),
                  ...(input.to ? { lte: input.to } : {}),
                },
              }
            : {}),
        },
        include: {
          category: true,
          paidBy: { include: { user: { select: { id: true, username: true, name: true } } } },
          splits: {
            include: {
              member: { include: { user: { select: { id: true, username: true, name: true } } } },
            },
          },
        },
        orderBy: { dueDate: "desc" },
      }),
    ),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        amount: z.number().positive(),
        currency: z.string().default("BRL"),
        dueDate: z.date().optional(),
        categoryId: z.string().optional(),
        type: z.enum(["EXPENSE", "INCOME"]),
        recurrence: z.enum(["ONCE", "RECURRING", "INSTALLMENT"]).default("ONCE"),
        totalInstallments: z.number().int().positive().optional(),
        installmentNumber: z.number().int().positive().optional(),
        groupId: z.string().optional(),
        paidByMemberId: z.string(),
        splits: splitSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { splits, amount, ...rest } = input;

      if (rest.groupId) {
        const member = await ctx.db.groupMember.findFirst({
          where: { groupId: rest.groupId, userId: ctx.session.userId, leftAt: null },
        });
        if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.account.create({
        data: {
          ...rest,
          amount,
          splits: splits
            ? {
                create: splits.map((s) => ({
                  memberId: s.memberId,
                  percentage: s.percentage,
                  amountDue: (amount * s.percentage) / 100,
                })),
              }
            : undefined,
        },
        include: { splits: true },
      });
    }),

  markPaid: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.account.findUnique({ where: { id: input.id } });
      if (!account) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.account.update({ where: { id: input.id }, data: { status: "PAID" } });
    }),

  defer: protectedProcedure
    .input(z.object({ id: z.string(), targetMonth: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const origin = await ctx.db.account.findUnique({
        where: { id: input.id },
        include: { group: true },
      });
      if (!origin) throw new TRPCError({ code: "NOT_FOUND" });
      if (origin.group?.type !== "HOME") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Adiamento disponível apenas para Lares.",
        });
      }

      await ctx.db.account.update({ where: { id: input.id }, data: { status: "DEFERRED" } });
      return ctx.db.account.create({
        data: {
          title: origin.title,
          amount: origin.amount,
          currency: origin.currency,
          dueDate: input.targetMonth,
          categoryId: origin.categoryId,
          type: origin.type,
          groupId: origin.groupId,
          paidByMemberId: origin.paidByMemberId,
          originAccountId: origin.id,
          originMonth: origin.dueDate,
        },
      });
    }),
});
