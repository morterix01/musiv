import { useSpotifyConnectStore } from '../stores/spotifyConnectStore';
import { spotifyService } from './spotifyService';

type SpotifyWebPlaybackState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: {
        name: string;
        images: { url: string; width: number; height: number }[];
      };
    } | null;
  };
};

type SpotifyWebPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyWebPlaybackState | null>;
  addListener: (event: string, callback: (data: unknown) => void) => boolean;
  removeListener: (event: string) => boolean;
};

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyWebPlayer;
    };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const PLAYER_NAME = 'Nuclear';

let player: SpotifyWebPlayer | null = null;

const loadSdkScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.getElementById('spotify-sdk')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'spotify-sdk';
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Spotify SDK'));
    document.head.appendChild(script);
  });

const waitForSdk = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = resolve;
  });

const syncState = (state: SpotifyWebPlaybackState | null) => {
  const store = useSpotifyConnectStore.getState();

  if (!state || !state.track_window.current_track) {
    store.setIsActive(false);
    store.setCurrentTrack(null);
    return;
  }

  const track = state.track_window.current_track;
  store.setIsActive(true);
  store.setCurrentTrack({
    id: track.id,
    name: track.name,
    artist: track.artists.map((artist) => artist.name).join(', '),
    artworkUrl: track.album.images[0]?.url ?? null,
    durationMs: state.duration,
  });
  store.setPlaybackState({
    isPlaying: !state.paused,
    positionMs: state.position,
  });
};

export const spotifyConnectService = {
  init: async (): Promise<void> => {
    if (player) {
      return;
    }
    try {
      await spotifyService.getToken();
    } catch {
      return;
    }

    await loadSdkScript();
    await waitForSdk();

    player = new window.Spotify.Player({
      name: PLAYER_NAME,
      getOAuthToken: (cb) => {
        spotifyService
          .getToken()
          .then(cb)
          .catch(() => {});
      },
      volume: 0.8,
    });

    player.addListener('ready', (data) => {
      const { device_id } = data as { device_id: string };
      useSpotifyConnectStore.getState().setDeviceId(device_id);
    });

    player.addListener('not_ready', () => {
      useSpotifyConnectStore.getState().reset();
    });

    player.addListener('player_state_changed', (data) => {
      syncState(data as SpotifyWebPlaybackState | null);
    });

    await player.connect();
  },

  disconnect: () => {
    player?.disconnect();
    player = null;
    useSpotifyConnectStore.getState().reset();
  },

  togglePlay: async (): Promise<void> => {
    await player?.togglePlay();
  },

  nextTrack: async (): Promise<void> => {
    await player?.nextTrack();
  },

  previousTrack: async (): Promise<void> => {
    await player?.previousTrack();
  },

  seek: async (positionMs: number): Promise<void> => {
    await player?.seek(positionMs);
  },

  setVolume: async (volume01: number): Promise<void> => {
    await player?.setVolume(volume01);
  },
};
