import { SiSpotify, SiYoutube } from '@icons-pack/react-simple-icons';
import { type FC, useState } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Button, Dialog, Loader } from '@nuclearplayer/ui';

import { spotifyService, type SpotifyPlaylistSummary } from '../../../services/spotifyService';
import { youtubeService, type YtPlaylistSummary } from '../../../services/youtubeService';
import { useAuthStore } from '../../../stores/authStore';
import { usePlaylistStore } from '../../../stores/playlistStore';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type ExternalPlaylist =
  | { provider: 'spotify'; data: SpotifyPlaylistSummary }
  | { provider: 'youtube'; data: YtPlaylistSummary };

export const ImportExternalPlaylistDialog: FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('playlists');
  const importPlaylist = usePlaylistStore((state) => state.importPlaylist);
  const spotifyAuth = useAuthStore((state) => state.spotify);
  const youtubeAuth = useAuthStore((state) => state.youtube);

  const [playlists, setPlaylists] = useState<ExternalPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<'spotify' | 'youtube' | null>(null);

  const fetchSpotify = async () => {
    setLoading(true);
    setError(null);
    setActiveProvider('spotify');
    try {
      const items = await spotifyService.getPlaylists();
      setPlaylists(items.map((data) => ({ provider: 'spotify' as const, data })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching Spotify playlists');
    } finally {
      setLoading(false);
    }
  };

  const fetchYoutube = async () => {
    setLoading(true);
    setError(null);
    setActiveProvider('youtube');
    try {
      const items = await youtubeService.getPlaylists();
      setPlaylists(items.map((data) => ({ provider: 'youtube' as const, data })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching YouTube playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (item: ExternalPlaylist) => {
    setImporting(item.data.id);
    try {
      let playlist;
      if (item.provider === 'spotify') {
        playlist = await spotifyService.importPlaylist(item.data as SpotifyPlaylistSummary);
      } else {
        playlist = await youtubeService.importPlaylist(item.data as YtPlaylistSummary);
      }
      await importPlaylist(playlist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(null);
    }
  };

  const handleLogin = async (provider: 'spotify' | 'youtube') => {
    try {
      if (provider === 'spotify') await spotifyService.startLogin();
      else await youtubeService.startLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const hasSpotifyToken = !!spotifyAuth.accessToken;
  const hasYoutubeToken = !!youtubeAuth.accessToken;
  const hasSpotifyClientId = !!spotifyAuth.clientId;
  const hasYoutubeClientId = !!youtubeAuth.clientId;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('importExternal', 'Import from account')}>
      <div className="flex min-h-[400px] w-full max-w-lg flex-col gap-4">
        {/* Provider selector */}
        <div className="flex gap-2">
          <Button
            variant={activeProvider === 'spotify' ? 'default' : 'outline'}
            className="flex flex-1 items-center gap-2"
            onClick={() => {
              if (!hasSpotifyClientId) {
                setError('Spotify Client ID not set. Configure it in Settings → Connected Accounts.');
                return;
              }
              if (!hasSpotifyToken) {
                handleLogin('spotify');
              } else {
                fetchSpotify();
              }
            }}
          >
            <SiSpotify size={16} color="#1DB954" />
            Spotify
            {!hasSpotifyToken && <span className="ml-auto text-xs opacity-60">Login required</span>}
          </Button>
          <Button
            variant={activeProvider === 'youtube' ? 'default' : 'outline'}
            className="flex flex-1 items-center gap-2"
            onClick={() => {
              if (!hasYoutubeClientId) {
                setError('YouTube Client ID not set. Configure it in Settings → Connected Accounts.');
                return;
              }
              if (!hasYoutubeToken) {
                handleLogin('youtube');
              } else {
                fetchYoutube();
              }
            }}
          >
            <SiYoutube size={16} color="#FF0000" />
            YouTube
            {!hasYoutubeToken && <span className="ml-auto text-xs opacity-60">Login required</span>}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-accent-red/20 px-3 py-2 text-sm text-accent-red">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader />
          </div>
        )}

        {/* Playlist list */}
        {!loading && playlists.length > 0 && (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {playlists.map((item) => {
              const id = item.data.id;
              const name = item.data.provider === 'spotify'
                ? (item.data as SpotifyPlaylistSummary).name
                : (item.data as YtPlaylistSummary).snippet.title;
              const count = item.provider === 'spotify'
                ? (item.data as SpotifyPlaylistSummary).tracks.total
                : (item.data as YtPlaylistSummary).contentDetails.itemCount;
              const thumb = item.provider === 'spotify'
                ? (item.data as SpotifyPlaylistSummary).images?.[0]?.url
                : (item.data as YtPlaylistSummary).snippet.thumbnails?.default?.url;

              return (
                <div
                  key={id}
                  className="bg-background-secondary/60 flex items-center gap-3 rounded-lg p-2"
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt={name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="text-foreground-secondary text-xs">{count} tracks</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={importing === id}
                    onClick={() => handleImport(item)}
                  >
                    {importing === id ? <Loader /> : t('import', 'Import')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && playlists.length === 0 && !error && activeProvider && (
          <div className="text-foreground-secondary flex flex-1 items-center justify-center text-sm">
            No playlists found
          </div>
        )}
      </div>
    </Dialog>
  );
};
