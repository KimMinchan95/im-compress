import { create } from 'zustand'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 8

export function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 1000) / 1000))
}

interface StageState {
  zoom: number
  split: number
  isFullscreen: boolean
  setZoom: (zoom: number) => void
  setSplit: (split: number) => void
  openFullscreen: () => void
  closeFullscreen: () => void
  reset: () => void
}

export const useStageStore = create<StageState>((set) => ({
  zoom: 1,
  split: 50,
  isFullscreen: false,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setSplit: (split) => set({ split: Math.min(100, Math.max(0, split)) }),
  openFullscreen: () => set({ isFullscreen: true }),
  closeFullscreen: () => set({ isFullscreen: false }),
  reset: () => set({ zoom: 1, split: 50, isFullscreen: false }),
}))
