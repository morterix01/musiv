import { Music, Video } from 'lucide-react';
import { type FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { Button, Input, SectionShell } from '@nuclearplayer/ui';

import { spotifyService } from '../../services/spotifyService';
import { youtubeService } from '../../services/youtubeService';
import { useAuthStore } from '../../stores/authStore';

export const ConnectedAccountsSection: FC = () => {
  const { t } = useTranslation('preferences');
  const authStore = useAuthStore();

  const { spotify, youtube } = authStore;

  return (
    <SectionShell title={t('connectedAccounts.title')}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Music size={20} color="#1DB954" />
            <h3 className="font-bold">Spotify</h3>
          </div>
          <p className="text-foreground-secondary text-sm">
            {t('connectedAccounts.spotify.description')}
          </p>
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder={t('connectedAccounts.spotify.clientIdPlaceholder')}
              value={spotify.clientId}
              onChange={(event) =>
                authStore.setClientId('spotify', event.target.value)
              }
            />
            <Button
              variant="secondary"
              disabled={!spotify.clientId}
              onClick={() => {
                if (spotify.accessToken) {
                  authStore.clearTokens('spotify');
                } else {
                  spotifyService.startLogin();
                }
              }}
            >
              {spotify.accessToken
                ? t('connectedAccounts.logout')
                : t('connectedAccounts.login')}
            </Button>
          </div>
          {spotify.accessToken && (
            <span className="text-accent-green text-xs">
              {t('connectedAccounts.loggedIn')}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Video size={20} color="#FF0000" />
            <h3 className="font-bold">YouTube</h3>
          </div>
          <p className="text-foreground-secondary text-sm">
            {t('connectedAccounts.youtube.description')}
          </p>
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder={t('connectedAccounts.youtube.clientIdPlaceholder')}
              value={youtube.clientId}
              onChange={(event) =>
                authStore.setClientId('youtube', event.target.value)
              }
            />
            <Button
              variant="secondary"
              disabled={!youtube.clientId}
              onClick={() => {
                if (youtube.accessToken) {
                  authStore.clearTokens('youtube');
                } else {
                  youtubeService.startLogin();
                }
              }}
            >
              {youtube.accessToken
                ? t('connectedAccounts.logout')
                : t('connectedAccounts.login')}
            </Button>
          </div>
          {youtube.accessToken && (
            <span className="text-accent-green text-xs">
              {t('connectedAccounts.loggedIn')}
            </span>
          )}
        </div>
      </div>
    </SectionShell>
  );
};
