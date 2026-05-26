import { type FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Badge, Button, ScrollableArea, ViewShell } from '@nuclearplayer/ui';

import { useAuthStore } from '../../stores/authStore';
import { ACCOUNT_SERVICES, type AccountService } from './accountServices';
import { SpotifyLibrary } from './SpotifyLibrary';
import { YouTubeLibrary } from './YouTubeLibrary';

const AccountServiceCard: FC<{ service: AccountService }> = ({ service }) => {
  const { t } = useTranslation('accounts');
  const authStore = useAuthStore();
  const isConnected = service.authKey
    ? Boolean(authStore[service.authKey].accessToken)
    : false;

  const handleClick = () => {
    if (!service.authKey) {
      return;
    }
    if (isConnected) {
      void authStore.clearTokens(service.authKey);
    } else {
      void service.startLogin?.();
    }
  };

  return (
    <div
      data-testid={`account-card-${service.id}`}
      className="border-border bg-background-secondary/80 flex flex-col gap-3 rounded-md border-(length:--border-width) p-4"
    >
      <div className="flex items-center gap-3">
        <span style={{ color: service.color }} className="shrink-0">
          {service.icon}
        </span>
        <h3 className="flex-1 text-lg font-bold">{service.name}</h3>
        {!service.enabled && (
          <Badge variant="pill" color="secondary">
            {t('comingSoon')}
          </Badge>
        )}
        {isConnected && (
          <Badge
            variant="pill"
            color="green"
            data-testid={`account-connected-${service.id}`}
          >
            {t('connected')}
          </Badge>
        )}
      </div>
      <p className="text-foreground-secondary text-sm">
        {t(`services.${service.id}.description`, '')}
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={!service.enabled}
          data-testid={`account-action-${service.id}`}
          onClick={handleClick}
        >
          {isConnected ? t('logout') : t('login')}
        </Button>
      </div>
      {service.id === 'spotify' && isConnected && <SpotifyLibrary />}
      {service.id === 'youtube' && isConnected && <YouTubeLibrary />}
    </div>
  );
};

export const Accounts: FC = () => {
  const { t } = useTranslation('accounts');

  return (
    <ViewShell title={t('title')}>
      <div
        data-testid="accounts-view"
        className="flex w-full flex-1 overflow-hidden"
      >
        <ScrollableArea className="flex-1 overflow-hidden">
          <div className="flex flex-col gap-4 px-2 pb-6">
            {ACCOUNT_SERVICES.map((service) => (
              <AccountServiceCard key={service.id} service={service} />
            ))}
          </div>
        </ScrollableArea>
      </div>
    </ViewShell>
  );
};
