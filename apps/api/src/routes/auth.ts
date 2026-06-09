import { prisma } from "@cowcular/db";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { z } from "zod";
import { signToken } from "../lib/jwt.js";

export const authRoutes = new Hono();

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

const loginSchema = z.object({
  identifier: z.string(), // email ou username
  password: z.string(),
});

authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const result = registerSchema.safeParse(body);
  if (!result.success) return c.json({ error: result.error.flatten() }, 400);

  const { username, email, name, password } = result.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) return c.json({ error: "E-mail ou username já em uso." }, 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username, email, name, passwordHash },
    select: { id: true, username: true, name: true, email: true },
  });

  return c.json({ user }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const result = loginSchema.safeParse(body);
  if (!result.success) return c.json({ error: result.error.flatten() }, 400);

  const { identifier, password } = result.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });
  if (!user) return c.json({ error: "Credenciais inválidas." }, 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return c.json({ error: "Credenciais inválidas." }, 401);

  const token = await signToken(user.id);

  return c.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, email: user.email },
  });
});
