import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Jellyfish 2 bottles + lamp (US) — $48.66
  { keyword: "jellyfish 2 bottle lamp",  country: "US", productFee: 23.94, shippingFee: 24.72, totalPrice: 48.66, remark: "jellyfish 2b+lamp US" },
  // Jellyfish 4 bottles + brush (CA) — $41.46
  { keyword: "jellyfish 4 bottle brush", country: "CA", productFee: 22.22, shippingFee: 19.24, totalPrice: 41.46, remark: "jellyfish 4b+brush CA" },
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
