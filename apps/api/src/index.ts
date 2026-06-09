import { prisma } from "@cowcular/db";
import { appRouter } from "@cowcular/trpc";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContext } from "./context.js";
import { authRoutes } from "./routes/auth.js";
import { cronRoutes } from "./routes/cron.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.route("/auth", authRoutes);
app.route("/cron", cronRoutes);

app.all("/trpc/*", (c) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: ({ req }) => createContext({ req, db: prisma }),
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running at http://localhost:${port}`);
});
