import { FC } from 'react';

import { pickArtwork } from '@nuclearplayer/model';

import { useQueueStore } from '../stores/queueStore';

// The artwork is blurred past recognition and stretched over the whole window,
// so the smallest variant looks identical to the largest while costing the
// compositor a fraction of the texture memory.
const AMBIENT_SOURCE_PX = 64;

export const AmbientBackground: FC = () => {
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const thumbnail = pickArtwork(
    currentItem?.track?.artwork,
    'thumbnail',
    AMBIENT_SOURCE_PX,
  )?.url;

  return (
    <div className="bg-background pointer-events-none fixed inset-0 -z-10">
      {thumbnail && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 blur-2xl transition-opacity duration-1000 ease-in-out dark:opacity-30"
            style={{
              backgroundImage: `url(${thumbnail})`,
              transform: 'scale(1.2)', // Prevent blur edges from showing
            }}
          />
          <div className="bg-background/50 dark:bg-background/70 absolute inset-0 transition-colors duration-1000" />
        </>
      )}
    </div>
  );
};
