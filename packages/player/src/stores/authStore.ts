import { LazyStore } from '@tauri-apps/plugin-store';
import { create } from 'zustand';

const AUTH_FILE = 'auth.json';
const store = new LazyStore(AUTH_FILE);

export type ServiceName = 'spotify' | 'youtube';

export type ServiceAuth = {
  clientId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp ms
};

type AuthStore = {
  spotify: ServiceAuth;
  youtube: ServiceAuth;
  isLoaded: boolean;

  loadFromDisk: () => Promise<void>;
  setClientId: (service: ServiceName, clientId: string) => Promise<void>;
  setTokens: (
    service: ServiceName,
    tokens: { accessToken: string; refreshToken?: string; expiresIn: number },
  ) => Promise<void>;
  clearTokens: (service: ServiceName) => Promise<void>;
  getValidToken: (service: ServiceName) => string | null;
};

const DEFAULT_AUTH: ServiceAuth = { clientId: '' };

const saveToDisk = async (state: AuthStore): Promise<void> => {
  await store.set('spotify', state.spotify);
  await store.set('youtube', state.youtube);
  await store.save();
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  spotify: DEFAULT_AUTH,
  youtube: DEFAULT_AUTH,
  isLoaded: false,

  loadFromDisk: async () => {
    try {
      const spotify = (await store.get<ServiceAuth>('spotify')) ?? DEFAULT_AUTH;
      const youtube = (await store.get<ServiceAuth>('youtube')) ?? DEFAULT_AUTH;
      set({ spotify, youtube, isLoaded: true });
    } catch (error) {
      console.warn('Failed to load auth store, using defaults', error);
      set({ spotify: DEFAULT_AUTH, youtube: DEFAULT_AUTH, isLoaded: true });
    }
  },

  setClientId: async (service, clientId) => {
    set((state) => ({
      [service]: { ...state[service], clientId },
    }));
    await saveToDisk(get());
  },

  setTokens: async (service, { accessToken, refreshToken, expiresIn }) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    set((state) => ({
      [service]: {
        ...state[service],
        accessToken,
        refreshToken: refreshToken ?? state[service].refreshToken,
        expiresAt,
      },
    }));
    await saveToDisk(get());
  },

  clearTokens: async (service) => {
    set((state) => ({
      [service]: { clientId: state[service].clientId },
    }));
    await saveToDisk(get());
  },

  getValidToken: (service) => {
    const auth = get()[service];
    if (!auth.accessToken) {
      return null;
    }
    if (auth.expiresAt && Date.now() > auth.expiresAt - 60_000) {
      return null;
    }
    return auth.accessToken;
  },
}));

export const initializeAuthStore = async (): Promise<void> => {
  await useAuthStore.getState().loadFromDisk();
};
