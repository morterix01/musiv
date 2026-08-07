/**
 * YouTube OAuth2 Service
 *
 * Uses Google's OAuth2 Authorization Code + PKCE flow for installed (desktop)
 * apps. Google does not allow custom URI schemes for desktop clients, so the
 * redirect target is a loopback address (http://127.0.0.1:<port>) served by a
 * single-shot local server in the Tauri backend (see src-tauri/src/oauth.rs).
 * Loopback ports do not need to be pre-registered for Desktop OAuth clients.
 *
 * Required Google Cloud Console setup:
 *   - OAuth client of type "Desktop app" (provides Client ID + Client Secret;
 *     the secret is not confidential for installed apps and may be shipped)
 *   - YouTube Data API v3 enabled
 *   - OAuth consent screen: add your account as a Test user (youtube.readonly
 *     is a sensitive scope) or publish the app
 *   - Scopes: https://www.googleapis.com/auth/youtube.readonly
 */
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';

import type { Playlist, PlaylistItem, Track } from '@nuclearplayer/model';

import { useAuthStore } from '../stores/authStore';
import { Logger } from './logger';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const LOOPBACK_HOST = '127.0.0.1';
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';
// Default app credentials for one-click login. Create an OAuth client of type
// "Desktop app" in the Google Cloud Console (YouTube Data API v3). The Client ID
// is public and shipped in the binary; the Client Secret is injected at build
// time from the VITE_YOUTUBE_CLIENT_SECRET env var (a CI secret) to keep it out
// of source control. A user-entered Client ID always takes priority.
const DEFAULT_CLIENT_ID =
  '1031730045947-dudi31eemuesitq693s49gl9draneqq1.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ?? '';

// --- PKCE helpers (same pattern as Spotify) ---

const generateCodeVerifier = (): string => {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

let _codeVerifier: string | null = null;
let _redirectUri: string | null = null;

const resolveClientId = (): string => {
  const clientId =
    useAuthStore.getState().youtube.clientId || DEFAULT_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'No YouTube Client ID configured. Add one in the Accounts page, or set a default in youtubeService.',
    );
  }
  return clientId;
};

const resolveClientSecret = (): string => DEFAULT_CLIENT_SECRET;

// --- Public API ---

