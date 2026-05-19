import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Titanic diffuser: $14.7 product cost, same shipping as jellyfish US ($13.38)
// Cozy Cabin diffuser: $9.96 product cost, same shipping as jellyfish US ($13.38)
const SHIP_US_1B = 13.38;
const OIL = 1.2;

const entries = [
  // Titanic + 1 bottle (US) — current order #1494
  { keyword: "titanic 1 bottle", country: "US", productFee: +(14.7 + OIL).toFixed(2), shippingFee: SHIP_US_1B, totalPrice: +(14.7 + OIL + SHIP_US_1B).toFixed(2), remark: "Titanic 1b US" },
  // Cozy Cabin + 1 bottle (US) — current order #1486
  { keyword: "cozy 1 bottle",    country: "US", productFee: +(9.96 + OIL).toFixed(2), shippingFee: SHIP_US_1B, totalPrice: +(9.96 + OIL + SHIP_US_1B).toFixed(2), remark: "Cozy Cabin 1b US" },
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
