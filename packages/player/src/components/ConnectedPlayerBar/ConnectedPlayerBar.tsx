import { FC } from 'react';

import { PlayerBar } from '@nuclearplayer/ui';

import { ConnectedVisualizer } from '../ConnectedVisualizer';
import { ConnectedControls } from './ConnectedControls';
import { ConnectedNowPlaying } from './ConnectedNowPlaying';
import { ConnectedSeekBar } from './ConnectedSeekBar';
import { ConnectedVolume } from './ConnectedVolume';

export const ConnectedPlayerBar: FC = () => {
  return (
    <>
      <ConnectedSeekBar />
      <PlayerBar
        left={<ConnectedNowPlaying />}
        center={<ConnectedControls />}
        right={
          <div className="flex items-center gap-3">
            <ConnectedVisualizer />
            <ConnectedVolume />
          </div>
        }
      />
    </>
  );
};
