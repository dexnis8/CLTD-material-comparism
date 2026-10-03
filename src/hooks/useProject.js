import { useEffect, useState } from 'react'
import { STORAGE_KEY } from '../app/config'
import { createProject } from '../data/demo'
import { readProject } from '../services/files'

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return { project: saved ? readProject(saved) : createProject(), error: '' }
  } catch (error) { return { project: createProject(), error: `Saved project could not be loaded from this browser. A sample project is shown and autosave is paused to preserve the original stored data. To fix: open Settings > Export original storage backup first. If storage access is blocked, allow site storage in your browser and reload. If the saved file is damaged, correct the backup using the details below or use Settings > Import project JSON to restore a valid backup. Once the intended project is visible, choose Resume local saving in Settings; this replaces the previously stored data with the current project. Details: ${error.message}` } }
}
export function useProject() {
  const [initial] = useState(load)
  const [project, setProject] = useState(initial.project)
  const [saveStatus, setSaveStatus] = useState('Ready to save')
  const [storageError, setStorageError] = useState(initial.error)
  const [paused, setPaused] = useState(Boolean(initial.error))
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
        setSaveStatus(`Saved locally · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
        setStorageError('')
      } catch (error) { setStorageError(`Local save failed. Recent changes are only in this open page and may be lost on reload. To fix: open Settings > Export project JSON now and confirm the file downloaded. Check that your browser allows site storage and has free space; private browsing or a storage quota may prevent saving. After fixing storage, make an edit to retry and check for Saved locally at the top of the page. Keep the page open until you have a backup; do not clear site data before exporting. Details: ${error.message}`); setSaveStatus('Not saved') }
    }, 350)
    return () => clearTimeout(timer)
  }, [project, paused])
  const update = next => { setProject(next); setSaveStatus('Saving…') }
  return { project, setProject: update, saveStatus: paused ? 'Autosave paused' : saveStatus, storageError, resumeSaving: () => setPaused(false) }
}
