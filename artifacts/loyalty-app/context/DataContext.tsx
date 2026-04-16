import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export interface Transaction {
  id: string;
  customerId: string;
  merchantId: string;
  merchantName: string;
  customerName?: string;
  amount: number;
  pointsEarned: number;
  multiplier: number;
  createdAt: string;
}

export interface Reward {
  id: string;
  merchantId: string;
  merchantName?: string;
  name: string;
  pointsRequired: number;
  rewardType: "discount" | "freeProduct" | "freeService";
  isActive: boolean;
  expiryDate?: string;
}

export interface Redemption {
  id: string;
  customerId: string;
  rewardId: string;
  rewardName: string;
  merchantName: string;
  merchantId: string;
  redeemedAt: string;
}

export interface MerchantData {
  id: string;
  userId: string;
  businessName: string;
  category: string;
  logoUrl?: string;
  pointsRate: number;
  totalCustomers: number;
  pointsThisMonth: number;
  rewardsRedeemed: number;
  qrCode?: string;
}

export interface CustomerData {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  totalPoints: number;
  tier: "bronze" | "silver" | "gold";
  qrCode?: string;
}

export interface MerchantProgressItem {
  merchantId: string;
  merchantName: string;
  merchantCategory: string;
  customerPoints: number;
  nextRewardThreshold: number;
  nextRewardName: string;
  progressPercent: number;
}

