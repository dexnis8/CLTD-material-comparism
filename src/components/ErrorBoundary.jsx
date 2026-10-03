import { Component } from 'react'
import { STORAGE_KEY } from '../app/config'
import { download } from '../services/files'
import { errorDetails } from '../services/errors'

export default class ErrorBoundary extends Component {
  state = { error: null, backupError: '' }
  static getDerivedStateFromError(error) { return { error } }
  backup = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) throw new Error('No saved project was found in this browser.')
      download('thermacompare-recovery.json', saved)
    } catch (error) { this.setState({ backupError: `The saved backup could not be exported. Check that this browser allows site storage and downloads, then retry. Details: ${errorDetails(error)}` }) }
  }
  render() {
    if (!this.state.error) return this.props.children
    return <main className="recovery-screen"><section className="panel p-6" role="alert"><h1>The app could not display this page</h1><p>An unexpected error interrupted the screen. Your last saved project may still be available in this browser; changes made since the last save may not be included.</p><ol><li>Use Export saved backup below before reloading.</li><li>Reload the app and retry. If necessary, use Settings &gt; Import project JSON to restore a valid backup.</li><li>If the error returns, send the technical details below and the steps that triggered it to the app maintainer. Keep your backup and do not clear browser storage.</li></ol><div className="action-row"><button className="button" onClick={this.backup}>Export saved backup</button><button className="button primary" onClick={() => window.location.reload()}>Reload app</button></div>{this.state.backupError && <p>{this.state.backupError}</p>}<details><summary>Technical details</summary><pre>{errorDetails(this.state.error)}</pre></details></section></main>
  }
}
