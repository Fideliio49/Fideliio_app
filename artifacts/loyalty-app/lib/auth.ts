import { supabase } from './supabase';
import { nanoid } from 'nanoid/non-secure';

function generateQrCode(prefix: string): string {
  return `${prefix}-${nanoid(8).toUpperCase()}`;
}

// ─── REGISTER WITH EMAIL (sends OTP — no password) ───────────────────────────
export const registerWithEmail = async (
  email: string,
  userData: {
    firstName: string;
    lastName: string;
    phone?: string;
    businessName?: string;
    category?: string;
    pointsRate?: number;
  },
  userType: 'customer' | 'merchant'
) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        role: userType,
        firstName: userData.firstName,
        lastName: userData.lastName,
        businessName: userData.businessName ?? null,
        businessCategory: userData.category ?? null,
        pointsRate: userData.pointsRate ?? 1,
      },
    },
  });
  if (error) throw error;
  // OTP sent to email — caller must show OTP input and call verifyEmailOTP
};

// ─── VERIFY EMAIL OTP ─────────────────────────────────────────────────────────
export const verifyEmailOTP = async (
  email: string,
  token: string,
  userData: any,
  userType: 'customer' | 'merchant'
) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;

  const userId = data.user!.id;
  const table = userType === 'customer' ? 'customers' : 'merchants';

  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!existing) {
    await createProfile(userId, userData, userType);
  }

  return data;
};

// ─── SEND PHONE OTP ───────────────────────────────────────────────────────────
export const sendPhoneOTP = async (phone: string) => {
  const formatted = phone.startsWith('+') ? phone : `+${phone}`;
  const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
  if (error) throw error;
};

// ─── VERIFY PHONE OTP ─────────────────────────────────────────────────────────
export const verifyPhoneOTP = async (
  phone: string,
  token: string,
  userData: {
    firstName?: string;
    lastName?: string;
    businessName?: string;
    category?: string;
    pointsRate?: number;
  },
  userType: 'customer' | 'merchant'
) => {
  const formatted = phone.startsWith('+') ? phone : `+${phone}`;

  const { data, error } = await supabase.auth.verifyOtp({
    phone: formatted,
    token,
    type: 'sms',
  });
  if (error) throw error;

  const userId = data.user!.id;
  const table = userType === 'customer' ? 'customers' : 'merchants';

  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!existing) {
    if (!userData.firstName) {
      await supabase.auth.signOut();
      throw new Error('Aucun compte trouvé. Veuillez vous inscrire d\'abord.');
    }
    await createProfile(userId, userData, userType);
    await supabase.auth.updateUser({
      data: {
        role: userType,
        firstName: userData.firstName,
        lastName: userData.lastName,
        businessName: userData.businessName ?? null,
        businessCategory: userData.category ?? null,
        pointsRate: userData.pointsRate ?? 1,
      },
    });
  }

  return data;
};

// ─── CREATE PROFILE IN DB ─────────────────────────────────────────────────────
const createProfile = async (
  userId: string,
  userData: any,
  userType: 'customer' | 'merchant'
) => {
  if (userType === 'customer') {
    const { error } = await supabase.from('customers').insert({
      id: nanoid(),
      user_id: userId,
      first_name: userData.firstName,
      last_name: userData.lastName,
      phone: userData.phone ?? null,
      email: userData.email ?? null,
      tier: 'bronze',
      qr_code: generateQrCode('FID-CUST'),
    });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('merchants').insert({
      id: nanoid(),
      user_id: userId,
      business_name: userData.businessName,
      category: userData.category ?? 'other',
      logo_url: null,
      points_rate: userData.pointsRate ?? 1,
      total_customers: 0,
      points_this_month: 0,
      rewards_redeemed: 0,
      qr_code: generateQrCode('FID-MERCH'),
    });
    if (error) throw error;
  }
};

// ─── LOGIN WITH EMAIL ─────────────────────────────────────────────────────────
export const loginWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

// ─── LOGIN WITH PHONE (alias for sendPhoneOTP) ────────────────────────────────
export const loginWithPhone = sendPhoneOTP;

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'fideliio://reset-password',
  });
  if (error) throw error;
};

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────────
export const deleteAccount = async (userType: 'customer' | 'merchant') => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const table = userType === 'customer' ? 'customers' : 'merchants';
  await supabase.from(table).delete().eq('user_id', user.id);
  await supabase.auth.signOut();
};
