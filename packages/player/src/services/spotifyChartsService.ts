import { SpotifyPlaylistSummary, spotifyService } from './spotifyService';

type SpotifyFeaturedPlaylistsResponse = {
  playlists: {
    items: SpotifyPlaylistSummary[];
    next: string | null;
  };
};

type SpotifyCategoryPlaylistsResponse = {
  playlists: {
    items: SpotifyPlaylistSummary[];
    next: string | null;
  };
};

const TOP_LISTS_CATEGORY = 'toplists';

export const spotifyChartsService = {
  getFeaturedPlaylists: async (): Promise<SpotifyPlaylistSummary[]> => {
    const data = (await spotifyService._fetch(
      '/browse/featured-playlists?limit=20',
    )) as SpotifyFeaturedPlaylistsResponse;
    return data.playlists.items.filter(Boolean);
  },

  getTopChartPlaylists: async (): Promise<SpotifyPlaylistSummary[]> => {
    const data = (await spotifyService._fetch(
      `/browse/categories/${TOP_LISTS_CATEGORY}/playlists?limit=20`,
    )) as SpotifyCategoryPlaylistsResponse;
    return data.playlists.items.filter(Boolean);
  },
};
