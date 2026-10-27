import { useEffect, useRef } from 'react'
import { useTaskNotifications } from '../components/TaskNotifications'
import { getBridge } from '../lib/bridge'
import { createStartupDataSync } from '../../shared/startup-data-sync'
import { notifyDataChanged, setStartupSyncRunning } from '../lib/data-sync-state'

export function StartupDataSync() {
  const tasks = useTaskNotifications()
  const initial = useRef<ReturnType<typeof createStartupDataSync> | null>(null)
  useEffect(() => {
    initial.current ??= createStartupDataSync(
      getBridge(),
      tasks,
      notifyDataChanged,
      setStartupSyncRunning
    )
    void initial.current()
  }, [tasks])
  return null
}
