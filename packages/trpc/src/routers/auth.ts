import { TRPCError } from "@trpc/server";
import { publicProcedure, router, z } from "../server.js";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.session?.userId) return null;
    return ctx.db.user.findUnique({
      where: { id: ctx.session.userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        avatar: true,
        defaultCurrency: true,
      },
    });
  }),

  register: publicProcedure
    .input(
      z.object({
        username: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_]+$/),
        email: z.string().email(),
        name: z.string().min(1).max(100),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findFirst({
        where: { OR: [{ email: input.email }, { username: input.username }] },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "E-mail ou username já em uso." });
      }
      // Password hashing is handled in the API layer via bcrypt before calling this
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Use o endpoint de registro diretamente.",
      });
    }),
});
