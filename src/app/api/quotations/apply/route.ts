import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// ─── Component classification ─────────────────────────────────────────────────
type Component = "diffuser" | "oil" | "lamp" | "brush" | "ignore";

function classify(title: string, variantTitle: string | null): Component {
  const t = (title + " " + (variantTitle ?? "")).toLowerCase();
  if (t.includes("shipping protection") || t.includes("insurance")) return "ignore";
  if (t.includes("lamp"))      return "lamp";
  if (t.includes("brush") || t.includes("cleaning")) return "brush";
  if (
    t.includes("jellyfish") || t.includes("humidifier") || t.includes("vibe") ||
    t.includes("diffuser")  ||
    (t.includes("difhouser") && !t.includes("oil"))
  ) return "diffuser";
  if (t.includes("essential oil") || t.includes("10ml")) return "oil";
  return "ignore";
}

// ─── Order composition ────────────────────────────────────────────────────────
interface Composition {
  nDiffusers: number;
  nOils:      number;
  nLamps:     number;
  nBrush:     number;
}

function compose(lineItems: { title: string; variantTitle: string | null; quantity: number }[]): Composition {
  let nDiffusers = 0, nOils = 0, nLamps = 0, nBrush = 0;
  for (const item of lineItems) {
    const type = classify(item.title, item.variantTitle);
    if (type === "diffuser") nDiffusers += item.quantity;
    else if (type === "oil")  nOils      += item.quantity;
    else if (type === "lamp") nLamps     += item.quantity;
    else if (type === "brush") nBrush    += item.quantity;
  }
  return { nDiffusers, nOils, nLamps, nBrush };
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
function calcCOGS(comp: Composition, country: string, quotations: Quotation[]): number | null {
  const { nDiffusers, nOils, nLamps, nBrush } = comp;

  // Nothing shippable
  if (nDiffusers === 0 && nOils === 0 && nBrush === 0) return null;

  let total = 0;

  // Case A: diffuser present
  if (nDiffusers > 0) {
    if (nOils === 0 && nBrush > 0) {
      // A1: diffuser + brush only (no oils) → "diffuser brush" bundle
      const q = lookup(quotations, "diffuser brush", country);
      if (!q) return null;
      total += q.totalPrice * nDiffusers;

    } else if (nOils > 0) {
      // A2: diffuser + oils (± lamp ± brush)
      const oilsPerUnit = Math.round(nOils / nDiffusers);
      const hasLamp = nLamps > 0;

      let keyword: string;
      if (hasLamp) {
        keyword = oilsPerUnit >= 2 ? "2 bottle lamp" : "1 bottle lamp";
      } else {
        if (oilsPerUnit <= 1) keyword = "1 bottle";
        else if (oilsPerUnit === 2) keyword = "2 bottle";
        else if (oilsPerUnit === 3) keyword = "3 bottle";
        else if (oilsPerUnit === 4) keyword = "4 bottle";
        else keyword = "5 bottle";
      }

      const q = lookup(quotations, keyword, country);
      if (!q) return null;
      total += q.totalPrice * nDiffusers;

      // Add standalone brush cost on top (if brush present and not already
      // included in the matched quotation — 4+bottle bundles already include brush)
      if (nBrush > 0 && !["4 bottle", "5 bottle"].includes(keyword)) {
        const bq = lookup(quotations, "brush", country);
        if (bq) total += bq.totalPrice * nBrush;
      }

    } else {
      // A3: diffuser only (no oils, no brush) → use "1 bottle" as baseline
      const q = lookup(quotations, "1 bottle", country);
      if (!q) return null;
      total += q.totalPrice * nDiffusers;
    }
  }

  // Case B: no diffuser
  if (nDiffusers === 0) {
    if (nOils > 0) {
      // B1: oils only
      const b = Math.min(nOils, 4);
      const q = lookup(quotations, `oil ${b}`, country);
      if (!q) return null;
      total += q.totalPrice;
    }

    if (nBrush > 0) {
      // B2: standalone brush
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
