import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const entries = [
  // Standalone brush (US) — $7.02
  { keyword: "brush",                       country: "US", productFee: 2.24,  shippingFee: 4.78,  totalPrice: 7.02,  remark: "brush US" },
  // Mixed jellyfish+rain + 2 bottles (Switzerland) — $60.96
  { keyword: "jellyfish rain 2 bottle",     country: "CH", productFee: 33.56, shippingFee: 27.40, totalPrice: 60.96, remark: "jellyfish+rain+2b CH" },
  // Jellyfish 2 bottles (US) — $33.40
  { keyword: "jellyfish 2 bottle",          country: "US", productFee: 17.58, shippingFee: 15.82, totalPrice: 33.40, remark: "jellyfish 2 bottle US" },
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