interface DataContextType {
  transactions: Transaction[];
  rewards: Reward[];
  redemptions: Redemption[];
  merchants: MerchantData[];
  customers: CustomerData[];
  addTransaction: (t: Omit<Transaction, "id" | "createdAt">) => Promise<void>;
  addReward: (r: Omit<Reward, "id">) => Promise<void>;
  updateReward: (id: string, r: Partial<Reward>) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;
  addRedemption: (r: Omit<Redemption, "id" | "redeemedAt">) => Promise<void>;
  adjustCustomerPoints: (customerId: string, delta: number) => Promise<void>;
  getCustomerTransactions: (customerId: string) => Transaction[];
  getMerchantTransactions: (merchantId: string) => Transaction[];
  getMerchantRewards: (merchantId: string) => Reward[];
  getCustomerRewards: (customerId: string) => { reward: Reward; merchant: MerchantData; customerPoints: number }[];
  getPointsAtMerchant: (customerId: string, merchantId: string) => number;
  getMerchantStats: (merchantId: string) => { activeCustomers: number; pointsThisMonth: number };
  getCustomerRedemptions: (customerId: string) => Redemption[];
  getCustomerProgressPerMerchant: (customerId: string) => MerchantProgressItem[];
  registerMerchant: (m: Omit<MerchantData, "id" | "totalCustomers" | "pointsThisMonth" | "rewardsRedeemed" | "qrCode">) => Promise<MerchantData>;
  registerCustomer: (c: Omit<CustomerData, "id" | "tier" | "qrCode">) => Promise<CustomerData>;
  getMerchantById: (id: string) => MerchantData | undefined;
  getCustomerByUserId: (userId: string) => CustomerData | undefined;
  getMerchantByUserId: (userId: string) => MerchantData | undefined;
  getCustomerByQrCode: (qrCode: string) => CustomerData | undefined;
  updateMerchant: (id: string, data: Partial<MerchantData>) => Promise<void>;
  updateCustomerProfile: (userId: string, data: Partial<CustomerData>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

function getTier(points: number): "bronze" | "silver" | "gold" {
  if (points >= 5000) return "gold";
  if (points >= 1000) return "silver";
  return "bronze";
}

function uid(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

function generateQrCode(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${prefix}-${result}`;
}

// ── Row mappers ──────────────────────────────────────────────────────────────

function rowToMerchant(r: any): MerchantData {
  return {
    id: r.id,
    userId: r.user_id,
    businessName: r.business_name,
    category: r.category,
    logoUrl: r.logo_url ?? undefined,
    pointsRate: r.points_rate,
    totalCustomers: r.total_customers,
    pointsThisMonth: r.points_this_month,
    rewardsRedeemed: r.rewards_redeemed,
    qrCode: r.qr_code ?? undefined,
  };
}

function rowToCustomer(r: any): CustomerData {
  return {
    id: r.id,
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    totalPoints: r.total_points,
    tier: r.tier,
    qrCode: r.qr_code ?? undefined,
  };
}

function rowToReward(r: any): Reward {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    merchantName: r.merchant_name ?? undefined,
    name: r.name,
    pointsRequired: r.points_required,
    rewardType: r.reward_type,
    isActive: r.is_active,
    expiryDate: r.expiry_date ?? undefined,
  };
}

function rowToTransaction(r: any): Transaction {
  return {
    id: r.id,
    customerId: r.customer_id,
    merchantId: r.merchant_id,
    merchantName: r.merchant_name,
    customerName: r.customer_name ?? undefined,
    amount: r.amount,
    pointsEarned: r.points_earned,
    multiplier: r.multiplier ?? 1,
    createdAt: r.created_at,
  };
}

function rowToRedemption(r: any): Redemption {
  return {
    id: r.id,
    customerId: r.customer_id,
    rewardId: r.reward_id,
    rewardName: r.reward_name,
    merchantName: r.merchant_name,
    merchantId: r.merchant_id ?? "",
    redeemedAt: r.redeemed_at,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [{ data: m }, { data: c }, { data: r }, { data: t }, { data: red }] = await Promise.all([
        supabase.from("merchants").select("*").order("created_at"),
        supabase.from("customers").select("*").order("created_at"),
        supabase.from("rewards").select("*").order("created_at"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("redemptions").select("*").order("redeemed_at", { ascending: false }),
      ]);
      if (m) setMerchants(m.map(rowToMerchant));
      if (c) setCustomers(c.map(rowToCustomer));
      if (r) setRewards(r.map(rowToReward));
      if (t) setTransactions(t.map(rowToTransaction));
      if (red) setRedemptions(red.map(rowToRedemption));
    } catch (e) {
      console.warn("Supabase loadData error:", e);
    }
  }

  async function addTransaction(t: Omit<Transaction, "id" | "createdAt">) {
    const newId = uid();
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("transactions").insert({
      id: newId,
      customer_id: t.customerId,
      merchant_id: t.merchantId,
      merchant_name: t.merchantName,
      customer_name: t.customerName ?? null,
      amount: t.amount,
      points_earned: t.pointsEarned,
      multiplier: t.multiplier ?? 1,
      created_at: createdAt,
    });
    if (error) { console.warn("addTransaction error:", error); return; }

    const newT: Transaction = { ...t, id: newId, createdAt, multiplier: t.multiplier ?? 1 };
    setTransactions((prev) => [newT, ...prev]);

    // Update customer total_points in DB + memory
    const custIdx = customers.findIndex((c) => c.id === t.customerId);
    if (custIdx !== -1) {
      const newPoints = customers[custIdx].totalPoints + t.pointsEarned;
      const newTier = getTier(newPoints);
      await supabase.from("customers").update({ total_points: newPoints, tier: newTier }).eq("id", t.customerId);
      setCustomers((prev) => prev.map((c) => c.id === t.customerId ? { ...c, totalPoints: newPoints, tier: newTier } : c));
    }
  }

  async function addReward(r: Omit<Reward, "id">) {
    const newId = uid();
    const { error } = await supabase.from("rewards").insert({
      id: newId,
      merchant_id: r.merchantId,
      merchant_name: r.merchantName ?? null,
      name: r.name,
      points_required: r.pointsRequired,
      reward_type: r.rewardType,
      is_active: r.isActive,
      expiry_date: r.expiryDate ?? null,
    });
    if (error) { console.warn("addReward error:", error); return; }
    setRewards((prev) => [...prev, { ...r, id: newId }]);
  }

  async function updateReward(id: string, r: Partial<Reward>) {
    const patch: any = {};
    if (r.name !== undefined) patch.name = r.name;
    if (r.merchantId !== undefined) patch.merchant_id = r.merchantId;
    if (r.merchantName !== undefined) patch.merchant_name = r.merchantName;
    if (r.pointsRequired !== undefined) patch.points_required = r.pointsRequired;
    if (r.rewardType !== undefined) patch.reward_type = r.rewardType;
    if (r.isActive !== undefined) patch.is_active = r.isActive;
    if (r.expiryDate !== undefined) patch.expiry_date = r.expiryDate;
    const { error } = await supabase.from("rewards").update(patch).eq("id", id);
    if (error) { console.warn("updateReward error:", error); return; }
    setRewards((prev) => prev.map((rw) => rw.id === id ? { ...rw, ...r } : rw));
  }

  async function deleteReward(id: string) {
    const { error } = await supabase.from("rewards").delete().eq("id", id);
    if (error) { console.warn("deleteReward error:", error); return; }
    setRewards((prev) => prev.filter((r) => r.id !== id));
  }

  async function addRedemption(r: Omit<Redemption, "id" | "redeemedAt">) {
    const newId = uid();
    const redeemedAt = new Date().toISOString();
    const { error } = await supabase.from("redemptions").insert({
      id: newId,
      customer_id: r.customerId,
      reward_id: r.rewardId,
      reward_name: r.rewardName,
      merchant_name: r.merchantName,
      merchant_id: r.merchantId || null,
      redeemed_at: redeemedAt,
    });
    if (error) { console.warn("addRedemption error:", error); return; }

    const newR: Redemption = { ...r, id: newId, redeemedAt, merchantId: r.merchantId || "" };
    setRedemptions((prev) => [newR, ...prev]);

    // Deduct points from customer
    const reward = rewards.find((rw) => rw.id === r.rewardId);
    if (reward) {
      const custIdx = customers.findIndex((c) => c.id === r.customerId);
      if (custIdx !== -1) {
        const newPoints = Math.max(0, customers[custIdx].totalPoints - reward.pointsRequired);
        const newTier = getTier(newPoints);
        await supabase.from("customers").update({ total_points: newPoints, tier: newTier }).eq("id", r.customerId);
        setCustomers((prev) => prev.map((c) => c.id === r.customerId ? { ...c, totalPoints: newPoints, tier: newTier } : c));
      }
    }
  }

  async function adjustCustomerPoints(customerId: string, delta: number) {
    const custIdx = customers.findIndex((c) => c.id === customerId);
    if (custIdx === -1) return;
    const newPoints = Math.max(0, customers[custIdx].totalPoints + delta);
    const newTier = getTier(newPoints);
    await supabase.from("customers").update({ total_points: newPoints, tier: newTier }).eq("id", customerId);
    setCustomers((prev) => prev.map((c) => c.id === customerId ? { ...c, totalPoints: newPoints, tier: newTier } : c));
  }

  function getCustomerTransactions(customerId: string) {
    return transactions.filter((t) => t.customerId === customerId);
  }

  function getMerchantTransactions(merchantId: string) {
    return transactions.filter((t) => t.merchantId === merchantId);
  }

  function getMerchantRewards(merchantId: string) {
    return rewards.filter((r) => r.merchantId === merchantId);
  }

  function getPointsAtMerchant(customerId: string, merchantId: string): number {
    const earned = transactions
      .filter((t) => t.customerId === customerId && t.merchantId === merchantId)
      .reduce((sum, t) => sum + t.pointsEarned, 0);
    const redeemed = redemptions
      .filter((r) => r.customerId === customerId)
      .reduce((sum, r) => {
        const rw = rewards.find((rw) => rw.id === r.rewardId);
        return sum + (rw?.merchantId === merchantId ? rw.pointsRequired : 0);
      }, 0);
    return Math.max(0, earned - redeemed);
  }

  function getMerchantStats(merchantId: string) {
    const txs = transactions.filter((t) => t.merchantId === merchantId && t.pointsEarned > 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const activeCustomers = new Set(txs.map((t) => t.customerId)).size;
    const pointsThisMonth = txs
      .filter((t) => t.createdAt >= monthStart)
      .reduce((sum, t) => sum + t.pointsEarned, 0);
    return { activeCustomers, pointsThisMonth };
  }

  function getCustomerRewards(customerId: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return [];
    return rewards
      .filter((r) => r.isActive)
      .map((r) => {
        const merchant = merchants.find((m) => m.id === r.merchantId);
        if (!merchant) return null;
        const customerPoints = getPointsAtMerchant(customerId, merchant.id);
        return { reward: r, merchant, customerPoints };
      })
      .filter(Boolean) as { reward: Reward; merchant: MerchantData; customerPoints: number }[];
  }

  function getCustomerRedemptions(customerId: string) {
    return redemptions.filter((r) => r.customerId === customerId);
  }

  function getCustomerProgressPerMerchant(customerId: string): MerchantProgressItem[] {
    const custTxs = transactions.filter((t) => t.customerId === customerId);
    const pointsByMerchant: Record<string, number> = {};
    for (const t of custTxs) {
      pointsByMerchant[t.merchantId] = (pointsByMerchant[t.merchantId] ?? 0) + t.pointsEarned;
    }
    const result: MerchantProgressItem[] = [];
    for (const [merchantId, customerPoints] of Object.entries(pointsByMerchant)) {
      if (customerPoints <= 0) continue;
      const merchant = merchants.find((m) => m.id === merchantId);
      if (!merchant) continue;
      const merchantRewards = rewards
        .filter((r) => r.merchantId === merchantId && r.isActive)
        .sort((a, b) => a.pointsRequired - b.pointsRequired);
      if (merchantRewards.length === 0) continue;
      const nextReward = merchantRewards.find((r) => customerPoints < r.pointsRequired);
      if (!nextReward) continue;
      const progressPercent = Math.min(100, (customerPoints / nextReward.pointsRequired) * 100);
      if (progressPercent < 80) continue;
      result.push({
        merchantId,
        merchantName: merchant.businessName,
        merchantCategory: merchant.category,
        customerPoints,
        nextRewardThreshold: nextReward.pointsRequired,
        nextRewardName: nextReward.name,
        progressPercent,
      });
    }
    return result.sort((a, b) => b.progressPercent - a.progressPercent);
  }

  async function registerMerchant(
    m: Omit<MerchantData, "id" | "totalCustomers" | "pointsThisMonth" | "rewardsRedeemed" | "qrCode">
  ): Promise<MerchantData> {
    const newM: MerchantData = {
      ...m,
      id: uid(),
      totalCustomers: 0,
      pointsThisMonth: 0,
      rewardsRedeemed: 0,
      qrCode: generateQrCode("FID-MERCH"),
    };
    const { error } = await supabase.from("merchants").insert({
      id: newM.id,
      user_id: newM.userId,
      business_name: newM.businessName,
      category: newM.category,
      logo_url: newM.logoUrl ?? null,
      points_rate: newM.pointsRate,
      total_customers: 0,
      points_this_month: 0,
      rewards_redeemed: 0,
      qr_code: newM.qrCode,
    });
    if (error) throw error;
    setMerchants((prev) => [...prev, newM]);
    return newM;
  }

  async function registerCustomer(
    c: Omit<CustomerData, "id" | "tier" | "qrCode">
  ): Promise<CustomerData> {
    const newC: CustomerData = {
      ...c,
      id: uid(),
      tier: getTier(c.totalPoints),
      qrCode: generateQrCode("FID-CUST"),
    };
    const { error } = await supabase.from("customers").insert({
      id: newC.id,
      user_id: newC.userId,
      first_name: newC.firstName,
      last_name: newC.lastName,
      phone: newC.phone ?? null,
      email: newC.email ?? null,
      total_points: newC.totalPoints,
      tier: newC.tier,
      qr_code: newC.qrCode,
    });
    if (error) throw error;
    setCustomers((prev) => [...prev, newC]);
    return newC;
  }

  function getMerchantById(id: string) {
    return merchants.find((m) => m.id === id);
  }

  function getCustomerByUserId(userId: string) {
    return customers.find((c) => c.userId === userId);
  }

  function getMerchantByUserId(userId: string) {
    return merchants.find((m) => m.userId === userId);
  }

  function getCustomerByQrCode(qrCode: string) {
    return customers.find((c) => c.qrCode === qrCode);
  }

  async function updateMerchant(id: string, data: Partial<MerchantData>) {
    const patch: any = {};
    if (data.businessName !== undefined) patch.business_name = data.businessName;
    if (data.category !== undefined) patch.category = data.category;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
    if (data.pointsRate !== undefined) patch.points_rate = data.pointsRate;
    if (data.totalCustomers !== undefined) patch.total_customers = data.totalCustomers;
    if (data.pointsThisMonth !== undefined) patch.points_this_month = data.pointsThisMonth;
    if (data.rewardsRedeemed !== undefined) patch.rewards_redeemed = data.rewardsRedeemed;
    if (data.qrCode !== undefined) patch.qr_code = data.qrCode;
    const { error } = await supabase.from("merchants").update(patch).eq("id", id);
    if (error) { console.warn("updateMerchant error:", error); return; }
    setMerchants((prev) => prev.map((m) => m.id === id ? { ...m, ...data } : m));
  }

  async function updateCustomerProfile(userId: string, data: Partial<CustomerData>) {
    const patch: any = {};
    if (data.firstName !== undefined) patch.first_name = data.firstName;
    if (data.lastName !== undefined) patch.last_name = data.lastName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.email !== undefined) patch.email = data.email;
    if (data.totalPoints !== undefined) patch.total_points = data.totalPoints;
    if (data.tier !== undefined) patch.tier = data.tier;
    const { error } = await supabase.from("customers").update(patch).eq("user_id", userId);
    if (error) { console.warn("updateCustomerProfile error:", error); return; }
    setCustomers((prev) => prev.map((c) => c.userId === userId ? { ...c, ...data } : c));
  }

  return (
    <DataContext.Provider
      value={{
        transactions,
        rewards,
        redemptions,
        merchants,
        customers,
        addTransaction,
        addReward,
        updateReward,
        deleteReward,
        addRedemption,
        adjustCustomerPoints,
        getCustomerTransactions,
        getMerchantTransactions,
        getMerchantRewards,
        getCustomerRewards,
        getPointsAtMerchant,
        getMerchantStats,
        getCustomerRedemptions,
        getCustomerProgressPerMerchant,
        registerMerchant,
        registerCustomer,
        getMerchantById,
        getCustomerByUserId,
        getMerchantByUserId,
        getCustomerByQrCode,
        updateMerchant,
        updateCustomerProfile,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
