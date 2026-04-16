import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Transaction {
  id: string;
  customerId: string;
  merchantId: string;
  merchantName: string;
  customerName?: string;
  amount: number;
  pointsEarned: number;
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

const KEYS = {
  TRANSACTIONS: "@loyalty_transactions",
  REWARDS: "@loyalty_rewards",
  REDEMPTIONS: "@loyalty_redemptions",
  MERCHANTS: "@loyalty_merchants",
  CUSTOMERS: "@loyalty_customers",
};

function getTier(points: number): "bronze" | "silver" | "gold" {
  if (points >= 5000) return "gold";
  if (points >= 1000) return "silver";
  return "bronze";
}

function generateQrCode(prefix: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
}

const DEMO_MERCHANTS: MerchantData[] = [
  { id: "m1", userId: "u_m1", businessName: "Café Atlas", category: "restaurant", pointsRate: 1, totalCustomers: 42, pointsThisMonth: 3200, rewardsRedeemed: 8, qrCode: "FID-MERCH-CAFATLAS" },
  { id: "m2", userId: "u_m2", businessName: "Boutique Lina", category: "clothing", pointsRate: 2, totalCustomers: 28, pointsThisMonth: 1800, rewardsRedeemed: 5, qrCode: "FID-MERCH-BOUTLINA" },
  { id: "m3", userId: "u_m3", businessName: "Salon Zara", category: "hairSalon", pointsRate: 1, totalCustomers: 35, pointsThisMonth: 2400, rewardsRedeemed: 12, qrCode: "FID-MERCH-SALNZARA" },
  { id: "m4", userId: "u_m4", businessName: "Hôtel Riad", category: "hotel", pointsRate: 3, totalCustomers: 15, pointsThisMonth: 5000, rewardsRedeemed: 3, qrCode: "FID-MERCH-HOTELRIAD" },
];

const DEMO_REWARDS: Reward[] = [
  { id: "r1", merchantId: "m1", merchantName: "Café Atlas", name: "Café gratuit", pointsRequired: 200, rewardType: "freeProduct", isActive: true },
  { id: "r2", merchantId: "m1", merchantName: "Café Atlas", name: "10% de réduction", pointsRequired: 500, rewardType: "discount", isActive: true },
  { id: "r3", merchantId: "m2", merchantName: "Boutique Lina", name: "20% sur tout", pointsRequired: 1000, rewardType: "discount", isActive: true },
  { id: "r4", merchantId: "m3", merchantName: "Salon Zara", name: "Coupe gratuite", pointsRequired: 800, rewardType: "freeService", isActive: true },
  { id: "r5", merchantId: "m4", merchantName: "Hôtel Riad", name: "Nuit offerte", pointsRequired: 3000, rewardType: "freeService", isActive: true },
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>(DEMO_REWARDS);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [merchants, setMerchants] = useState<MerchantData[]>(DEMO_MERCHANTS);
  const [customers, setCustomers] = useState<CustomerData[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [t, r, red, m, c] = await Promise.all([
        AsyncStorage.getItem(KEYS.TRANSACTIONS),
        AsyncStorage.getItem(KEYS.REWARDS),
        AsyncStorage.getItem(KEYS.REDEMPTIONS),
        AsyncStorage.getItem(KEYS.MERCHANTS),
        AsyncStorage.getItem(KEYS.CUSTOMERS),
      ]);
      if (t) setTransactions(JSON.parse(t));
      if (r) setRewards(JSON.parse(r));
      if (red) setRedemptions(JSON.parse(red));

      // Migrate merchants: ensure qrCode exists for all records
      if (m) {
        const parsed: MerchantData[] = JSON.parse(m);
        let changed = false;
        const migrated = parsed.map((item) => {
          if (!item.qrCode) {
            changed = true;
            return { ...item, qrCode: generateQrCode("FID-MERCH") };
          }
          return item;
        });
        setMerchants(migrated);
        if (changed) await persist(KEYS.MERCHANTS, migrated);
      }

      // Migrate customers: ensure qrCode exists for all records
      if (c) {
        const parsed: CustomerData[] = JSON.parse(c);
        let changed = false;
        const migrated = parsed.map((item) => {
          if (!item.qrCode) {
            changed = true;
            return { ...item, qrCode: generateQrCode("FID-CUST") };
          }
          return item;
        });
        setCustomers(migrated);
        if (changed) await persist(KEYS.CUSTOMERS, migrated);
      }
    } catch {}
  }

  async function persist<T>(key: string, data: T) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  async function addTransaction(t: Omit<Transaction, "id" | "createdAt">) {
    const newT: Transaction = {
      ...t,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      createdAt: new Date().toISOString(),
    };
    const updated = [newT, ...transactions];
    setTransactions(updated);
    await persist(KEYS.TRANSACTIONS, updated);

    const custIdx = customers.findIndex((c) => c.id === t.customerId);
    if (custIdx !== -1) {
      const updated2 = [...customers];
      const newPoints = updated2[custIdx].totalPoints + t.pointsEarned;
      updated2[custIdx] = { ...updated2[custIdx], totalPoints: newPoints, tier: getTier(newPoints) };
      setCustomers(updated2);
      await persist(KEYS.CUSTOMERS, updated2);
    }

    const merIdx = merchants.findIndex((m) => m.id === t.merchantId);
    if (merIdx !== -1) {
      const updated3 = [...merchants];
      updated3[merIdx] = {
        ...updated3[merIdx],
        pointsThisMonth: updated3[merIdx].pointsThisMonth + t.pointsEarned,
      };
      setMerchants(updated3);
      await persist(KEYS.MERCHANTS, updated3);
    }
  }

  async function addReward(r: Omit<Reward, "id">) {
    const newR: Reward = { ...r, id: Date.now().toString() + Math.random().toString(36).substr(2, 6) };
    const updated = [...rewards, newR];
    setRewards(updated);
    await persist(KEYS.REWARDS, updated);
  }

  async function updateReward(id: string, r: Partial<Reward>) {
    const updated = rewards.map((rw) => (rw.id === id ? { ...rw, ...r } : rw));
    setRewards(updated);
    await persist(KEYS.REWARDS, updated);
  }

  async function deleteReward(id: string) {
    const updated = rewards.filter((r) => r.id !== id);
    setRewards(updated);
    await persist(KEYS.REWARDS, updated);
  }

  async function addRedemption(r: Omit<Redemption, "id" | "redeemedAt">) {
    const newR: Redemption = {
      ...r,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      redeemedAt: new Date().toISOString(),
    };
    const updatedRed = [newR, ...redemptions];
    setRedemptions(updatedRed);
    await persist(KEYS.REDEMPTIONS, updatedRed);

    const reward = rewards.find((rw) => rw.id === r.rewardId);
    if (reward) {
      const custIdx = customers.findIndex((c) => c.id === r.customerId);
      if (custIdx !== -1) {
        const updated2 = [...customers];
        const newPoints = Math.max(0, updated2[custIdx].totalPoints - reward.pointsRequired);
        updated2[custIdx] = { ...updated2[custIdx], totalPoints: newPoints, tier: getTier(newPoints) };
        setCustomers(updated2);
        await persist(KEYS.CUSTOMERS, updated2);
      }
    }
  }

  async function adjustCustomerPoints(customerId: string, delta: number) {
    const custIdx = customers.findIndex((c) => c.id === customerId);
    if (custIdx === -1) return;
    const updated = [...customers];
    const newPoints = Math.max(0, updated[custIdx].totalPoints + delta);
    updated[custIdx] = { ...updated[custIdx], totalPoints: newPoints, tier: getTier(newPoints) };
    setCustomers(updated);
    await persist(KEYS.CUSTOMERS, updated);
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
        return sum + (rw?.merchantId === merchantId ? (rw.pointsRequired) : 0);
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
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      totalCustomers: 0,
      pointsThisMonth: 0,
      rewardsRedeemed: 0,
      qrCode: generateQrCode("FID-MERCH"),
    };
    const updated = [...merchants, newM];
    setMerchants(updated);
    await persist(KEYS.MERCHANTS, updated);
    return newM;
  }

  async function registerCustomer(
    c: Omit<CustomerData, "id" | "tier" | "qrCode">
  ): Promise<CustomerData> {
    const newC: CustomerData = {
      ...c,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      tier: getTier(c.totalPoints),
      qrCode: generateQrCode("FID-CUST"),
    };
    const updated = [...customers, newC];
    setCustomers(updated);
    await persist(KEYS.CUSTOMERS, updated);
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
    const updated = merchants.map((m) => (m.id === id ? { ...m, ...data } : m));
    setMerchants(updated);
    await persist(KEYS.MERCHANTS, updated);
  }

  async function updateCustomerProfile(userId: string, data: Partial<CustomerData>) {
    const updated = customers.map((c) => (c.userId === userId ? { ...c, ...data } : c));
    setCustomers(updated);
    await persist(KEYS.CUSTOMERS, updated);
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
