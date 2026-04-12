"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Store,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface StoreInfo {
  id: string;
  shopDomain: string;
  shopName: string;
  currency: string;
  lastSyncAt: string | null;
  adAccounts: {
    id: string;
    platform: string;
    accountName: string;
    accountId: string;
    isActive: boolean;
    tokenExpiresAt: string | null;
  }[];
}

interface ProductCost {
  id: string;
  productId: string;
  title: string;
  variants: { id: string; title: string; sku: string; cost: number }[];
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopInput, setShopInput] = useState("");
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ name: "", amount: "", frequency: "monthly", category: "custom" });

  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  async function fetchSettings() {
    const res = await fetch("/api/stores");
    const data = await res.json();
    setStoreInfo(data.store || null);
    setLoading(false);
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products || []);
    setLoadingProducts(false);
  }

  async function fetchExpenses() {
    const res = await fetch("/api/expenses");
    const data = await res.json();
    setExpenses(data.expenses || []);
  }

  useEffect(() => {
    fetchSettings();
    fetchProducts();
    fetchExpenses();
  }, []);

  async function connectShopify() {
    if (!shopInput.trim()) return;
    window.location.href = `/api/shopify/connect?shop=${shopInput.trim()}`;
  }

  async function connectFacebook() {
    window.location.href = `/api/facebook/connect`;
  }

  async function syncStore() {
    setSyncing(true);
    await fetch("/api/shopify/sync", { method: "POST" });
    await fetch("/api/facebook/sync", { method: "POST" });
    await fetchSettings();
    setSyncing(false);
  }

  async function updateVariantCost(variantId: string, cost: number) {
    await fetch(`/api/products/cost`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, cost }),
    });
  }

  async function addExpense() {
    if (!newExpense.name || !newExpense.amount) return;
    await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        startDate: new Date().toISOString(),
      }),
    });
    setShowAddExpense(false);
    setNewExpense({ name: "", amount: "", frequency: "monthly", category: "custom" });
    fetchExpenses();
  }

  async function deleteExpense(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    fetchExpenses();
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your store connections and configurations</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Alerts */}
        {connected === "shopify" && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            Shopify store connected successfully!
          </div>
        )}
        {connected === "facebook" && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            Facebook Ads connected successfully!
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <XCircle className="h-4 w-4" />
            Error: {error.replace(/_/g, " ")}. Please check your app credentials.
          </div>
        )}

        {/* Shopify Connection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
                <Store className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">Shopify Store</CardTitle>
                <CardDescription>Connect your Shopify store to sync orders and products</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {storeInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="font-semibold text-gray-900">{storeInfo.shopName}</p>
                    <p className="text-sm text-gray-500">{storeInfo.shopDomain}</p>
                    {storeInfo.lastSyncAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Last synced: {new Date(storeInfo.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Connected</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={syncStore}
                      disabled={syncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                      Sync Now
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    placeholder="your-store.myshopify.com"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === "Enter" && connectShopify()}
                  />
                  <Button onClick={connectShopify} disabled={!shopInput.trim()}>
                    Connect
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Make sure you have created a Shopify app with the required permissions.
                  Add SHOPIFY_API_KEY and SHOPIFY_API_SECRET to your .env file.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facebook Ads Connection */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <div>
                <CardTitle className="text-base">Facebook Ads</CardTitle>
                <CardDescription>Connect your Facebook Business ad accounts to track spend</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {storeInfo?.adAccounts?.filter((a) => a.platform === "facebook").length ? (
              <div className="space-y-2">
                {storeInfo.adAccounts
                  .filter((a) => a.platform === "facebook")
                  .map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{account.accountName}</p>
                        <p className="text-xs text-gray-400">ID: {account.accountId}</p>
                      </div>
                      <Badge variant={account.isActive ? "success" : "secondary"}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                <Button variant="outline" size="sm" onClick={connectFacebook}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add More Accounts
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button onClick={connectFacebook} className="bg-blue-600 hover:bg-blue-700">
                  <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Connect Facebook Ads
                </Button>
                <p className="text-xs text-gray-400">
                  Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to your .env file first.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Costs (COGS) */}
        {storeInfo && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Product Costs (COGS)</CardTitle>
                  <CardDescription>Enter your product costs to calculate accurate profit margins</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProducts ? (
                <div className="py-4 text-center text-sm text-gray-400">Loading products...</div>
              ) : products.length === 0 ? (
                <p className="text-sm text-gray-500">No products found. Sync your store first.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {products.map((product) => (
                    <div key={product.id} className="rounded-lg border border-gray-100 p-3">
                      <p className="text-sm font-semibold text-gray-900 mb-2">{product.title}</p>
                      <div className="space-y-1.5">
                        {product.variants.map((variant) => (
                          <div key={variant.id} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 flex-1">
                              {variant.title !== "Default Title" ? variant.title : ""}
                              {variant.sku && <span className="text-gray-400 ml-1">({variant.sku})</span>}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={variant.cost}
                                className="w-20 rounded border border-gray-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                                onBlur={(e) => updateVariantCost(variant.id, parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Other Expenses */}
        {storeInfo && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Other Expenses</CardTitle>
                  <CardDescription>Shopify subscription, apps, tools, etc.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAddExpense(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddExpense && (
                <div className="mb-4 rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Name</label>
                      <input
                        value={newExpense.name}
                        onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                        placeholder="e.g. Shopify Basic"
                        className="mt-1 w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Amount ($)</label>
                      <input
                        type="number"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                        placeholder="29.00"
                        className="mt-1 w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium">Frequency</label>
                      <select
                        value={newExpense.frequency}
                        onChange={(e) => setNewExpense({ ...newExpense, frequency: e.target.value })}
                        className="mt-1 w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="one_time">One Time</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addExpense}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddExpense(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {expenses.length === 0 ? (
                <p className="text-sm text-gray-400">No expenses added yet.</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{expense.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{expense.frequency}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          ${expense.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
