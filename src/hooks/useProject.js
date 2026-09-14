import { useEffect, useState } from 'react'
import { STORAGE_KEY } from '../app/config'
import { createProject } from '../data/demo'
import { readProject } from '../services/files'

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return { project: saved ? readProject(saved) : createProject(), error: '' }
  } catch (error) { return { project: createProject(), error: `Saved project could not be loaded: ${error.message}. Autosave is paused to preserve the original data. Export a backup or explicitly resume saving in Settings.` } }
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
      } catch (error) { setStorageError(`Local save failed: ${error.message}. Export your project to keep a backup.`); setSaveStatus('Not saved') }
    }, 350)
    return () => clearTimeout(timer)
  }, [project, paused])
  const update = next => { setProject(next); setSaveStatus('Saving…') }
  return { project, setProject: update, saveStatus: paused ? 'Autosave paused' : saveStatus, storageError, resumeSaving: () => setPaused(false) }
}
