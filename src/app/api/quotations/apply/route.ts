import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Component classification ─────────────────────────────────────────────────
type Component = "jellyfish" | "bloom" | "salt" | "oil" | "lamp" | "brush" | "cannon" | "ignore";

function classify(title: string, variantTitle: string | null): Component {
  const t = (title + " " + (variantTitle ?? "")).toLowerCase();
  if (t.includes("shipping protection") || t.includes("insurance")) return "ignore";
  if (t.includes("adapter")) return "ignore";  // bundled into salt unit cost
  if (t.includes("lamp"))      return "lamp";
  if (t.includes("cannon"))    return "cannon";
  if (t.includes("brush") || t.includes("cleaning")) return "brush";
  if (t.includes("bloom") || t.includes("botanical")) return "bloom";
  if (t.includes("himalayan") || t.includes("salt stone")) return "salt";
  if (
    t.includes("jellyfish") || t.includes("humidifier") || t.includes("vibe") ||
    t.includes("diffuser")  ||
    (t.includes("difhouser") && !t.includes("oil"))
  ) return "jellyfish";
  if (t.includes("essential oil") || t.includes("10ml")) return "oil";
  return "ignore";
}

// ─── Order composition ────────────────────────────────────────────────────────
interface Composition {
  nJellyfish: number;
  nBloom:     number;
  nSalt:      number;
  nOils:      number;
  nLamps:     number;
  nBrush:     number;
  nCannon:    number;
}

function compose(lineItems: { title: string; variantTitle: string | null; quantity: number }[]): Composition {
  let nJellyfish = 0, nBloom = 0, nSalt = 0, nOils = 0, nLamps = 0, nBrush = 0, nCannon = 0;
  for (const item of lineItems) {
    const type = classify(item.title, item.variantTitle);
    if (type === "jellyfish")   nJellyfish += item.quantity;
    else if (type === "bloom")  nBloom     += item.quantity;
    else if (type === "salt")   nSalt      += item.quantity;
    else if (type === "oil")    nOils      += item.quantity;
    else if (type === "lamp")   nLamps     += item.quantity;
    else if (type === "brush")  nBrush     += item.quantity;
    else if (type === "cannon") nCannon    += item.quantity;
  }
  return { nJellyfish, nBloom, nSalt, nOils, nLamps, nBrush, nCannon };
}

// ─── Lookup helper ────────────────────────────────────────────────────────────
type Quotation = { keyword: string; country: string; totalPrice: number };

function lookup(quotations: Quotation[], keyword: string, country: string): Quotation | undefined {
  return (
    quotations.find(q => q.keyword === keyword && q.country === country) ??
    quotations.find(q => q.keyword === keyword)  // fallback: any country
  );
}

// ─── COGS calculation ─────────────────────────────────────────────────────────
function calcForDiffuserType(
  prefix: string,
  nUnits: number,
  nOils: number,
  nLamps: number,
  nBrush: number,
  nCannon: number,
  country: string,
  quotations: Quotation[],
): number | null {
  let total = 0;

  if (nCannon > 0 && nOils > 0) {
    // diffuser + bottle + cannon
    const q = lookup(quotations, `${prefix} 1 bottle cannon`, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;

  } else if (nOils === 0 && nBrush > 0) {
    // diffuser + brush only
    const brushKeyword = nBrush >= 3 ? `${prefix} 3 brush` : `${prefix} brush`;
    const q = lookup(quotations, brushKeyword, country) ?? lookup(quotations, `${prefix} brush`, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;

  } else if (nOils > 0) {
    // diffuser + oils (± lamp ± brush)
    const oilsPerUnit = Math.round(nOils / nUnits);
    const hasLamp = nLamps > 0;

    let keyword: string;
    if (hasLamp) {
      if (oilsPerUnit <= 1)      keyword = `${prefix} 1 bottle lamp`;
      else if (oilsPerUnit <= 2) keyword = `${prefix} 2 bottle lamp`;
      else if (oilsPerUnit <= 3) keyword = `${prefix} 3 bottle lamp`;
      else                       keyword = `${prefix} 4 bottle lamp`;
    } else {
      if (oilsPerUnit <= 1) keyword = `${prefix} 1 bottle`;
      else if (oilsPerUnit === 2) keyword = `${prefix} 2 bottle`;
      else if (oilsPerUnit === 3) keyword = `${prefix} 3 bottle`;
      else if (oilsPerUnit === 4) keyword = `${prefix} 4 bottle`;
      else keyword = `${prefix} 5 bottle`;
    }

    const q = lookup(quotations, keyword, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;

    // Add standalone brush (4+ bottle bundles already include brush)
    if (nBrush > 0 && !keyword.includes("4 bottle") && !keyword.includes("5 bottle")) {
      const bq = lookup(quotations, "brush", country);
      if (bq) total += bq.totalPrice * nBrush;
    }

  } else {
    // diffuser only → use "1 bottle" as baseline
    const q = lookup(quotations, `${prefix} 1 bottle`, country);
    if (!q) return null;
    total += q.totalPrice * nUnits;
  }

  return total;
}

function calcCOGS(comp: Composition, country: string, quotations: Quotation[]): number | null {
  const { nJellyfish, nBloom, nSalt, nOils, nLamps, nBrush, nCannon } = comp;

  const nDiffusers = nJellyfish + nBloom + nSalt;
  if (nDiffusers === 0 && nOils === 0 && nBrush === 0 && nCannon === 0) return null;

  let total = 0;

  // Jellyfish diffuser orders
  if (nJellyfish > 0) {
    const sub = calcForDiffuserType("jellyfish", nJellyfish, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // Bloom diffuser orders
  if (nBloom > 0) {
    const sub = calcForDiffuserType("bloom", nBloom, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // Salt diffuser orders (always includes adapter in unit cost)
  if (nSalt > 0) {
    const sub = calcForDiffuserType("salt", nSalt, nOils, nLamps, nBrush, nCannon, country, quotations);
    if (sub === null) return null;
    total += sub;
  }

  // No diffuser at all
  if (nDiffusers === 0) {
    if (nOils > 0) {
      const b = Math.min(nOils, 4);
      const q = lookup(quotations, `oil ${b}`, country);
      if (!q) return null;
      total += q.totalPrice;
    }
    if (nBrush > 0) {
      const q = lookup(quotations, "brush", country);
      if (!q) return null;
      total += q.totalPrice * nBrush;
    }
  }

  return total > 0 ? total : null;
}

// ─── API handler ──────────────────────────────────────────────────────────────
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

  const quotations = await prisma.productQuotation.findMany({ where: { storeId: store.id } });
  if (quotations.length === 0) {
    return NextResponse.json({ success: true, updated: 0, skipped: 0, message: "No quotations defined" });
  }

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { lineItems: true },
  });

  let updated = 0, skipped = 0;

  for (const order of orders) {
    const country = (order.shippingCountry ?? "").toUpperCase();
    const comp    = compose(order.lineItems);
    const cogs    = calcCOGS(comp, country, quotations);

    if (cogs === null) { skipped++; continue; }

    const grossProfit = order.totalPrice - order.totalRefunds - cogs - order.transactionFees;
    await prisma.order.update({
      where: { id: order.id },
      data: { cogs, grossProfit },
    });
    updated++;
  }

  return NextResponse.json({ success: true, updated, skipped });
}
