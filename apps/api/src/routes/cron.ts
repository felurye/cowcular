import { prisma } from "@cowcular/db";
import { performMonthClose } from "@cowcular/trpc";
import { Hono } from "hono";

export const cronRoutes = new Hono();

cronRoutes.get("/monthly-close", async (c) => {
  // Proteção básica: Vercel envia CRON_SECRET no header Authorization
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = c.req.header("Authorization");
    if (auth !== `Bearer ${secret}`) return c.json({ error: "Unauthorized" }, 401);
  }

  const now = new Date();
  const currentMonthIndex = now.getMonth(); // 0-indexed
  const prevMonth = currentMonthIndex === 0 ? 12 : currentMonthIndex; // 1-indexed
  const prevYear = currentMonthIndex === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const autoGroups = await prisma.group.findMany({
    where: { type: "HOME", closingMode: "AUTO", status: "ACTIVE" },
  });

  const results = [];
  for (const group of autoGroups) {
    const existing = await prisma.monthlyBalance.findUnique({
      where: { groupId_month_year: { groupId: group.id, month: prevMonth, year: prevYear } },
    });
    if (existing?.status === "CLOSED") {
      results.push({ groupId: group.id, skipped: true });
      continue;
    }
    try {
      await performMonthClose(prisma as any, group.id, prevMonth, prevYear);
      results.push({ groupId: group.id, closed: true });
    } catch (err) {
      results.push({ groupId: group.id, error: String(err) });
    }
  }

  return c.json({ month: prevMonth, year: prevYear, processed: results.length, results });
});
