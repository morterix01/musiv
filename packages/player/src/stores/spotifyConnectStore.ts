import { create } from 'zustand';

export type SpotifyConnectTrack = {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string | null;
  durationMs: number;
};

type SpotifyConnectStore = {
  deviceId: string | null;
  isActive: boolean;
  currentTrack: SpotifyConnectTrack | null;
  isPlaying: boolean;
  positionMs: number;

  setDeviceId: (deviceId: string) => void;
  setIsActive: (isActive: boolean) => void;
  setCurrentTrack: (track: SpotifyConnectTrack | null) => void;
  setPlaybackState: (state: { isPlaying: boolean; positionMs: number }) => void;
  reset: () => void;
};

export const useSpotifyConnectStore = create<SpotifyConnectStore>((set) => ({
  deviceId: null,
  isActive: false,
  currentTrack: null,
  isPlaying: false,
  positionMs: 0,

  setDeviceId: (deviceId) => set({ deviceId }),
  setIsActive: (isActive) => set({ isActive }),
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
  setPlaybackState: ({ isPlaying, positionMs }) =>
    set({ isPlaying, positionMs }),
  reset: () =>
    set({
      deviceId: null,
      isActive: false,
      currentTrack: null,
      isPlaying: false,
      positionMs: 0,
    }),
}));
