import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Mixed jellyfish + flame + 4 bottles (US) — $54.32
  { keyword: "jellyfish flame 4 bottle", country: "US", productFee: 28.44, shippingFee: 25.88, totalPrice: 54.32, remark: "jellyfish+flame+4b US" },
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
