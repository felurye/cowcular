import type { prisma } from "@cowcular/db";
import type { Context } from "@cowcular/trpc";
import { verifyToken } from "./lib/jwt.js";

type CreateContextOptions = {
  req: Request;
  db: typeof prisma;
};

export async function createContext({ req, db }: CreateContextOptions): Promise<Context> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const session = token ? await verifyToken(token) : null;

  return { db, session };
}
