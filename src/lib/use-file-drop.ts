import { useRef, useState, type DragEvent } from 'react'

function hasFileDrop(types: DataTransfer['types']) {
  return Array.from(types).includes('Files')
}

export function useFileDrop(onFiles: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)

  const onDragEnter = (event: DragEvent) => {
    if (!hasFileDrop(event.dataTransfer.types)) return
    event.preventDefault()
    depth.current += 1
    setIsDragging(true)
  }

  const onDragOver = (event: DragEvent) => {
    if (!hasFileDrop(event.dataTransfer.types)) return
    event.preventDefault()
  }

  const onDragLeave = () => {
    depth.current -= 1
    if (depth.current <= 0) {
      depth.current = 0
      setIsDragging(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    if (!hasFileDrop(event.dataTransfer.types)) return
    event.preventDefault()
    depth.current = 0
    setIsDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) onFiles(files)
  }

  return {
    isDragging,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
