import { useSyncExternalStore } from 'react'

let revision = 0
let running = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const publish = () => {
  for (const listener of listeners) listener()
}
export function notifyDataChanged() {
  revision++
  publish()
}
export function setStartupSyncRunning(value: boolean) {
  running = value
  publish()
}
export const useDataRevision = () => useSyncExternalStore(subscribe, () => revision)
export const useStartupSyncRunning = () => useSyncExternalStore(subscribe, () => running)
