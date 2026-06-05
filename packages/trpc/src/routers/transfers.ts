import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, z } from "../server.js";

export const transfersRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.string().optional() }))
    .query(({ ctx, input }) =>
      ctx.db.transfer.findMany({
        where: {
          groupId: input.groupId,
          OR: [
            { fromMember: { userId: ctx.session.userId } },
            { toMember: { userId: ctx.session.userId } },
          ],
        },
        include: {
          fromMember: { include: { user: { select: { id: true, username: true, name: true } } } },
          toMember: { include: { user: { select: { id: true, username: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ),

  markPaid: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const transfer = await ctx.db.transfer.findFirst({
        where: { id: input.id, fromMember: { userId: ctx.session.userId } },
      });
      if (!transfer) throw new TRPCError({ code: "NOT_FOUND" });

      const toMember = await ctx.db.groupMember.findUnique({ where: { id: transfer.toMemberId } });
      const isExternal = !toMember?.userId;

      return ctx.db.transfer.update({
        where: { id: input.id },
        data: {
          status: isExternal ? "EXTERNAL_PAID" : "AWAITING_CONFIRMATION",
        },
      });
    }),

  confirm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const transfer = await ctx.db.transfer.findFirst({
        where: {
          id: input.id,
          toMember: { userId: ctx.session.userId },
          status: "AWAITING_CONFIRMATION",
        },
      });
      if (!transfer) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.transfer.update({
        where: { id: input.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
    }),
});
