/**
 * Admin auth store. The login endpoint returns
 * `{ token, username, role, mustChangePassword, avatarUrl }` (8h JWT). The session is
 * persisted to localStorage and rehydrated on load; a 401 from any request
 * clears it and redirects to /admin/login (handled in api/client.ts).
 */
import { defineStore } from 'pinia';
import { http, loadSession, saveSession, clearSession, type StoredSession } from '@/api/client';

interface LoginResponse {
  token: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
  avatarUrl: string | null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null as StoredSession | null,
  }),
  getters: {
    isAuthenticated: (s) => !!s.session?.token,
    username: (s) => s.session?.username ?? '',
    role: (s) => s.session?.role ?? '',
    mustChangePassword: (s) => !!s.session?.mustChangePassword,
    avatarUrl: (s) => s.session?.avatarUrl ?? null,
  },
  actions: {
    restore() {
      this.session = loadSession();
    },
    async login(username: string, password: string): Promise<LoginResponse> {
      const { data } = await http.post<LoginResponse>('/auth/login', { username, password });
      this.session = {
        token: data.token,
        username: data.username,
        role: data.role,
        mustChangePassword: data.mustChangePassword,
        avatarUrl: data.avatarUrl,
      };
      saveSession(this.session);
      return data;
    },
    async changePassword(oldPassword: string, newPassword: string): Promise<void> {
      await http.post('/auth/change-password', { oldPassword, newPassword });
      if (this.session) {
        this.session.mustChangePassword = false;
        saveSession(this.session);
      }
    },
    replaceSession(session: Pick<StoredSession, 'token' | 'username' | 'role' | 'avatarUrl'>) {
      const current = this.session ?? loadSession();
      this.session = {
        ...session,
        mustChangePassword: current?.mustChangePassword ?? false,
      };
      saveSession(this.session);
    },
    setAvatar(avatarUrl: string | null) {
      if (!this.session) return;
      this.session.avatarUrl = avatarUrl;
      saveSession(this.session);
    },
    async logout() {
      try {
        await http.post('/auth/logout');
      } catch {
        // A stale session still needs to be removed from this browser.
      }
      this.session = null;
      clearSession();
    },
  },
});
