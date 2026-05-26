import { Disc3, Music, Music2, Waves, Youtube } from 'lucide-react';
import type { ReactNode } from 'react';

import { spotifyService } from '../../services/spotifyService';
import { youtubeService } from '../../services/youtubeService';
import type { ServiceName } from '../../stores/authStore';

export type AccountService = {
  id: string;
  name: string;
  icon: ReactNode;
  color: string;
  enabled: boolean;
  authKey?: ServiceName;
  startLogin?: () => Promise<void>;
};

export const ACCOUNT_SERVICES: AccountService[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    icon: <Music />,
    color: '#1DB954',
    enabled: true,
    authKey: 'spotify',
    startLogin: spotifyService.startLogin,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: <Youtube />,
    color: '#FF0000',
    enabled: true,
    authKey: 'youtube',
    startLogin: youtubeService.startLogin,
  },
  {
    id: 'appleMusic',
    name: 'Apple Music',
    icon: <Music2 />,
    color: '#FA243C',
    enabled: false,
  },
  {
    id: 'tidal',
    name: 'Tidal',
    icon: <Waves />,
    color: '#38BDF8',
    enabled: false,
  },
  {
    id: 'deezer',
    name: 'Deezer',
    icon: <Disc3 />,
    color: '#A238FF',
    enabled: false,
  },
];
