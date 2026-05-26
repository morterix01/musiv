import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { spotifyService } from '../../services/spotifyService';
import { useAuthStore } from '../../stores/authStore';
import { AccountsWrapper } from './Accounts.test-wrapper';

vi.mock('../../services/spotifyService', () => ({
  spotifyService: {
    startLogin: vi.fn(),
    getPlaylists: vi.fn(),
    getSavedTracks: vi.fn(),
    getRecentlyPlayed: vi.fn(),
    getFollowedArtists: vi.fn(),
  },
}));

vi.mock('../../services/youtubeService', () => ({
  youtubeService: {
    startLogin: vi.fn(),
    getPlaylists: vi.fn(),
  },
}));

describe('Accounts view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      spotify: { clientId: '' },
      youtube: { clientId: '' },
      isLoaded: true,
    });
  });

  it('renders a card for each streaming service', async () => {
    await AccountsWrapper.mount();

    for (const id of ['spotify', 'youtube', 'appleMusic', 'tidal', 'deezer']) {
      expect(AccountsWrapper.card(id)).toBeInTheDocument();
    }
  });

  it('disables the coming-soon services and enables the active ones', async () => {
    await AccountsWrapper.mount();

    expect(AccountsWrapper.actionButton('spotify')).toBeEnabled();
    expect(AccountsWrapper.actionButton('youtube')).toBeEnabled();
    expect(AccountsWrapper.actionButton('appleMusic')).toBeDisabled();
    expect(AccountsWrapper.actionButton('tidal')).toBeDisabled();
    expect(AccountsWrapper.actionButton('deezer')).toBeDisabled();
  });

  it('starts the Spotify login flow when clicking connect', async () => {
    await AccountsWrapper.mount();

    await userEvent.click(AccountsWrapper.actionButton('spotify'));

    expect(spotifyService.startLogin).toHaveBeenCalledOnce();
  });

  it('shows the Spotify library when the account is connected', async () => {
    vi.mocked(spotifyService.getPlaylists).mockResolvedValue([
      { id: 'p1', name: 'My Playlist', tracks: { total: 3 } },
    ]);
    vi.mocked(spotifyService.getSavedTracks).mockResolvedValue([
      {
        title: 'Saved Song',
        artists: [{ name: 'Artist A' }],
        source: { provider: 'spotify', id: 's1' },
      },
    ]);
    vi.mocked(spotifyService.getRecentlyPlayed).mockResolvedValue([]);
    vi.mocked(spotifyService.getFollowedArtists).mockResolvedValue([
      { name: 'Followed Artist', source: { provider: 'spotify', id: 'a1' } },
    ]);

    useAuthStore.setState({
      spotify: {
        clientId: 'cid',
        accessToken: 'tok',
        expiresAt: Date.now() + 3_600_000,
      },
      youtube: { clientId: '' },
      isLoaded: true,
    });

    await AccountsWrapper.mount();

    expect(AccountsWrapper.library).toBeInTheDocument();
    expect(await screen.findByText('My Playlist')).toBeInTheDocument();
    expect(
      await screen.findByText('Saved Song — Artist A'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Followed Artist')).toBeInTheDocument();
  });

  it('shows the YouTube library when the account is connected', async () => {
    vi.mocked(youtubeService.getPlaylists).mockResolvedValue([
      {
        id: 'p1',
        snippet: {
          title: 'My YouTube Playlist',
          description: '',
        },
        contentDetails: { itemCount: 5 },
      },
    ]);

    useAuthStore.setState({
      spotify: { clientId: '' },
      youtube: {
        clientId: 'cid',
        accessToken: 'tok',
        expiresAt: Date.now() + 3_600_000,
      },
      isLoaded: true,
    });

    await AccountsWrapper.mount();

    expect(AccountsWrapper.youtubeLibrary).toBeInTheDocument();
    expect(await screen.findByText('My YouTube Playlist')).toBeInTheDocument();
  });
});
