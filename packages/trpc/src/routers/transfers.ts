import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, z } from "../server.js";

export const transfersRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: z.string().uuid().optional() }))
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
    .input(z.object({ id: z.string().uuid() }))
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
    .input(z.object({ id: z.string().uuid() }))
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

  offset: protectedProcedure
    .input(
      z.object({
        transferId: z.string().uuid(),
        offsetWithTransferId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [transferA, transferB] = await Promise.all([
        ctx.db.transfer.findUnique({
          where: { id: input.transferId },
          include: { fromMember: true, toMember: true },
        }),
        ctx.db.transfer.findUnique({
          where: { id: input.offsetWithTransferId },
          include: { fromMember: true, toMember: true },
        }),
      ]);

      if (!transferA || !transferB) throw new TRPCError({ code: "NOT_FOUND" });

      const userId = ctx.session.userId;
      const isParticipant =
        transferA.fromMember.userId === userId ||
        transferA.toMember.userId === userId ||
        transferB.fromMember.userId === userId ||
        transferB.toMember.userId === userId;
      if (!isParticipant) throw new TRPCError({ code: "FORBIDDEN" });

      const isOpposite =
        transferA.fromMemberId === transferB.toMemberId &&
        transferA.toMemberId === transferB.fromMemberId;
      if (!isOpposite)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Repasses devem ser entre os mesmos membros em direções opostas.",
        });

      const eligible = ["PENDING", "AWAITING_CONFIRMATION"];
      if (!eligible.includes(transferA.status) || !eligible.includes(transferB.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas repasses pendentes podem ser abatidos.",
        });
      }

      const amtA = Number(transferA.amount);
      const amtB = Number(transferB.amount);
      const net = Math.abs(amtA - amtB);

      return ctx.db.$transaction(async (tx) => {
        let netTransfer = null;

        if (net > 0) {
          const [from, to] =
            amtA > amtB
              ? [transferA.fromMemberId, transferA.toMemberId]
              : [transferB.fromMemberId, transferB.toMemberId];

          netTransfer = await tx.transfer.create({
            data: {
              fromMemberId: from,
              toMemberId: to,
              groupId: transferA.groupId,
              amount: net,
              currency: transferA.currency,
              month: transferA.month,
              year: transferA.year,
            },
          });
        }

        await tx.transfer.update({
          where: { id: input.transferId },
          data: { status: "OFFSET", offsetTransferId: input.offsetWithTransferId },
        });
        await tx.transfer.update({
          where: { id: input.offsetWithTransferId },
          data: { status: "OFFSET", offsetTransferId: input.transferId },
        });

        return { transferA, transferB, netTransfer: netTransfer ?? null };
      });
    }),
});
