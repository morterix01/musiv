import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { useCallback, type FC } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@nuclearplayer/i18n';
import type { Track } from '@nuclearplayer/model';
import {
  Button,
  Card,
  CardGrid,
  EmptyState,
  Loader,
  ScrollableArea,
  ViewShell,
} from '@nuclearplayer/ui';

import { spotifyChartsService } from '../../services/spotifyChartsService';
import type { SpotifyPlaylistSummary } from '../../services/spotifyService';
import { spotifyService } from '../../services/spotifyService';
import { useAuthStore } from '../../stores/authStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSettingsModalStore } from '../../stores/settingsModalStore';
import { useSoundStore } from '../../stores/soundStore';

const ONE_HOUR = 60 * 60 * 1000;

const useChartPlaylists = (enabled: boolean) =>
  useQuery({
    queryKey: ['charts', 'topCharts'],
    queryFn: () => spotifyChartsService.getTopChartPlaylists(),
    staleTime: ONE_HOUR,
    enabled,
  });

const useFeaturedPlaylists = (enabled: boolean) =>
  useQuery({
    queryKey: ['charts', 'featured'],
    queryFn: () => spotifyChartsService.getFeaturedPlaylists(),
    staleTime: ONE_HOUR,
    enabled,
  });

type ChartsSectionProps = {
  title: string;
  playlists: SpotifyPlaylistSummary[] | undefined;
  isLoading: boolean;
  onPlayAll: (playlist: SpotifyPlaylistSummary) => Promise<void>;
};

const ChartsSection: FC<ChartsSectionProps> = ({
  title,
  playlists,
  isLoading,
  onPlayAll,
}) => {
  const { t } = useTranslation('charts');

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader />
        </div>
      ) : (
        <CardGrid>
          {playlists?.map((playlist) => (
            <Card
              key={playlist.id}
              src={playlist.images?.[0]?.url}
              title={playlist.name}
              subtitle={
                playlist.tracks
                  ? t('trackCount', { count: playlist.tracks.total })
                  : undefined
              }
              onClick={() => onPlayAll(playlist)}
            />
          ))}
        </CardGrid>
      )}
    </section>
  );
};

export const Charts: FC = () => {
  const { t } = useTranslation('charts');
  const { t: tNavigation } = useTranslation('navigation');
  const openSettings = useSettingsModalStore((state) => state.open);
  const spotifyToken = useAuthStore((state) => state.getValidToken('spotify'));
  const isLoggedIn = Boolean(spotifyToken);

  const { data: topCharts, isLoading: isTopChartsLoading } =
    useChartPlaylists(isLoggedIn);
  const { data: featured, isLoading: isFeaturedLoading } =
    useFeaturedPlaylists(isLoggedIn);

  const handlePlayAll = useCallback(
    async (playlist: SpotifyPlaylistSummary) => {
      let tracks: Track[];
      try {
        tracks = await spotifyService.getPlaylistTracks(playlist.id);
      } catch {
        toast.error(t('loadError'));
        return;
      }

      if (tracks.length === 0) {
        return;
      }

      const { clearQueue, addToQueue, goToIndex } = useQueueStore.getState();
      clearQueue();
      addToQueue(tracks);
      goToIndex(0);
      useSoundStore.getState().play();
    },
    [t],
  );

  if (!isLoggedIn) {
    return (
      <ViewShell title={tNavigation('charts')}>
        <EmptyState
          data-testid="charts-empty-state"
          icon={<TrendingUp size={48} />}
          title={t('empty')}
          description={t('emptyDescription')}
          action={
            <Button onClick={() => openSettings()}>{t('emptyAction')}</Button>
          }
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell title={tNavigation('charts')}>
      <ScrollableArea>
        <div className="p-6">
          <ChartsSection
            title={t('topCharts')}
            playlists={topCharts}
            isLoading={isTopChartsLoading}
            onPlayAll={handlePlayAll}
          />
          <ChartsSection
            title={t('featured')}
            playlists={featured}
            isLoading={isFeaturedLoading}
            onPlayAll={handlePlayAll}
          />
        </div>
      </ScrollableArea>
    </ViewShell>
  );
};
