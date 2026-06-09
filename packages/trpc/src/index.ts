import { accountsRouter } from "./routers/accounts.js";
import { authRouter } from "./routers/auth.js";
import { categoriesRouter } from "./routers/categories.js";
import { groupsRouter } from "./routers/groups.js";
import { notificationsRouter } from "./routers/notifications.js";
import { transfersRouter } from "./routers/transfers.js";
import { router } from "./server.js";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  accounts: accountsRouter,
  transfers: transfersRouter,
  categories: categoriesRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;

export { type Context, protectedProcedure, publicProcedure, router } from "./server.js";
