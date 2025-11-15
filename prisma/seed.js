const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  for (const id of [1, 2, 3]) {
    await prisma.parkingSpace.upsert({
      where: { id },
      update: { occupied: false, updated_at: now },
      create: { id, occupied: false, updated_at: now },
    });
  }
}

main()
  .catch(() => process.exit(1))
  .finally(async () => {
    await prisma.$disconnect();
  });