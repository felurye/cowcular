import { accountsRouter } from "./routers/accounts.js";
import { authRouter } from "./routers/auth.js";
import { groupsRouter } from "./routers/groups.js";
import { transfersRouter } from "./routers/transfers.js";
import { router } from "./server.js";

export const appRouter = router({
  auth: authRouter,
  groups: groupsRouter,
  accounts: accountsRouter,
  transfers: transfersRouter,
});

export type AppRouter = typeof appRouter;

export { type Context, protectedProcedure, publicProcedure, router } from "./server.js";
