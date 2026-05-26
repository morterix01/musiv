import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { type FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';

import { youtubeService } from '../../services/youtubeService';

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
        <p className="text-foreground-secondary text-sm">{t('library.loading')}</p>
      )}
      {query.isError && (
        <p className="text-accent-red text-sm">{t('library.error')}</p>
      )}
      {!query.isPending && !query.isError && names.length === 0 && (
        <p className="text-foreground-secondary text-sm">{t('library.empty')}</p>
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

export const YouTubeLibrary: FC = () => {
  const { t } = useTranslation('accounts');

  const playlists = useQuery({
    queryKey: ['youtube-library', 'playlists'],
    queryFn: async () =>
      (await youtubeService.getPlaylists()).map((playlist) => playlist.snippet.title),
  });

  return (
    <div data-testid="youtube-library" className="mt-2 flex flex-col gap-4">
      <LibrarySection
        title={t('library.playlists')}
        testid="youtube-library-playlists"
        query={playlists}
      />
    </div>
  );
};
