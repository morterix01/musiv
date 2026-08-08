import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef } from 'react';

import { AudioSource } from '@nuclearplayer/hifi';
import type { TFunction } from '@nuclearplayer/i18n';
import { useTranslation } from '@nuclearplayer/i18n';
import type { QueueItem, StreamCandidate, Track } from '@nuclearplayer/model';

import { streamingHost } from '../services/streamingHost';
import { useQueueStore } from '../stores/queueStore';
import { getSetting } from '../stores/settingsStore';
import { useSoundStore } from '../stores/soundStore';

let activeController: AbortController | null = null;
let prefetchController: AbortController | null = null;
let cachedStreamServerPort: number | null = null;

const getStreamServerPort = async (): Promise<number> => {
  if (cachedStreamServerPort === null) {
    cachedStreamServerPort = await invoke<number>('stream_server_port');
  }
  return cachedStreamServerPort;
};

// Encode the URL in base64 and proxy through the local streaming server to bypass CORS
// Check packages/player/src-tauri/src/stream_server.rs to see how this works
const proxyStreamUrl = (url: string, port: number): string => {
  const encoded = btoa(url)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `http://127.0.0.1:${port}/stream/${encoded}`;
};

const isFmp4Stream = (stream: StreamCandidate['stream']): boolean => {
  if (!stream) {
    return false;
  }

  return (
    stream.container === 'm4a' ||
    stream.mimeType?.includes('audio/mp4') === true
  );
};

const buildAudioSource = async (
  candidate: StreamCandidate,
): Promise<AudioSource> => {
  const { stream } = candidate;
  if (!stream) {
    return { url: candidate.id, protocol: 'http' };
  }

  if (stream.protocol === 'hls') {
    return { url: stream.url, protocol: 'hls' };
  }

  const port = await getStreamServerPort();
  const proxyUrl = proxyStreamUrl(stream.url, port);

  const durationMs = stream.durationMs ?? candidate.durationMs;
  if (isFmp4Stream(stream) && durationMs) {
    return {
      url: proxyUrl,
      protocol: 'mse',
      durationSeconds: durationMs / 1000,
      codec: stream.codec,
    };
  }

  return { url: proxyUrl, protocol: stream.protocol };
};

const setItemError = (itemId: string, errorKey: string, t: TFunction): void => {
  useQueueStore.getState().updateItemState(itemId, {
    status: 'error',
    error: t(errorKey),
  });
};

const updateItemCandidates = (
  item: QueueItem,
  candidates: StreamCandidate[],
): void => {
  useQueueStore.getState().updateItemState(item.id, {
    track: { ...item.track, streamCandidates: candidates },
  });
};

const resolveCandidates = async (
  track: Track,
): Promise<StreamCandidate[] | undefined> => {
  if (track.streamCandidates?.length) {
    return track.streamCandidates;
  }

  const result = await streamingHost.resolveCandidatesForTrack(track);
  return result.success ? result.candidates : undefined;
};

const tryResolveNextCandidate = async (
  candidates: StreamCandidate[],
): Promise<
  { resolved: StreamCandidate; updated: StreamCandidate[] } | undefined
> => {
  const candidate = candidates.find((c) => !c.failed);
  if (!candidate) {
    return undefined;
  }

  const resolved = await streamingHost.resolveStreamForCandidate(candidate);
  if (!resolved) {
    return undefined;
  }

  const updated = candidates.map((c) => (c.id === resolved.id ? resolved : c));
  return { resolved, updated };
};

const resolveStreamWithFallback = async (
  candidates: StreamCandidate[],
  item: QueueItem,
  signal: AbortSignal,
): Promise<StreamCandidate | undefined> => {
  const tryNext = async (
    remaining: StreamCandidate[],
  ): Promise<StreamCandidate | undefined> => {
    if (signal.aborted) {
      return undefined;
    }

    const result = await tryResolveNextCandidate(remaining);
    if (!result) {
      return undefined;
    }

    updateItemCandidates(item, result.updated);

    if (result.resolved.stream && !result.resolved.failed) {
      return result.resolved;
    }

    return tryNext(result.updated);
  };

  return tryNext(candidates);
};

