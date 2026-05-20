import { useQueueStore } from '../stores/queueStore';
import { FC } from 'react';

export const AmbientBackground: FC = () => {
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const thumbnail = currentItem?.track?.thumbnail;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-background transition-colors duration-1000">
      {thumbnail && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 blur-[80px] transition-all duration-1000 ease-in-out dark:opacity-30"
            style={{
              backgroundImage: `url(${thumbnail})`,
              transform: 'scale(1.2)', // Prevent blur edges from showing
            }}
          />
          <div className="absolute inset-0 bg-background/50 transition-colors duration-1000 dark:bg-background/70" />
        </>
      )}
    </div>
  );
};
