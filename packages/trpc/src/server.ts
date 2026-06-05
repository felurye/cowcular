import type { prisma } from "@cowcular/db";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

export type Context = {
  db: typeof prisma;
  session: { userId: string } | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export { z };
