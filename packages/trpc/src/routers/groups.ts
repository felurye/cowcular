import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router, z } from "../server.js";
import { createNotification } from "./notifications.js";

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

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
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

  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.groupMember.findFirst({
        where: { groupId: input.id, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db.group.update({
        where: { id: input.id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
    }),

  leave: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.groupMember.findFirst({
        where: { groupId: input.id, userId: ctx.session.userId, leftAt: null },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.groupMember.update({ where: { id: member.id }, data: { leftAt: new Date() } });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(100) }))
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
        id: z.string().uuid(),
        split: z
          .array(z.object({ memberId: z.string().uuid(), percentage: z.number().positive() }))
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

  findByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.group.findFirst({
        where: { code: input.code, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          type: true,
          eventType: true,
          _count: { select: { members: true } },
        },
      });
    }),

  join: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.group.findFirst({
        where: { code: input.code, status: "ACTIVE" },
      });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.db.groupMember.findFirst({
        where: { groupId: group.id, userId: ctx.session.userId, leftAt: null },
      });
      if (existing)
        throw new TRPCError({ code: "CONFLICT", message: "Você já é membro deste grupo." });

      return ctx.db.groupMember.create({
        data: { groupId: group.id, userId: ctx.session.userId, role: "MEMBER" },
      });
    }),

  inviteByUsername: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), username: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const adminMember = await ctx.db.groupMember.findFirst({
        where: { groupId: input.groupId, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!adminMember) throw new TRPCError({ code: "FORBIDDEN" });

      const user = await ctx.db.user.findUnique({ where: { username: input.username } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.db.groupMember.findFirst({
        where: { groupId: input.groupId, userId: user.id, leftAt: null },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT" });

      const group = await ctx.db.group.findUnique({
        where: { id: input.groupId },
        select: { name: true },
      });

      const member = await ctx.db.groupMember.create({
        data: { groupId: input.groupId, userId: user.id, role: "MEMBER" },
      });

      await createNotification(ctx.db, {
        userId: user.id,
        type: "GROUP_INVITE",
        payload: { groupId: input.groupId, groupName: group?.name ?? "" },
      });

      return member;
    }),

  inviteByEmail: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const adminMember = await ctx.db.groupMember.findFirst({
        where: { groupId: input.groupId, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!adminMember) throw new TRPCError({ code: "FORBIDDEN" });

      const user = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.db.groupMember.findFirst({
        where: { groupId: input.groupId, userId: user.id, leftAt: null },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT" });

      const group = await ctx.db.group.findUnique({
        where: { id: input.groupId },
        select: { name: true },
      });

      const member = await ctx.db.groupMember.create({
        data: { groupId: input.groupId, userId: user.id, role: "MEMBER" },
      });

      await createNotification(ctx.db, {
        userId: user.id,
        type: "GROUP_INVITE",
        payload: { groupId: input.groupId, groupName: group?.name ?? "" },
      });

      return member;
    }),

  addExternal: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        externalName: z.string().min(1).max(100),
        externalContact: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.group.findUnique({ where: { id: input.groupId } });
      if (!group) throw new TRPCError({ code: "NOT_FOUND" });
      if (group.type !== "EVENT")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Participantes externos só são permitidos em Grupos Avulsos.",
        });

      const callerMember = await ctx.db.groupMember.findFirst({
        where: { groupId: input.groupId, userId: ctx.session.userId, leftAt: null },
      });
      if (!callerMember) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.db.groupMember.create({
        data: {
          groupId: input.groupId,
          userId: null,
          externalName: input.externalName,
          externalContact: input.externalContact ?? null,
          role: "MEMBER",
        },
      });
    }),

  removeExternal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.groupMember.findUnique({ where: { id: input.id } });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      if (member.userId !== null)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use removeMember para membros cadastrados.",
        });

      const adminMember = await ctx.db.groupMember.findFirst({
        where: { groupId: member.groupId, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!adminMember) throw new TRPCError({ code: "FORBIDDEN" });

      const splitCount = await ctx.db.accountSplit.count({ where: { memberId: input.id } });
      if (splitCount > 0)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Participante possui contas associadas e não pode ser removido.",
        });

      const transferCount = await ctx.db.transfer.count({
        where: { OR: [{ fromMemberId: input.id }, { toMemberId: input.id }] },
      });
      if (transferCount > 0)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Participante possui transferências associadas e não pode ser removido.",
        });

      return ctx.db.groupMember.delete({ where: { id: input.id } });
    }),

  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.groupMember.findUnique({ where: { id: input.memberId } });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      const adminMember = await ctx.db.groupMember.findFirst({
        where: { groupId: member.groupId, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!adminMember) throw new TRPCError({ code: "FORBIDDEN" });

      if (member.userId === ctx.session.userId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use o procedimento leave para sair do grupo.",
        });

      if (member.role === "ADMIN") {
        const otherAdminCount = await ctx.db.groupMember.count({
          where: {
            groupId: member.groupId,
            role: "ADMIN",
            leftAt: null,
            id: { not: member.id },
          },
        });
        if (otherAdminCount === 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Não é possível remover o único admin.",
          });
      }

      return ctx.db.groupMember.update({
        where: { id: input.memberId },
        data: { leftAt: new Date() },
      });
    }),

  transferAdmin: protectedProcedure
    .input(z.object({ groupId: z.string().uuid(), newAdminMemberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const callerMember = await ctx.db.groupMember.findFirst({
        where: { groupId: input.groupId, userId: ctx.session.userId, role: "ADMIN", leftAt: null },
      });
      if (!callerMember) throw new TRPCError({ code: "FORBIDDEN" });

      const targetMember = await ctx.db.groupMember.findUnique({
        where: { id: input.newAdminMemberId },
      });
      if (!targetMember || targetMember.leftAt !== null) throw new TRPCError({ code: "NOT_FOUND" });

      if (callerMember.id === input.newAdminMemberId) throw new TRPCError({ code: "CONFLICT" });

      const [from, to] = await ctx.db.$transaction([
        ctx.db.groupMember.update({
          where: { id: callerMember.id },
          data: { role: "MEMBER" },
        }),
        ctx.db.groupMember.update({
          where: { id: targetMember.id },
          data: { role: "ADMIN" },
        }),
      ]);

      return { from, to };
    }),
});
