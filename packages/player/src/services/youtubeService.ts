/**
 * YouTube OAuth2 Service
 *
 * Uses Google OAuth2 Authorization Code flow for desktop apps.
 * The user's Client ID must be provided (set in settings).
 * Redirect URI: nuclear://youtube-callback
 *
 * Required Google Cloud Console setup:
 *   - OAuth 2.0 Desktop App credentials
 *   - YouTube Data API v3 enabled
 *   - Redirect URI: nuclear://youtube-callback
 *   - Scopes: https://www.googleapis.com/auth/youtube.readonly
 */
import { openUrl } from '@tauri-apps/plugin-opener';

import type { Playlist, PlaylistItem, Track } from '@nuclearplayer/model';

import { useAuthStore } from '../stores/authStore';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const REDIRECT_URI = 'nuclear://youtube-callback';
const SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

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

// --- Public API ---

export const youtubeService = {
  /** Open Google login in system browser. */
  startLogin: async (): Promise<void> => {
    const { clientId } = useAuthStore.getState().youtube;
    if (!clientId) throw new Error('YouTube Client ID not configured');

    _codeVerifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(_codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    await openUrl(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  },

  /** Exchange the auth code from the deep link callback for tokens. */
  handleCallback: async (code: string): Promise<void> => {
    if (!_codeVerifier) throw new Error('No code verifier. Call startLogin first.');
    const { clientId } = useAuthStore.getState().youtube;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: _codeVerifier,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`YouTube token exchange failed: ${res.status}`);

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
    const { clientId, refreshToken } = useAuthStore.getState().youtube;
    if (!refreshToken) throw new Error('No refresh token for YouTube');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status}`);

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
    if (!token) throw new Error('Unable to obtain YouTube access token');
    return token;
  },

  /** Internal authenticated fetch helper. */
  _fetch: async (path: string, params: Record<string, string> = {}): Promise<unknown> => {
    const token = await youtubeService.getToken();
    const qs = new URLSearchParams({ ...params, access_token: token });
    const res = await fetch(`${YT_API_BASE}${path}?${qs.toString()}`);
    if (!res.ok) throw new Error(`YouTube API error ${res.status}: ${path}`);
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

    if (videoIds.length === 0) return [];

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
  if (!match) return 0;
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
