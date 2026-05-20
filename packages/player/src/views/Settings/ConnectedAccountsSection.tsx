import { SiSpotify, SiYoutube } from '@icons-pack/react-simple-icons';
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
    <SectionShell title={t('connectedAccounts.title', 'Connected Accounts')}>
      <div className="flex flex-col gap-6">
        
        {/* Spotify */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SiSpotify size={20} color="#1DB954" />
            <h3 className="font-bold">Spotify</h3>
          </div>
          <p className="text-foreground-secondary text-sm">
            Set your Spotify Client ID to enable playlist importing.
          </p>
          <div className="flex items-center gap-2">
            <Input 
              className="flex-1"
              type="text" 
              placeholder="Spotify Client ID" 
              value={spotify.clientId}
              onChange={(e) => authStore.setClientId('spotify', e.target.value)}
            />
            <Button 
              variant="outline"
              disabled={!spotify.clientId}
              onClick={() => {
                if (spotify.accessToken) {
                  authStore.clearTokens('spotify');
                } else {
                  spotifyService.startLogin();
                }
              }}
            >
              {spotify.accessToken ? 'Logout' : 'Login'}
            </Button>
          </div>
          {spotify.accessToken && <span className="text-accent-green text-xs">Logged in successfully</span>}
        </div>

        {/* YouTube */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <SiYoutube size={20} color="#FF0000" />
            <h3 className="font-bold">YouTube</h3>
          </div>
          <p className="text-foreground-secondary text-sm">
            Set your YouTube API Client ID to enable playlist importing.
          </p>
          <div className="flex items-center gap-2">
            <Input 
              className="flex-1"
              type="text" 
              placeholder="YouTube Client ID" 
              value={youtube.clientId}
              onChange={(e) => authStore.setClientId('youtube', e.target.value)}
            />
            <Button 
              variant="outline"
              disabled={!youtube.clientId}
              onClick={() => {
                if (youtube.accessToken) {
                  authStore.clearTokens('youtube');
                } else {
                  youtubeService.startLogin();
                }
              }}
            >
              {youtube.accessToken ? 'Logout' : 'Login'}
            </Button>
          </div>
          {youtube.accessToken && <span className="text-accent-green text-xs">Logged in successfully</span>}
        </div>

      </div>
    </SectionShell>
  );
};
