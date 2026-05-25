import { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useTranslation } from '@nuclearplayer/i18n';
import { RepeatMode } from '@nuclearplayer/plugin-sdk';
import { PlayerBar } from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { useProviders } from '../../hooks/useProviders';
import { spotifyConnectService } from '../../services/spotifyConnectService';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { useSpotifyConnectStore } from '../../stores/spotifyConnectStore';

export const ConnectedControls: FC = () => {
  const { t } = useTranslation('playerBar');
  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');
  const [discoveryEnabled, setDiscoveryEnabled] =
    useCoreSetting<boolean>('playback.discovery');
  const hasDiscoveryProviders = useProviders('discovery').length > 0;

  const { goToNext, goToPrevious } = useQueueStore(
    useShallow((state) => ({
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
    })),
  );
  const { status, toggle } = useSoundStore(
    useShallow((state) => ({
      status: state.status,
      toggle: state.toggle,
    })),
  );
  const spotifyConnect = useSpotifyConnectStore(
    useShallow((state) => ({
      isActive: state.isActive,
      isPlaying: state.isPlaying,
    })),
  );

  const handleToggleShuffle = () => {
    setShuffleEnabled(!shuffleEnabled);
  };

  const handleToggleDiscovery = () => {
    setDiscoveryEnabled(!discoveryEnabled);
  };

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const isPlaying = spotifyConnect.isActive
    ? spotifyConnect.isPlaying
    : status === 'playing';

  const handlePlayPause = spotifyConnect.isActive
    ? () => void spotifyConnectService.togglePlay()
    : toggle;

  const handleNext = spotifyConnect.isActive
    ? () => void spotifyConnectService.nextTrack()
    : goToNext;

  const handlePrevious = spotifyConnect.isActive
    ? () => void spotifyConnectService.previousTrack()
    : goToPrevious;

  return (
    <PlayerBar.Controls
      isPlaying={isPlaying}
      isShuffleActive={Boolean(shuffleEnabled)}
      repeatMode={repeatMode ?? 'off'}
      onPlayPause={handlePlayPause}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onShuffleToggle={handleToggleShuffle}
      onRepeatToggle={handleToggleRepeat}
      isDiscoveryActive={hasDiscoveryProviders && Boolean(discoveryEnabled)}
      onDiscoveryToggle={
        hasDiscoveryProviders ? handleToggleDiscovery : undefined
      }
      showDiscovery={hasDiscoveryProviders}
      labels={{
        shuffleOn: t('shuffleOn'),
        shuffleOff: t('shuffleOff'),
        repeatOff: t('repeatOff'),
        repeatAll: t('repeatAll'),
        repeatOne: t('repeatOne'),
        discoveryOn: t('discoveryOn'),
        discoveryOff: t('discoveryOff'),
      }}
    />
  );
};
