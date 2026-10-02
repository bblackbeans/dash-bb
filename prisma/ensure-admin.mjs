import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const existing = await prisma.user.count();
if (existing === 0) {
  await prisma.user.create({
    data: {
      email: "admin@blackbeans.com.br",
      name: "Admin BlackBeans",
      passwordHash: await bcrypt.hash("blackbeans123", 10),
    },
  });
  console.log("Admin criado: admin@blackbeans.com.br");
}

await prisma.$disconnect();
