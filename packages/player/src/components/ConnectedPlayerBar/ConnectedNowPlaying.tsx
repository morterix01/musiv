import { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import { FavoriteButton, PlayerBar } from '@nuclearplayer/ui';

import { useFavoritesStore } from '../../stores/favoritesStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSpotifyConnectStore } from '../../stores/spotifyConnectStore';

export const ConnectedNowPlaying: FC = () => {
  const { t } = useTranslation('playerBar');
  const { t: tTrack } = useTranslation('track');
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const { isTrackFavorite, addTrack, removeTrack } = useFavoritesStore();
  const spotifyConnect = useSpotifyConnectStore(
    useShallow((state) => ({
      isActive: state.isActive,
      currentTrack: state.currentTrack,
    })),
  );

  if (spotifyConnect.isActive && spotifyConnect.currentTrack) {
    const connectTrack = spotifyConnect.currentTrack;
    return (
      <PlayerBar.NowPlaying
        title={connectTrack.name}
        artist={connectTrack.artist}
        coverUrl={connectTrack.artworkUrl ?? undefined}
        action={
          <span className="text-accent-green shrink-0 text-xs font-semibold">
            {t('spotifyConnect')}
          </span>
        }
      />
    );
  }

  const track = currentItem?.track;
  const isFavorite = track ? isTrackFavorite(track.source) : false;

  const artwork = pickArtwork(track?.artwork, 'thumbnail', 64);
  const title = track?.title ?? t('noTrackPlaying');
  const artist = track?.artists[0]?.name ?? '';

  const handleToggleFavorite = () => {
    if (!track) {
      return;
    }
    if (isFavorite) {
      removeTrack(track.source);
    } else {
      addTrack(track);
    }
  };

  return (
    <PlayerBar.NowPlaying
      title={title}
      artist={artist}
      coverUrl={artwork?.url}
      action={
        track && (
          <FavoriteButton
            size="sm"
            isFavorite={isFavorite}
            onToggle={handleToggleFavorite}
            ariaLabelAdd={tTrack('actions.addToFavorites')}
            ariaLabelRemove={tTrack('actions.removeFromFavorites')}
          />
        )
      }
    />
  );
};
