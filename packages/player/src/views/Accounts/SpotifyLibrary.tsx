import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { type FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';

import { spotifyService } from '../../services/spotifyService';

type LibrarySectionProps = {
  title: string;
  testid: string;
  query: UseQueryResult<string[]>;
};

const LibrarySection: FC<LibrarySectionProps> = ({ title, testid, query }) => {
  const { t } = useTranslation('accounts');
  const names = query.data ?? [];

  return (
    <div data-testid={testid} className="flex flex-col gap-1">
      <h4 className="text-sm font-bold">{title}</h4>
      {query.isPending && (
        <p className="text-foreground-secondary text-sm">
          {t('library.loading')}
        </p>
      )}
      {query.isError && (
        <p className="text-accent-red text-sm">{t('library.error')}</p>
      )}
      {!query.isPending && !query.isError && names.length === 0 && (
        <p className="text-foreground-secondary text-sm">
          {t('library.empty')}
        </p>
      )}
      {names.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {names.map((name, index) => (
            <li
              key={`${testid}-${index}`}
              data-testid={`${testid}-item`}
              className="text-foreground-secondary truncate text-sm"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const trackLabel = (track: {
  title: string;
  artists: { name: string }[];
}): string => {
  const artist = track.artists[0]?.name;
  return artist ? `${track.title} — ${artist}` : track.title;
};

export const SpotifyLibrary: FC = () => {
  const { t } = useTranslation('accounts');

  const playlists = useQuery({
    queryKey: ['spotify-library', 'playlists'],
    queryFn: async () =>
      (await spotifyService.getPlaylists()).map((playlist) => playlist.name),
  });
  const savedTracks = useQuery({
    queryKey: ['spotify-library', 'saved'],
    queryFn: async () =>
      (await spotifyService.getSavedTracks()).map(trackLabel),
  });
  const history = useQuery({
    queryKey: ['spotify-library', 'history'],
    queryFn: async () =>
      (await spotifyService.getRecentlyPlayed()).map(trackLabel),
  });
  const artists = useQuery({
    queryKey: ['spotify-library', 'artists'],
    queryFn: async () =>
      (await spotifyService.getFollowedArtists()).map((artist) => artist.name),
  });

  return (
    <div data-testid="spotify-library" className="mt-2 flex flex-col gap-4">
      <LibrarySection
        title={t('library.playlists')}
        testid="spotify-library-playlists"
        query={playlists}
      />
      <LibrarySection
        title={t('library.savedTracks')}
        testid="spotify-library-saved"
        query={savedTracks}
      />
      <LibrarySection
        title={t('library.history')}
        testid="spotify-library-history"
        query={history}
      />
      <LibrarySection
        title={t('library.artists')}
        testid="spotify-library-artists"
        query={artists}
      />
    </div>
  );
};
