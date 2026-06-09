import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, z } from "../server.js";

export const categoriesRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.db.category.findMany({
      where: {
        OR: [{ isSystem: true }, { userId: ctx.session.userId }],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        icon: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.category.create({
        data: {
          name: input.name,
          icon: input.icon,
          isSystem: false,
          userId: ctx.session.userId,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.category.findUnique({
        where: { id: input.id },
      });

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (category.isSystem) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (category.userId !== ctx.session.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.category.delete({ where: { id: input.id } });
    }),
});
