import type { prisma } from "@cowcular/db";
import type { Context } from "@cowcular/trpc";

type CreateContextOptions = {
  req: Request;
  db: typeof prisma;
};

export function createContext({ req, db }: CreateContextOptions): Context {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // JWT verification happens here - simplified for bootstrap
  // In production, verify the JWT and extract userId
  const session = token ? parseToken(token) : null;

  return { db, session };
}

function parseToken(token: string): { userId: string } | null {
  try {
    // TODO: replace with proper JWT verification (jose or jsonwebtoken)
    // biome-ignore lint/style/noNonNullAssertion: stub JWT — substituir por jose antes do prod
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64").toString());
    return { userId: payload.sub as string };
  } catch {
    return null;
  }
}
