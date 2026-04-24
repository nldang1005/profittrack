import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Jellyfish 2 bottles (Finland) — $40.79
  { keyword: "jellyfish 2 bottle", country: "FI", productFee: 17.58, shippingFee: 23.21, totalPrice: 40.79, remark: "jellyfish 2 bottle FI" },
  // Jellyfish 2 bottles + lamp (US) — $47.31
  { keyword: "jellyfish 2 bottle lamp", country: "US", productFee: 23.94, shippingFee: 23.37, totalPrice: 47.31, remark: "jellyfish 2 bottle lamp" },
  // Mixed jellyfish+rhythm + 2 bottles + brush (US) — $71.36
  { keyword: "jellyfish rhythm 2 bottle brush", country: "US", productFee: 39.04, shippingFee: 32.32, totalPrice: 71.36, remark: "jellyfish+rhythm+2b+brush" },
  // Jellyfish 2 bottles (Canada) — $32.85
  { keyword: "jellyfish 2 bottle", country: "CA", productFee: 17.58, shippingFee: 15.27, totalPrice: 32.85, remark: "jellyfish 2 bottle CA" },
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
