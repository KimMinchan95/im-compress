import { isSupportedFile } from './files'
import { useBatchStore } from '../store/batch-store'
import { useEditorStore } from '../store/editor-store'

export function openIncoming(files: File[]) {
  if (files.length === 0) return
  const batch = useBatchStore.getState()
  const editor = useEditorStore.getState()
  if (batch.isOpening) return

  const supported = files.filter(isSupportedFile)
  if (batch.editingId) {
    if (supported.length === 1) void editor.loadFile(supported[0])
    else if (supported.length > 1) void batch.addFiles(files)
    return
  }

  if (batch.items.length > 0) {
    void batch.addFiles(files)
    return
  }

  if (supported.length === 1 && files.length === 1) {
    void editor.loadFile(supported[0])
    return
  }

  if (supported.length === 0) {
    useEditorStore.setState({ error: 'unsupported' })
    return
  }

  if (editor.source) editor.leave()
  void batch.openFiles(files)
}
