import { FC } from 'react';

import { useQueueStore } from '../stores/queueStore';

export const AmbientBackground: FC = () => {
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const thumbnail = currentItem?.track?.artwork?.items?.[0]?.url;

  return (
    <div className="bg-background pointer-events-none fixed inset-0 -z-10 transition-colors duration-1000">
      {thumbnail && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 blur-[80px] transition-all duration-1000 ease-in-out dark:opacity-30"
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
