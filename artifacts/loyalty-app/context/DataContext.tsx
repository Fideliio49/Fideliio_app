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
  getCustomerRewards: (customerId: string) => { reward: Reward; merchant: MerchantData }[];
  getCustomerRedemptions: (customerId: string) => Redemption[];
  registerMerchant: (m: Omit<MerchantData, "id" | "totalCustomers" | "pointsThisMonth" | "rewardsRedeemed">) => Promise<MerchantData>;
  registerCustomer: (c: Omit<CustomerData, "id" | "tier">) => Promise<CustomerData>;
  getMerchantById: (id: string) => MerchantData | undefined;
  getCustomerByUserId: (userId: string) => CustomerData | undefined;
  getMerchantByUserId: (userId: string) => MerchantData | undefined;
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

const DEMO_MERCHANTS: MerchantData[] = [
  { id: "m1", userId: "u_m1", businessName: "Café Atlas", category: "restaurant", pointsRate: 1, totalCustomers: 42, pointsThisMonth: 3200, rewardsRedeemed: 8 },
  { id: "m2", userId: "u_m2", businessName: "Boutique Lina", category: "clothing", pointsRate: 2, totalCustomers: 28, pointsThisMonth: 1800, rewardsRedeemed: 5 },
  { id: "m3", userId: "u_m3", businessName: "Salon Zara", category: "hairSalon", pointsRate: 1, totalCustomers: 35, pointsThisMonth: 2400, rewardsRedeemed: 12 },
  { id: "m4", userId: "u_m4", businessName: "Hôtel Riad", category: "hotel", pointsRate: 3, totalCustomers: 15, pointsThisMonth: 5000, rewardsRedeemed: 3 },
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
      if (m) setMerchants(JSON.parse(m));
      if (c) setCustomers(JSON.parse(c));
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

  function getCustomerRewards(customerId: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return [];
    return rewards
      .filter((r) => r.isActive)
      .map((r) => {
        const merchant = merchants.find((m) => m.id === r.merchantId);
        return merchant ? { reward: r, merchant } : null;
      })
      .filter(Boolean) as { reward: Reward; merchant: MerchantData }[];
  }

  function getCustomerRedemptions(customerId: string) {
    return redemptions.filter((r) => r.customerId === customerId);
  }

  async function registerMerchant(m: Omit<MerchantData, "id" | "totalCustomers" | "pointsThisMonth" | "rewardsRedeemed">): Promise<MerchantData> {
    const newM: MerchantData = {
      ...m,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      totalCustomers: 0,
      pointsThisMonth: 0,
      rewardsRedeemed: 0,
    };
    const updated = [...merchants, newM];
    setMerchants(updated);
    await persist(KEYS.MERCHANTS, updated);
    return newM;
  }

  async function registerCustomer(c: Omit<CustomerData, "id" | "tier">): Promise<CustomerData> {
    const newC: CustomerData = {
      ...c,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      tier: getTier(c.totalPoints),
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
        getCustomerRedemptions,
        registerMerchant,
        registerCustomer,
        getMerchantById,
        getCustomerByUserId,
        getMerchantByUserId,
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