export const youtubeService = {
  /** Whether a Client ID is available, from settings or the shipped default. */
  hasClientId: (): boolean =>
    Boolean(useAuthStore.getState().youtube.clientId || DEFAULT_CLIENT_ID),

  /**
   * Run the full Google login: open the consent page in the system browser,
   * capture the authorization code via the loopback server, and exchange it for
   * tokens. Resolves once the account is connected.
   */
  startLogin: async (): Promise<void> => {
    try {
      const clientId = resolveClientId();

      const port = await invoke<number>('oauth_loopback_start');
      _redirectUri = `http://${LOOPBACK_HOST}:${port}`;

      _codeVerifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(_codeVerifier);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: _redirectUri,
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        code_challenge_method: 'S256',
        code_challenge: challenge,
      });

      await openUrl(`${GOOGLE_AUTH_URL}?${params.toString()}`);

      const code = await invoke<string>('oauth_loopback_wait');
      await youtubeService.handleCallback(code);
      toast.success('YouTube connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.app.error(`Failed to complete YouTube login: ${message}`);
      toast.error(`YouTube login failed: ${message}`);
    }
  },

  /** Exchange the authorization code from the loopback callback for tokens. */
  handleCallback: async (code: string): Promise<void> => {
    if (!_codeVerifier || !_redirectUri) {
      throw new Error('No code verifier. Call startLogin first.');
    }
    const clientId = resolveClientId();
    const clientSecret = resolveClientSecret();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: _redirectUri,
      client_id: clientId,
      code_verifier: _codeVerifier,
    });
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`YouTube token exchange failed: ${res.status}`);
    }

    const data = await res.json();
    await useAuthStore.getState().setTokens('youtube', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });

    _codeVerifier = null;
  },

  /** Refresh an expired token. */
  refreshToken: async (): Promise<void> => {
    const { refreshToken } = useAuthStore.getState().youtube;
    if (!refreshToken) {
      throw new Error('No refresh token for YouTube');
    }
    const clientId = resolveClientId();
    const clientSecret = resolveClientSecret();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`YouTube token refresh failed: ${res.status}`);
    }

    const data = await res.json();
    await useAuthStore.getState().setTokens('youtube', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
    });
  },

  /** Get a valid access token, refreshing if expired. */
  getToken: async (): Promise<string> => {
    let token = useAuthStore.getState().getValidToken('youtube');
    if (!token) {
      await youtubeService.refreshToken();
      token = useAuthStore.getState().getValidToken('youtube');
    }
    if (!token) {
      throw new Error('Unable to obtain YouTube access token');
    }
    return token;
  },

  /** Internal authenticated fetch helper. */
  _fetch: async (
    path: string,
    params: Record<string, string> = {},
  ): Promise<unknown> => {
    const token = await youtubeService.getToken();
    const qs = new URLSearchParams({ ...params, access_token: token });
    const res = await fetch(`${YT_API_BASE}${path}?${qs.toString()}`);
    if (!res.ok) {
      throw new Error(`YouTube API error ${res.status}: ${path}`);
    }
    return res.json();
  },

  /** Fetch all user playlists (handles pagination). */
  getPlaylists: async (): Promise<YtPlaylistSummary[]> => {
    const results: YtPlaylistSummary[] = [];
    let pageToken: string | undefined;

    do {
      const page = (await youtubeService._fetch('/playlists', {
        part: 'snippet,contentDetails',
        mine: 'true',
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      })) as YtPlaylistPage;

      results.push(...page.items);
      pageToken = page.nextPageToken;
    } while (pageToken);

    return results;
  },

  /** Fetch all videos in a playlist, mapped to Nuclear's Track type. */
  getPlaylistTracks: async (playlistId: string): Promise<Track[]> => {
    const videoIds: string[] = [];
    let pageToken: string | undefined;

    // Step 1: collect video IDs
    do {
      const page = (await youtubeService._fetch('/playlistItems', {
        part: 'contentDetails',
        playlistId,
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      })) as YtPlaylistItemsPage;

      for (const item of page.items) {
        if (item.contentDetails?.videoId) {
          videoIds.push(item.contentDetails.videoId);
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);

    if (videoIds.length === 0) {
      return [];
    }

    // Step 2: batch fetch video details (max 50 per request)
    const tracks: Track[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const page = (await youtubeService._fetch('/videos', {
        part: 'snippet,contentDetails',
        id: batch.join(','),
        maxResults: '50',
      })) as YtVideosPage;

      for (const video of page.items) {
        tracks.push(ytVideoToNuclear(video));
      }
    }

    return tracks;
  },

  /** Import a YouTube playlist into Nuclear's playlist format. */
  importPlaylist: async (ytPlaylist: YtPlaylistSummary): Promise<Playlist> => {
    const tracks = await youtubeService.getPlaylistTracks(ytPlaylist.id);
    const now = new Date().toISOString();

    const items: PlaylistItem[] = tracks.map((track, i) => ({
      id: `yt-${ytPlaylist.id}-${i}`,
      track,
      addedAtIso: now,
    }));

    const thumbnail =
      ytPlaylist.snippet.thumbnails?.maxres?.url ??
      ytPlaylist.snippet.thumbnails?.high?.url ??
      ytPlaylist.snippet.thumbnails?.default?.url;

    const playlist: Playlist = {
      id: `youtube-imported-${ytPlaylist.id}`,
      name: ytPlaylist.snippet.title,
      description: ytPlaylist.snippet.description || undefined,
      artwork: thumbnail ? { items: [{ url: thumbnail }] } : undefined,
      createdAtIso: now,
      lastModifiedIso: now,
      isReadOnly: false,
      origin: { provider: 'youtube', id: ytPlaylist.id },
      items,
    };

    return playlist;
  },
};

// --- Type mapper ---

const ytVideoToNuclear = (video: YtVideo): Track => {
  const thumbnail =
    video.snippet.thumbnails?.maxres?.url ??
    video.snippet.thumbnails?.high?.url ??
    video.snippet.thumbnails?.default?.url;

  return {
    title: video.snippet.title,
    artists: [{ name: video.snippet.channelTitle, roles: ['artist'] }],
    artwork: thumbnail ? { items: [{ url: thumbnail }] } : undefined,
    durationMs: iso8601DurationToMs(video.contentDetails?.duration ?? ''),
    source: {
      provider: 'youtube',
      id: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    },
  };
};

const iso8601DurationToMs = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return 0;
  }
  const [, h = '0', m = '0', s = '0'] = match;
  return (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000;
};

// --- YouTube API response shapes (minimal) ---

type YtThumbnail = { url: string; width?: number; height?: number };
type YtThumbnails = {
  default?: YtThumbnail;
  medium?: YtThumbnail;
  high?: YtThumbnail;
  maxres?: YtThumbnail;
};

export type YtPlaylistSummary = {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails?: YtThumbnails;
    channelTitle?: string;
  };
  contentDetails: { itemCount: number };
};

type YtPlaylistPage = {
  items: YtPlaylistSummary[];
  nextPageToken?: string;
};

type YtPlaylistItemsPage = {
  items: { contentDetails?: { videoId?: string } }[];
  nextPageToken?: string;
};

type YtVideo = {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: YtThumbnails;
  };
  contentDetails?: { duration?: string };
};

type YtVideosPage = {
  items: YtVideo[];
};
