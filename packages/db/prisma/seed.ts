import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const systemCategories = [
  { name: "Moradia", icon: "🏠" },
  { name: "Alimentação", icon: "🛒" },
  { name: "Transporte", icon: "🚗" },
  { name: "Saúde", icon: "💊" },
  { name: "Lazer", icon: "🎉" },
  { name: "Serviços", icon: "📱" },
  { name: "Viagem", icon: "✈️" },
  { name: "Outros", icon: "📦" },
];

async function main() {
  console.log("Seeding system categories...");

  for (const category of systemCategories) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name, isSystem: true, userId: null },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          name: category.name,
          icon: category.icon,
          isSystem: true,
          userId: null,
        },
      });
      console.log(`Created category: ${category.name}`);
    } else {
      console.log(`Skipped (already exists): ${category.name}`);
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
