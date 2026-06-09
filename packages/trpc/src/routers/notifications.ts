import { protectedProcedure, router, z } from "../server.js";

export const notificationsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.notification.findMany({
      where: { userId: ctx.session.userId },
      orderBy: { createdAt: "desc" },
    }),
  ),

  markRead: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.notification.update({
      where: { id: input.id, userId: ctx.session.userId },
      data: { read: true },
    }),
  ),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.notification.updateMany({
      where: { userId: ctx.session.userId, read: false },
      data: { read: true },
    });
    return { count: result.count };
  }),
});

export async function createNotification(
  db: { notification: { create: (args: any) => Promise<any> } },
  notification: { userId: string; type: string; payload: Record<string, unknown> },
): Promise<void> {
  await db.notification.create({ data: notification });
}
