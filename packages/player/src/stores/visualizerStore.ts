import { create } from 'zustand';

type VisualizerStore = {
  frequencyData: Uint8Array | null;
  setFrequencyData: (data: Uint8Array) => void;
};

export const useVisualizerStore = create<VisualizerStore>((set) => ({
  frequencyData: null,
  setFrequencyData: (data) => set({ frequencyData: data }),
}));
