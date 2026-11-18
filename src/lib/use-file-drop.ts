import { useRef, useState, type DragEvent } from 'react'

function hasFileDrop(types: DataTransfer['types']) {
  return Array.from(types).includes('Files')
}

export function useFileDrop(onFile: (file: File) => void) {
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
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
  }

  return {
    isDragging,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
