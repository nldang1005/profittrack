import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Standalone converter — $8.77/unit (used in orders #1295, #1391)
  { keyword: "converter", country: "US", productFee: 8.77, shippingFee: 0, totalPrice: 8.77, remark: "converter $8.77" },
];

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) { console.error("No store found"); process.exit(1); }

  for (const e of entries) {
    await prisma.productQuotation.upsert({
      where: { storeId_keyword_country: { storeId: store.id, keyword: e.keyword, country: e.country } },
      update: { productFee: e.productFee, shippingFee: e.shippingFee, totalPrice: e.totalPrice, remark: e.remark },
      create: { storeId: store.id, ...e },
    });
    console.log(`✓ [${e.country}] ${e.keyword} = $${e.totalPrice}`);
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
