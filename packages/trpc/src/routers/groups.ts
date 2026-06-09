import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, z } from "../server.js";

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export const groupsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.group.findMany({
      where: {
        members: { some: { userId: ctx.session.userId, leftAt: null } },
        status: "ACTIVE",
      },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, name: true, avatar: true } } },
        },
      },
    }),
  ),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["HOME", "EVENT"]),
        eventType: z.enum(["TRIP", "BBQ", "GIFT", "FUNDRAISER", "GENERAL"]).optional(),
        closingMode: z.enum(["AUTO", "MANUAL"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const code = generateCode();
      return ctx.db.group.create({
        data: {
          name: input.name,
          type: input.type,
          eventType: input.eventType ?? null,
          code,
          closingMode: input.type === "HOME" ? (input.closingMode ?? "MANUAL") : null,
          members: {
            create: { userId: ctx.session.userId, role: "ADMIN" },
          },
        },
        include: { members: true },
      });
    }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const group = await ctx.db.group.findFirst({
      where: { id: input.id, members: { some: { userId: ctx.session.userId } } },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, name: true, avatar: true } } },
        },
        balances: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 },
      },
    });
    if (!group) throw new TRPCError({ code: "NOT_FOUND" });
    return group;
  }),

  close: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const member = await ctx.db.groupMember.findFirst({
      where: { groupId: input.id, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
    });
    if (!member) throw new TRPCError({ code: "FORBIDDEN" });
    return ctx.db.group.update({
      where: { id: input.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  }),

  leave: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const member = await ctx.db.groupMember.findFirst({
      where: { groupId: input.id, userId: ctx.session.userId, leftAt: null },
    });
    if (!member) throw new TRPCError({ code: "NOT_FOUND" });
    return ctx.db.groupMember.update({ where: { id: member.id }, data: { leftAt: new Date() } });
  }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const adminMember = await ctx.db.groupMember.findFirst({
        where: { groupId: input.id, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!adminMember) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db.group.update({ where: { id: input.id }, data: { name: input.name } });
    }),

  updateDefaultSplit: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        split: z
          .array(z.object({ memberId: z.string(), percentage: z.number().positive() }))
          .refine(
            (s) => Math.abs(s.reduce((sum, x) => sum + x.percentage, 0) - 100) < 0.01,
            "A divisão deve somar 100%.",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const adminMember = await ctx.db.groupMember.findFirst({
        where: { groupId: input.id, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!adminMember) throw new TRPCError({ code: "FORBIDDEN" });

      const group = await ctx.db.group.findUnique({ where: { id: input.id } });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      if (group.type !== "HOME")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Divisão padrão disponível apenas para Lares.",
        });

      for (const entry of input.split) {
        const activeMember = await ctx.db.groupMember.findFirst({
          where: { id: entry.memberId, groupId: input.id, leftAt: null },
        });
        if (!activeMember)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Membro ${entry.memberId} não encontrado ou inativo no grupo.`,
          });
      }

      const splitMap = Object.fromEntries(input.split.map((s) => [s.memberId, s.percentage]));
      return ctx.db.group.update({
        where: { id: input.id },
        data: { defaultSplit: splitMap },
      });
    }),
});
