import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { toast } from 'sonner';

import { Logger } from './logger';
import { spotifyService } from './spotifyService';

const CALLBACK_HANDLERS: Record<string, (code: string) => Promise<void>> = {
  'spotify-callback': spotifyService.handleCallback,
};

const CALLBACK_LABELS: Record<string, string> = {
  'spotify-callback': 'Spotify',
};

const handleCallbackUrl = async (rawUrl: string): Promise<void> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }

  if (url.protocol !== 'nuclear:') {
    return;
  }

  const target = url.hostname || url.pathname.replace(/^\/+/, '');
  const handler = CALLBACK_HANDLERS[target];
  if (!handler) {
    Logger.app.warn(`Unhandled deep link target: ${target}`);
    return;
  }

  const label = CALLBACK_LABELS[target] ?? target;
  const authError = url.searchParams.get('error');
  if (authError) {
    Logger.app.error(`${label} login was rejected: ${authError}`);
    toast.error(`${label} login failed: ${authError}`);
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return;
  }

  try {
    await handler(code);
    toast.success(`${label} connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.app.error(`Failed to complete ${label} login: ${message}`);
    toast.error(`${label} login failed: ${message}`);
  }
};

export const initializeDeepLinks = async (): Promise<void> => {
  try {
    await onOpenUrl((urls) => {
      for (const url of urls) {
        void handleCallbackUrl(url);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.app.warn(`Deep link listener unavailable: ${message}`);
  }
};
