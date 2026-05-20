/**
 * Spotify OAuth2 PKCE Service
 *
 * Uses Authorization Code with PKCE flow — suitable for desktop (Tauri) apps.
 * The user's Client ID must be provided (set in settings).
 * The redirect URI is a custom scheme handled by Tauri deep links: nuclear://spotify-callback
 *
 * Required Spotify Dashboard settings:
 *   - Redirect URI: nuclear://spotify-callback
 *   - Scope: playlist-read-private playlist-read-collaborative user-library-read
 */
import { openUrl } from '@tauri-apps/plugin-opener';

import type { Playlist, PlaylistItem, Track } from '@nuclearplayer/model';

import { useAuthStore } from '../stores/authStore';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const REDIRECT_URI = 'nuclear://spotify-callback';
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');

// --- PKCE helpers ---

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

// Store verifier in memory (valid for the lifetime of this flow)
let _codeVerifier: string | null = null;

// --- Public API ---

export const spotifyService = {
  /**
   * Opens the Spotify authorization page in the system browser.
   * The app must handle the deep link callback nuclear://spotify-callback?code=...
   */
  startLogin: async (): Promise<void> => {
    const { clientId } = useAuthStore.getState().spotify;
    if (!clientId) throw new Error('Spotify Client ID not configured');

    _codeVerifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(_codeVerifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });

    await openUrl(`${SPOTIFY_AUTH_URL}?${params.toString()}`);
  },

  /**
   * Exchange the authorization code (from the deep link callback) for tokens.
   * Call this from your Tauri deep link listener.
   */
  handleCallback: async (code: string): Promise<void> => {
    if (!_codeVerifier) throw new Error('No code verifier found. Start login first.');
    const { clientId } = useAuthStore.getState().spotify;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: _codeVerifier,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);

    const data = await res.json();
    await useAuthStore.getState().setTokens('spotify', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });

    _codeVerifier = null;
  },

  /** Refresh an expired access token using the stored refresh token. */
  refreshToken: async (): Promise<void> => {
    const { clientId, refreshToken } = useAuthStore.getState().spotify;
    if (!refreshToken) throw new Error('No refresh token stored for Spotify');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);

    const data = await res.json();
    await useAuthStore.getState().setTokens('spotify', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
    });
  },

  /** Get a valid access token, refreshing if necessary. */
  getToken: async (): Promise<string> => {
    let token = useAuthStore.getState().getValidToken('spotify');
    if (!token) {
      await spotifyService.refreshToken();
      token = useAuthStore.getState().getValidToken('spotify');
    }
    if (!token) throw new Error('Unable to obtain Spotify access token');
    return token;
  },

  /** Internal fetch helper with auth header. */
  _fetch: async (path: string): Promise<unknown> => {
    const token = await spotifyService.getToken();
    const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${path}`);
    return res.json();
  },

  /** Fetch all user playlists (handles pagination). */
  getPlaylists: async (): Promise<SpotifyPlaylistSummary[]> => {
    const results: SpotifyPlaylistSummary[] = [];
    let url: string | null = '/me/playlists?limit=50';

    while (url) {
      const page = (await spotifyService._fetch(url)) as SpotifyPlaylistPage;
      results.push(...page.items);
      // Spotify returns full next URL; strip base
      url = page.next
        ? page.next.replace(SPOTIFY_API_BASE, '')
        : null;
    }

    return results;
  },

  /** Fetch all tracks of a specific playlist, mapped to Nuclear's Track type. */
  getPlaylistTracks: async (playlistId: string): Promise<Track[]> => {
    const tracks: Track[] = [];
    let url: string | null = `/playlists/${playlistId}/tracks?limit=100`;

    while (url) {
      const page = (await spotifyService._fetch(url)) as SpotifyTracksPage;
      for (const item of page.items) {
        if (!item.track || item.track.type !== 'track') continue;
        tracks.push(spotifyTrackToNuclear(item.track));
      }
      url = page.next ? page.next.replace(SPOTIFY_API_BASE, '') : null;
    }

    return tracks;
  },

  /** Import a Spotify playlist directly into Nuclear's playlist store. */
  importPlaylist: async (spotifyPlaylist: SpotifyPlaylistSummary): Promise<Playlist> => {
    const tracks = await spotifyService.getPlaylistTracks(spotifyPlaylist.id);
    const now = new Date().toISOString();

    const items: PlaylistItem[] = tracks.map((track, i) => ({
      id: `spotify-${spotifyPlaylist.id}-${i}`,
      track,
      addedAtIso: now,
    }));

    const playlist: Playlist = {
      id: `spotify-imported-${spotifyPlaylist.id}`,
      name: spotifyPlaylist.name,
      description: spotifyPlaylist.description ?? undefined,
      artwork: spotifyPlaylist.images?.[0]
        ? { items: [{ url: spotifyPlaylist.images[0].url }] }
        : undefined,
      createdAtIso: now,
      lastModifiedIso: now,
      isReadOnly: false,
      origin: { provider: 'spotify', id: spotifyPlaylist.id },
      items,
    };

    return playlist;
  },
};

// --- Type mappers ---

const spotifyTrackToNuclear = (t: SpotifyTrack): Track => ({
  title: t.name,
  artists: t.artists.map((a) => ({ name: a.name, roles: ['artist'] })),
  album: t.album
    ? {
        title: t.album.name,
        artists: t.album.artists?.map((a) => ({
          name: a.name,
          source: { provider: 'spotify', id: a.id },
        })),
        artwork: t.album.images?.[0]
          ? { items: [{ url: t.album.images[0].url }] }
          : undefined,
        source: { provider: 'spotify', id: t.album.id },
      }
    : undefined,
  durationMs: t.duration_ms,
  artwork: t.album?.images?.[0]
    ? { items: [{ url: t.album.images[0].url }] }
    : undefined,
  source: { provider: 'spotify', id: t.id, url: t.external_urls?.spotify },
});

// --- Spotify API response shapes (minimal) ---

type SpotifyImage = { url: string; width?: number; height?: number };
type SpotifyArtistRef = { id: string; name: string };

type SpotifyAlbum = {
  id: string;
  name: string;
  images?: SpotifyImage[];
  artists?: SpotifyArtistRef[];
};

type SpotifyTrack = {
  id: string;
  name: string;
  type: string;
  duration_ms: number;
  artists: SpotifyArtistRef[];
  album?: SpotifyAlbum;
  external_urls?: { spotify?: string };
};

export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  description?: string | null;
  images?: SpotifyImage[];
  tracks: { total: number };
};

type SpotifyPlaylistPage = {
  items: SpotifyPlaylistSummary[];
  next: string | null;
};

type SpotifyTracksPage = {
  items: { track: SpotifyTrack | null }[];
  next: string | null;
};
