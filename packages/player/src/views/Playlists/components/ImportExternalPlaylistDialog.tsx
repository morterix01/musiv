import { Music, Video } from 'lucide-react';
import { useState, type FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Button, Dialog, Loader } from '@nuclearplayer/ui';

import {
  spotifyService,
  type SpotifyPlaylistSummary,
} from '../../../services/spotifyService';
import {
  youtubeService,
  type YtPlaylistSummary,
} from '../../../services/youtubeService';
import { useAuthStore } from '../../../stores/authStore';
import { usePlaylistStore } from '../../../stores/playlistStore';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type ExternalPlaylist =
  | { provider: 'spotify'; data: SpotifyPlaylistSummary }
  | { provider: 'youtube'; data: YtPlaylistSummary };

export const ImportExternalPlaylistDialog: FC<Props> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const importPlaylist = usePlaylistStore((state) => state.importPlaylist);
  const spotifyAuth = useAuthStore((state) => state.spotify);
  const youtubeAuth = useAuthStore((state) => state.youtube);

  const [playlists, setPlaylists] = useState<ExternalPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<
    'spotify' | 'youtube' | null
  >(null);

  const fetchSpotify = async () => {
    setLoading(true);
    setError(null);
    setActiveProvider('spotify');
    try {
      const items = await spotifyService.getPlaylists();
      setPlaylists(
        items.map((data) => ({ provider: 'spotify' as const, data })),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('playlists.importExternalErrors.spotifyFetch'),
      );
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
      setPlaylists(
        items.map((data) => ({ provider: 'youtube' as const, data })),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('playlists.importExternalErrors.youtubeFetch'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (item: ExternalPlaylist) => {
    setImporting(item.data.id);
    try {
      const playlist =
        item.provider === 'spotify'
          ? await spotifyService.importPlaylist(item.data)
          : await youtubeService.importPlaylist(item.data);
      await importPlaylist(playlist);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('playlists.importExternalErrors.import'),
      );
    } finally {
      setImporting(null);
    }
  };

  const handleLogin = async (provider: 'spotify' | 'youtube') => {
    try {
      if (provider === 'spotify') {
        await spotifyService.startLogin();
      } else {
        await youtubeService.startLogin();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('playlists.importExternalErrors.login'),
      );
    }
  };

  const hasSpotifyToken = !!spotifyAuth.accessToken;
  const hasYoutubeToken = !!youtubeAuth.accessToken;
  const hasSpotifyClientId = !!spotifyAuth.clientId;
  const hasYoutubeClientId = !!youtubeAuth.clientId;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('playlists.importExternal')}
    >
      <div className="flex min-h-[400px] w-full max-w-lg flex-col gap-4">
        <div className="flex gap-2">
          <Button
            variant={activeProvider === 'spotify' ? 'default' : 'secondary'}
            className="flex flex-1 items-center gap-2"
            onClick={() => {
              if (!hasSpotifyClientId) {
                setError(
                  t('playlists.importExternalErrors.spotifyClientIdMissing'),
                );
                return;
              }
              if (!hasSpotifyToken) {
                handleLogin('spotify');
              } else {
                fetchSpotify();
              }
            }}
          >
            <Music size={16} color="#1DB954" />
            Spotify
            {!hasSpotifyToken && (
              <span className="ml-auto text-xs opacity-60">
                {t('playlists.loginRequired')}
              </span>
            )}
          </Button>
          <Button
            variant={activeProvider === 'youtube' ? 'default' : 'secondary'}
            className="flex flex-1 items-center gap-2"
            onClick={() => {
              if (!hasYoutubeClientId) {
                setError(
                  t('playlists.importExternalErrors.youtubeClientIdMissing'),
                );
                return;
              }
              if (!hasYoutubeToken) {
                handleLogin('youtube');
              } else {
                fetchYoutube();
              }
            }}
          >
            <Video size={16} color="#FF0000" />
            YouTube
            {!hasYoutubeToken && (
              <span className="ml-auto text-xs opacity-60">
                {t('playlists.loginRequired')}
              </span>
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-accent-red/20 text-accent-red rounded-md px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <Loader />
          </div>
        )}

        {!loading && playlists.length > 0 && (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {playlists.map((item) => {
              const id = item.data.id;
              const name =
                item.provider === 'spotify'
                  ? item.data.name
                  : item.data.snippet.title;
              const count =
                item.provider === 'spotify'
                  ? item.data.tracks.total
                  : item.data.contentDetails.itemCount;
              const thumb =
                item.provider === 'spotify'
                  ? item.data.images?.[0]?.url
                  : item.data.snippet.thumbnails?.default?.url;

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
                    <span className="text-foreground-secondary text-xs">
                      {t('playlists.trackCount', { count })}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    disabled={importing === id}
                    onClick={() => handleImport(item)}
                  >
                    {importing === id ? <Loader /> : t('playlists.import')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && playlists.length === 0 && !error && activeProvider && (
          <div className="text-foreground-secondary flex flex-1 items-center justify-center text-sm">
            {t('playlists.importNoPlaylists')}
          </div>
        )}
      </div>
    </Dialog>
  );
};