/**
 * Resolve the stream of the track that plays next, while the current one is
 * still going.
 *
 * Without this, pressing next stops the audio and only then starts talking to
 * the network, so the gap the user hears is a full resolution: candidate
 * lookup, provider call, and up to `playback.streamResolutionRetries` attempts
 * with exponential backoff for every candidate that fails. With the stream
 * already resolved and unexpired, resolveStreamForCandidate returns without any
 * request at all.
 *
 * Shuffle picks the next index at random, so there is nothing to guess.
 */
const prefetchNext = async (): Promise<void> => {
  if (getSetting('core.playback.shuffle') === true) {
    return;
  }

  const { items, currentIndex } = useQueueStore.getState();
  const next = items[currentIndex + 1];
  if (!next) {
    return;
  }

  prefetchController?.abort();
  prefetchController = new AbortController();
  const { signal } = prefetchController;

  const candidates = await resolveCandidates(next.track);
  if (signal.aborted || !candidates) {
    return;
  }

  updateItemCandidates(next, candidates);
  await resolveStreamWithFallback(candidates, next, signal);
};

const resolveStream = async (
  item: QueueItem,
  t: TFunction,
  autoPlay: boolean,
): Promise<void> => {
  activeController?.abort();
  activeController = new AbortController();
  const { signal } = activeController;

  const { updateItemState } = useQueueStore.getState();
  const { setSrc, play, stop } = useSoundStore.getState();

  if (autoPlay) {
    stop();
    // Until the new stream resolves the element still holds the previous one,
    // and anything that resumes playback in that window plays the old track.
    setSrc(null);
  }
  updateItemState(item.id, { status: 'loading', error: undefined });

  const candidates = await resolveCandidates(item.track);
  if (signal.aborted) {
    return;
  }
  if (!candidates) {
    setItemError(item.id, 'errors.noCandidatesFound', t);
    return;
  }

  updateItemCandidates(item, candidates);

  const resolvedCandidate = await resolveStreamWithFallback(
    candidates,
    item,
    signal,
  );
  if (signal.aborted) {
    return;
  }
  if (!resolvedCandidate?.stream) {
    setItemError(item.id, 'errors.allCandidatesFailed', t);
    return;
  }

  setSrc(await buildAudioSource(resolvedCandidate));
  if (autoPlay) {
    play();
  }
};

export const useStreamResolution = (): void => {
  const { t } = useTranslation('streaming');
  const currentItemIdRef = useRef<string | null>(null);
  const nextItemIdRef = useRef<string | null>(null);
  const isFirstResolutionRef = useRef(true);

  useEffect(() => {
    const onCurrentItemChanged = (currentItem: QueueItem | undefined): void => {
      if (!currentItem || currentItem.id === currentItemIdRef.current) {
        return;
      }

      const autoPlay = !isFirstResolutionRef.current;
      isFirstResolutionRef.current = false;
      currentItemIdRef.current = currentItem.id;
      void resolveStream(currentItem, t, autoPlay);
    };

    const onNextItemChanged = (nextItem: QueueItem | undefined): void => {
      if (!nextItem || nextItem.id === nextItemIdRef.current) {
        return;
      }

      nextItemIdRef.current = nextItem.id;
      void prefetchNext();
    };

    const react = (state: ReturnType<typeof useQueueStore.getState>): void => {
      onCurrentItemChanged(state.getCurrentItem());
      onNextItemChanged(state.items[state.currentIndex + 1]);
    };

    const unsubscribe = useQueueStore.subscribe(react);

    react(useQueueStore.getState());

    return unsubscribe;
  }, [t]);
};
