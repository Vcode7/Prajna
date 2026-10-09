import { create } from 'zustand';
import { api } from '../api/client';

// Purge any legacy dummy demo accounts from localStorage
const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('prajna_auth_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    // Discard any dummy demo accounts
    if (
      !user ||
      ['usr_cdo_01', 'usr_ds_02', 'usr_an_03'].includes(user.id) ||
      ['elena.vance@enterprise-corp.com', 'marcus.chen@prajna.ai', 'sarah.j@supplychain-global.io'].includes(user.email)
    ) {
      localStorage.removeItem('prajna_auth_user');
      localStorage.removeItem('prajna_auth_token');
      return null;
    }
    return user;
  } catch {
    return null;
  }
};

const getStoredToken = () => {
  try {
    return localStorage.getItem('prajna_auth_token') || null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredUser(),
  isLoading: false,
  error: null,

  // Auth Modal State (Allows signing in directly from landing page or anywhere in UI)
  isAuthModalOpen: false,
  authModalMode: 'login', // 'login' | 'signup'

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode, error: null }),
  closeAuthModal: () => set({ isAuthModalOpen: false, error: null }),
  setAuthModalMode: (mode) => set({ authModalMode: mode, error: null }),

  // Email / Username & Password Login via backend API
  login: async (usernameOrEmail, password) => {
    set({ isLoading: true, error: null });
    try {
      if (!usernameOrEmail || !password) {
        throw new Error('Please enter both username/email and password.');
      }

      const res = await api.login(usernameOrEmail.trim(), password);
      const user = res.user;
      const token = res.token;

      localStorage.setItem('prajna_auth_user', JSON.stringify(user));
      localStorage.setItem('prajna_auth_token', token);

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        error: null,
      });

      return user;
    } catch (err) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // Account Registration via backend API
  signup: async ({ name, username, email, password, company, role }) => {
    set({ isLoading: true, error: null });
    try {
      if (!email || !password) {
        throw new Error('Email and password are required.');
      }

      const res = await api.register({
        name: name ? name.trim() : undefined,
        username: username ? username.trim().toLowerCase() : undefined,
        email: email.trim().toLowerCase(),
        password,
        company: company ? company.trim() : undefined,
        role: role ? role.trim() : undefined,
      });

      const user = res.user;
      const token = res.token;

      localStorage.setItem('prajna_auth_user', JSON.stringify(user));
      localStorage.setItem('prajna_auth_token', token);

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
        error: null,
      });

      return user;
    } catch (err) {
      const msg = err.message || 'Registration failed. An account with this email may already exist.';
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  // Verify authentication with backend
  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }
    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true });
      localStorage.setItem('prajna_auth_user', JSON.stringify(user));
    } catch {
      get().logout();
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('prajna_auth_user');
    localStorage.removeItem('prajna_auth_token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isAuthModalOpen: false,
      error: null,
    });
  },
}));
