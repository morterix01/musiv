import { useEffect, useRef } from 'react';

import type { InjectedProps } from '../pluginFactory';

const FFT_SIZE = 256;

export type FrequencyAnalyzerProps = {
  onFrequencyData?: (data: Uint8Array) => void;
};

export const FrequencyAnalyzer = (props: FrequencyAnalyzerProps) => {
  const { onFrequencyData } = props;
  const { audioContext, previousNode, onRegister } =
    props as unknown as InjectedProps<AnalyserNode>;

  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const onDataRef = useRef(onFrequencyData);

  useEffect(() => {
    onDataRef.current = onFrequencyData;
  });

  useEffect(() => {
    if (!audioContext || !previousNode) {
      return;
    }

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    previousNode.connect(analyser);
    analyserRef.current = analyser;
    onRegister?.(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      if (!analyserRef.current) {
        return;
      }
      analyserRef.current.getByteFrequencyData(dataArray);
      onDataRef.current?.(new Uint8Array(dataArray));
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      try {
        previousNode.disconnect(analyser);
      } catch {
        // node may already be disconnected
      }
      analyser.disconnect();
      analyserRef.current = null;
    };
  }, [audioContext, previousNode]);

  return null;
};
