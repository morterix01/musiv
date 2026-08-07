import { waitFor } from '@testing-library/react';

import { SpotifyApiError, spotifyService } from '../../services/spotifyService';
import { useAuthStore } from '../../stores/authStore';
import { PlaylistBuilder } from '../../test/builders/PlaylistBuilder';
import { PlaylistsWrapper } from './Playlists.test-wrapper';

vi.mock('../../services/spotifyService', () => {
  class SpotifyApiError extends Error {
    readonly status: number;
    readonly detail: string;

    constructor(status: number, path: string, detail: string) {
      super(`Spotify API error ${status}: ${detail} (${path})`);
      this.status = status;
      this.detail = detail;
    }
  }

  return {
    SPOTIFY_COLLECTIONS: ['savedTracks', 'history', 'topTracks'],
    SpotifyApiError,
    spotifyService: {
      hasClientId: vi.fn(() => true),
      startLogin: vi.fn(),
      getPlaylists: vi.fn(),
      importPlaylist: vi.fn(),
      importCollection: vi.fn(),
    },
  };
});

vi.mock('../../services/youtubeService', () => ({
  youtubeService: {
    hasClientId: vi.fn(() => true),
    startLogin: vi.fn(),
    getPlaylists: vi.fn(),
    importPlaylist: vi.fn(),
  },
}));

describe('Importing a playlist from a connected account', () => {
  beforeEach(() => {
    PlaylistsWrapper.seedPlaylists();
    useAuthStore.setState({
      spotify: { clientId: '' },
      youtube: { clientId: '' },
      isLoaded: true,
    });
  });

  it('shows translated labels instead of raw translation keys', async () => {
    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();

    expect(
      PlaylistsWrapper.import.fromAccount.dialog.title,
    ).toBeInTheDocument();
    expect(PlaylistsWrapper.import.fromAccount.dialog.loginHints).toHaveLength(
      2,
    );
  });

  it('starts the login flow instead of complaining about a missing client id', async () => {
    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();
    await PlaylistsWrapper.import.fromAccount.dialog.spotifyButton.click();

    expect(spotifyService.startLogin).toHaveBeenCalledOnce();
    expect(PlaylistsWrapper.import.fromAccount.dialog.error).toBeNull();
  });

  it('offers the account collections alongside the real playlists', async () => {
    vi.mocked(spotifyService.getPlaylists).mockResolvedValue([
      { id: 'p1', name: 'Road trip', tracks: { total: 12 } },
    ]);
    useAuthStore.setState({
      spotify: {
        clientId: '',
        accessToken: 'tok',
        expiresAt: Date.now() + 3_600_000,
      },
      youtube: { clientId: '' },
      isLoaded: true,
    });

    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();
    await PlaylistsWrapper.import.fromAccount.dialog.spotifyButton.click();

    await waitFor(() =>
      expect(PlaylistsWrapper.import.fromAccount.dialog.entryNames).toEqual([
        'Saved songs',
        'Recently played',
        'Most played songs',
        'Road trip',
      ]),
    );
  });

  it('lists a playlist Spotify returned without a track count', async () => {
    vi.mocked(spotifyService.getPlaylists).mockResolvedValue([
      { id: 'p1', name: 'Discover Weekly' },
    ]);
    useAuthStore.setState({
      spotify: {
        clientId: '',
        accessToken: 'tok',
        expiresAt: Date.now() + 3_600_000,
      },
      youtube: { clientId: '' },
      isLoaded: true,
    });

    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();
    await PlaylistsWrapper.import.fromAccount.dialog.spotifyButton.click();

    await waitFor(() =>
      expect(PlaylistsWrapper.import.fromAccount.dialog.entryNames).toContain(
        'Discover Weekly',
      ),
    );
  });

  it('imports a collection as an editable playlist', async () => {
    vi.mocked(spotifyService.getPlaylists).mockResolvedValue([]);
    vi.mocked(spotifyService.importCollection).mockResolvedValue(
      new PlaylistBuilder().withName('Saved songs').build(),
    );
    useAuthStore.setState({
      spotify: {
        clientId: '',
        accessToken: 'tok',
        expiresAt: Date.now() + 3_600_000,
      },
      youtube: { clientId: '' },
      isLoaded: true,
    });

    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();
    await PlaylistsWrapper.import.fromAccount.dialog.spotifyButton.click();
    await PlaylistsWrapper.import.fromAccount.dialog.importEntry(
      'Most played songs',
    );

    expect(spotifyService.importCollection).toHaveBeenCalledWith(
      'topTracks',
      'Most played songs',
    );
  });

  it('explains the block instead of showing a raw 403 url', async () => {
    vi.mocked(spotifyService.getPlaylists).mockResolvedValue([
      { id: 'p1', name: 'Discover Weekly', tracks: { total: 30 } },
    ]);
    vi.mocked(spotifyService.importPlaylist).mockRejectedValue(
      new SpotifyApiError(
        403,
        '/playlists/p1/tracks?limit=100',
        'Insufficient client scope',
      ),
    );
    useAuthStore.setState({
      spotify: {
        clientId: '',
        accessToken: 'tok',
        expiresAt: Date.now() + 3_600_000,
      },
      youtube: { clientId: '' },
      isLoaded: true,
    });

    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();
    await PlaylistsWrapper.import.fromAccount.dialog.spotifyButton.click();
    await PlaylistsWrapper.import.fromAccount.dialog.importEntry(
      'Discover Weekly',
    );

    await waitFor(() =>
      expect(
        PlaylistsWrapper.import.fromAccount.dialog.error,
      ).toHaveTextContent('Insufficient client scope'),
    );
  });

  it('reports the missing client id when no default is shipped', async () => {
    vi.mocked(spotifyService.hasClientId).mockReturnValue(false);

    await PlaylistsWrapper.mount();
    await PlaylistsWrapper.import.fromAccount.click();
    await PlaylistsWrapper.import.fromAccount.dialog.spotifyButton.click();

    expect(spotifyService.startLogin).not.toHaveBeenCalled();
    expect(PlaylistsWrapper.import.fromAccount.dialog.error).toHaveTextContent(
      'Spotify Client ID not set',
    );
  });
});
