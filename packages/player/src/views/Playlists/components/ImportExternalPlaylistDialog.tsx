import { Music, Video } from 'lucide-react';
import { useState, type FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import type { Playlist } from '@nuclearplayer/model';
import { Button, Dialog, Loader } from '@nuclearplayer/ui';

import {
  SPOTIFY_COLLECTIONS,
  SpotifyApiError,
  spotifyService,
  type SpotifyCollectionId,
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
  | { provider: 'spotifyCollection'; collection: SpotifyCollectionId }
  | { provider: 'youtube'; data: YtPlaylistSummary };

const FORBIDDEN = 403;

type ListEntry = {
  key: string;
  name: string;
  count?: number;
  thumbnail?: string;
};

const resolveImport = (
  item: ExternalPlaylist,
  name: string,
): Promise<Playlist> => {
  if (item.provider === 'spotifyCollection') {
    return spotifyService.importCollection(item.collection, name);
  }
  if (item.provider === 'spotify') {
    return spotifyService.importPlaylist(item.data);
  }
  return youtubeService.importPlaylist(item.data);
};

export const ImportExternalPlaylistDialog: FC<Props> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation('playlists');
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
      setPlaylists([
        ...SPOTIFY_COLLECTIONS.map((collection) => ({
          provider: 'spotifyCollection' as const,
          collection,
        })),
        ...items.map((data) => ({ provider: 'spotify' as const, data })),
      ]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('importExternalErrors.spotifyFetch'),
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
          : t('importExternalErrors.youtubeFetch'),
      );
    } finally {
      setLoading(false);
    }
  };

  const collectionName = (collection: SpotifyCollectionId): string => {
    switch (collection) {
      case 'savedTracks':
        return t('collections.savedTracks');
      case 'history':
        return t('collections.history');
      case 'topTracks':
        return t('collections.topTracks');
    }
  };

  const toListEntry = (item: ExternalPlaylist): ListEntry => {
    if (item.provider === 'spotifyCollection') {
      return {
        key: `collection-${item.collection}`,
        name: collectionName(item.collection),
      };
    }
    if (item.provider === 'spotify') {
      return {
        key: item.data.id,
        name: item.data.name,
        count: item.data.tracks?.total,
        thumbnail: item.data.images?.[0]?.url,
      };
    }
    return {
      key: item.data.id,
      name: item.data.snippet.title,
      count: item.data.contentDetails.itemCount,
      thumbnail: item.data.snippet.thumbnails?.default?.url,
    };
  };

  const handleImport = async (item: ExternalPlaylist) => {
    const entry = toListEntry(item);
    setImporting(entry.key);
    try {
      const playlist = await resolveImport(item, entry.name);
      await importPlaylist(playlist);
    } catch (error) {
      if (error instanceof SpotifyApiError && error.status === FORBIDDEN) {
        setError(
          error.detail
            ? t('importExternalErrors.spotifyForbidden', {
                detail: error.detail,
              })
            : t('importExternalErrors.spotifyForbiddenNoDetail'),
        );
        return;
      }
      setError(
        error instanceof Error
          ? error.message
          : t('importExternalErrors.import'),
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
          : t('importExternalErrors.login'),
      );
    }
  };

  const hasSpotifyToken = !!spotifyAuth.accessToken;
  const hasYoutubeToken = !!youtubeAuth.accessToken;
  const hasSpotifyClientId = spotifyService.hasClientId();
  const hasYoutubeClientId = youtubeService.hasClientId();

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('importExternal')}>
      <div className="flex min-h-[400px] w-full max-w-lg flex-col gap-4">
        <div className="flex gap-2">
          <Button
            variant={activeProvider === 'spotify' ? 'default' : 'secondary'}
            className="flex flex-1 items-center gap-2"
            onClick={() => {
              if (!hasSpotifyClientId) {
                setError(t('importExternalErrors.spotifyClientIdMissing'));
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
                {t('loginRequired')}
              </span>
            )}
          </Button>
          <Button
            variant={activeProvider === 'youtube' ? 'default' : 'secondary'}
            className="flex flex-1 items-center gap-2"
            onClick={() => {
              if (!hasYoutubeClientId) {
                setError(t('importExternalErrors.youtubeClientIdMissing'));
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
                {t('loginRequired')}
              </span>
            )}
          </Button>
        </div>

        {error && (
          <div
            data-testid="import-external-error"
            className="bg-accent-red/20 text-accent-red rounded-md px-3 py-2 text-sm"
          >
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
              const { key, name, count, thumbnail } = toListEntry(item);

              return (
                <div
                  key={key}
                  data-testid="import-external-entry"
                  className="bg-background-secondary/60 flex items-center gap-3 rounded-lg p-2"
                >
                  {thumbnail && (
                    <img
                      src={thumbnail}
                      alt={name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      data-testid="import-external-entry-name"
                      className="truncate text-sm font-medium"
                    >
                      {name}
                    </span>
                    {count !== undefined && (
                      <span className="text-foreground-secondary text-xs">
                        {t('trackCount', { count })}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={importing === key}
                    onClick={() => handleImport(item)}
                  >
                    {importing === key ? <Loader /> : t('import')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && playlists.length === 0 && !error && activeProvider && (
          <div className="text-foreground-secondary flex flex-1 items-center justify-center text-sm">
            {t('importNoPlaylists')}
          </div>
        )}
      </div>
    </Dialog>
  );
};
