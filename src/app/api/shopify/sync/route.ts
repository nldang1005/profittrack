import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shopifyFetchAll, shopifyUrl, getShopifyHeaders, calculateTransactionFee } from "@/lib/shopify";
import { subDays } from "date-fns";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({
    where: { userId: session.user.id },
  });

  if (!store) {
    return NextResponse.json({ error: "No store connected" }, { status: 400 });
  }

  try {
    // Sync last 90 days (or since last sync)
    const since = store.lastSyncAt
      ? store.lastSyncAt.toISOString()
      : subDays(new Date(), 90).toISOString();

    // Fetch orders
    const orders = await shopifyFetchAll<any>(
      store.shopDomain,
      store.accessToken,
      `/orders.json?status=any&created_at_min=${since}&limit=250&fields=id,order_number,email,financial_status,fulfillment_status,total_price,subtotal_price,total_shipping_price_set,total_tax,total_discounts,total_price_set,created_at,processed_at,refunds,line_items,payment_gateway`,
      "orders"
    );

    // Fetch Shopify inventory costs (primary source)
    const variants = await shopifyFetchAll<any>(
      store.shopDomain,
      store.accessToken,
      `/variants.json?limit=250&fields=id,inventory_item_id`,
      "variants"
    );

    const variantCostMap = new Map<string, number>();

    const invItemIds = variants.map((v: any) => v.inventory_item_id);
    for (let i = 0; i < invItemIds.length; i += 100) {
      const batch = invItemIds.slice(i, i + 100);
      const invRes = await fetch(
        shopifyUrl(store.shopDomain, `/inventory_items.json?ids=${batch.join(",")}`),
        { headers: getShopifyHeaders(store.accessToken) }
      );
      const invData = await invRes.json();
      for (const item of invData.inventory_items || []) {
        const variant = variants.find((v: any) => v.inventory_item_id === item.id);
        if (variant) {
          variantCostMap.set(String(variant.id), parseFloat(item.cost || "0"));
        }
      }
    }

    // Fallback: dùng cost từ DB cho variant Shopify trả về 0
    const zeroIds = [...variantCostMap.entries()].filter(([, c]) => c === 0).map(([id]) => id);
    if (zeroIds.length > 0) {
      const dbVariants = await prisma.productVariant.findMany({
        where: { shopifyVariantId: { in: zeroIds }, cost: { gt: 0 } },
        select: { shopifyVariantId: true, cost: true },
      });
      for (const v of dbVariants) {
        variantCostMap.set(v.shopifyVariantId, v.cost);
      }
    }

    // Upsert orders
    let synced = 0;
    for (const order of orders) {
      const totalRefunds = (order.refunds || []).reduce((sum: number, r: any) => {
        return sum + (r.transactions || []).reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0);
      }, 0);

      const lineItems = order.line_items || [];
      const cogs = lineItems.reduce((sum: number, item: any) => {
        const cost = variantCostMap.get(String(item.variant_id)) || 0;
        return sum + cost * item.quantity;
      }, 0);

      const totalPrice = parseFloat(order.total_price || 0);
      const transactionFees = calculateTransactionFee(totalPrice, order.payment_gateway || "");

      const dbOrder = await prisma.order.upsert({
        where: {
          storeId_shopifyOrderId: {
            storeId: store.id,
            shopifyOrderId: String(order.id),
          },
        },
        create: {
          storeId: store.id,
          shopifyOrderId: String(order.id),
          orderNumber: order.order_number,
          email: order.email,
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          totalPrice,
          subtotalPrice: parseFloat(order.subtotal_price || 0),
          totalShipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0),
          totalTax: parseFloat(order.total_tax || 0),
          totalDiscounts: parseFloat(order.total_discounts || 0),
          totalRefunds,
          currency: store.currency,
          cogs,
          transactionFees,
          grossProfit: totalPrice - totalRefunds - cogs - transactionFees,
          createdAt: new Date(order.created_at),
          processedAt: order.processed_at ? new Date(order.processed_at) : null,
        },
        update: {
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          totalRefunds,
          cogs,
          transactionFees,
          grossProfit: totalPrice - totalRefunds - cogs - transactionFees,
        },
      });

      // Upsert line items
      for (const item of lineItems) {
        const cost = variantCostMap.get(String(item.variant_id)) || 0;
        await prisma.lineItem.upsert({
          where: { id: `${dbOrder.id}-${item.id}` },
          create: {
            id: `${dbOrder.id}-${item.id}`,
            orderId: dbOrder.id,
            productId: String(item.product_id),
            variantId: String(item.variant_id),
            title: item.title,
            variantTitle: item.variant_title,
            sku: item.sku,
            quantity: item.quantity,
            price: parseFloat(item.price),
            totalPrice: parseFloat(item.price) * item.quantity,
            cost,
          },
          update: { cost },
        });
      }

      synced++;
    }

    // Update last sync time
    await prisma.store.update({
      where: { id: store.id },
      data: { lastSyncAt: new Date() },
    });

    // Sync products
    await syncProducts(store);

    return NextResponse.json({ success: true, ordersSync: synced });
  } catch (error) {
    console.error("Shopify sync error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function syncProducts(store: any) {
  const products = await shopifyFetchAll<any>(
    store.shopDomain,
    store.accessToken,
    `/products.json?limit=250&fields=id,title,vendor,product_type,status,variants`,
    "products"
  );

  for (const product of products) {
    const dbProduct = await prisma.product.upsert({
      where: {
        storeId_shopifyProductId: {
          storeId: store.id,
          shopifyProductId: String(product.id),
        },
      },
      create: {
        storeId: store.id,
        shopifyProductId: String(product.id),
        title: product.title,
        vendor: product.vendor,
        productType: product.product_type,
        status: product.status,
      },
      update: {
        title: product.title,
        vendor: product.vendor,
        status: product.status,
      },
    });

    for (const variant of product.variants || []) {
      await prisma.productVariant.upsert({
        where: { shopifyVariantId: String(variant.id) },
        create: {
          productId: dbProduct.id,
          shopifyVariantId: String(variant.id),
          title: variant.title,
          sku: variant.sku,
          price: parseFloat(variant.price || 0),
          inventoryQty: variant.inventory_quantity || 0,
        },
        update: {
          price: parseFloat(variant.price || 0),
          inventoryQty: variant.inventory_quantity || 0,
        },
      });
    }
  }
}
