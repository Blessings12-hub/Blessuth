import { useRef, useState } from 'react'

// Wraps the browser's MediaRecorder API into a simple start/stop flow.
// stop() resolves with an audio Blob, or null if nothing was recorded.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError("Microphone access is blocked — check your browser or phone's permissions.")
    }
  }

  function stop() {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null
        streamRef.current?.getTracks().forEach((t) => t.stop())
        setRecording(false)
        resolve(blob)
      }
      recorder.stop()
    })
  }

  function cancel() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    chunksRef.current = []
    setRecording(false)
  }

  return { recording, error, start, stop, cancel }
}
