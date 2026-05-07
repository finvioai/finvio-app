'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, X, SendHorizontal, Pencil, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceInputProps {
  onTranscript: (text: string, autoSend: boolean) => void
  disabled?: boolean
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'loading-model'

// 'auto' = stop + auto-send, 'fill' = stop + fill input, 'cancel' = stop + discard
type StopMode = 'auto' | 'fill' | 'cancel'

interface VoiceMode {
  mode: 'server' | 'local' | 'unavailable'
  serverFallback: boolean
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: Event & { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// navigator.brave is synchronously present in Brave; no async call needed.
function isBraveBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return 'brave' in (navigator as Navigator & { brave?: unknown })
}

// Returns false when the audio blob is essentially silent (RMS below speech threshold).
// Prevents sending dead-air recordings to Whisper, which would hallucinate.
async function hasAudioSignal(blob: Blob): Promise<boolean> {
  const ctx = new AudioContext()
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
    const ch = audio.getChannelData(0)
    let sum = 0
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i]
    return Math.sqrt(sum / ch.length) > 0.004
  } catch {
    return true // analysis failed — let the server decide
  } finally {
    void ctx.close()
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  'network': 'Network error. Check your connection and try again.',
  'audio-capture': 'Microphone not found. Check that one is connected.',
  'not-allowed': 'Microphone access denied. Allow it in your browser settings.',
  'service-not-allowed': 'Speech service not available in this browser context.',
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [isWhisperMode, setIsWhisperMode] = useState(false)
  const [modelProgress, setModelProgress] = useState(0)

  const transcriptRef = useRef('')
  const interimRef = useRef('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopModeRef = useRef<StopMode>('fill')
  const shouldRestartRef = useRef(false)
  const fallingBackRef = useRef(false) // true while switching from Web Speech → MediaRecorder
  const touchActiveRef = useRef(false)
  const voiceModeRef = useRef<VoiceMode>({ mode: 'server', serverFallback: true })

  useEffect(() => { setIsMobile('ontouchstart' in window) }, [])

  // On Brave: fetch routing decision and pre-warm WASM model if needed
  useEffect(() => {
    if (!isBraveBrowser()) return
    const controller = new AbortController()
    const cores = navigator.hardwareConcurrency ?? 4
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    const lowEnd = cores < 4 || mem < 4
    fetch(`/api/chat/voice-route?lowEndDevice=${lowEnd}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: VoiceMode) => {
        voiceModeRef.current = { mode: data.mode, serverFallback: data.serverFallback }
        if (data.mode === 'local') {
          import('@/lib/voice/transcriber').then(({ initModel }) => initModel()).catch(() => {})
        }
      })
      .catch(() => {}) // routing failure or abort → stay on server path
    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      recognitionRef.current?.stop()
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    }
  }, [])

  function pushTranscript(finalChunk: string, int: string) {
    const accumulated = transcriptRef.current + finalChunk
    transcriptRef.current = accumulated
    interimRef.current = int
    setTranscript(accumulated)
    setInterim(int)
  }

  function clearTranscript() {
    transcriptRef.current = ''
    interimRef.current = ''
    setTranscript('')
    setInterim('')
  }

  function handleEnd() {
    const text = (transcriptRef.current + interimRef.current).trim()
    const mode = stopModeRef.current
    setState('idle')
    clearTranscript()
    if (mode !== 'cancel' && text) onTranscript(text, mode === 'auto')
  }

  function startWebSpeech() {
    const SpeechRecognition = getSpeechRecognition()!
    const recognition = new SpeechRecognition()
    // continuous: false + restart-on-end is far more stable than continuous: true in Chrome
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let newFinal = ''
      let newInterim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) newFinal += r[0].transcript
        else newInterim += r[0].transcript
      }
      pushTranscript(newFinal, newInterim)
    }

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') return // silence during pause — just restart via onend
      if (e.error === 'aborted') return   // we called stop() ourselves
      shouldRestartRef.current = false
      if (e.error === 'network') {
        // Google's speech servers unreachable — seamlessly fall back to MediaRecorder + Whisper
        fallingBackRef.current = true
        recognitionRef.current = null
        void startMediaRecorder()
        return
      }
      setState('idle')
      clearTranscript()
      setErrorMsg(ERROR_MESSAGES[e.error] ?? 'Voice recognition error. Please try again.')
    }

    recognition.onend = () => {
      if (fallingBackRef.current) {
        fallingBackRef.current = false
        return // MediaRecorder is now handling the recording — don't touch state
      }
      if (shouldRestartRef.current) {
        try { recognition.start() } catch { /* already restarting */ }
      } else {
        handleEnd()
      }
    }

    recognition.start()
    recognitionRef.current = recognition
  }

  async function startMediaRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())

        if (stopModeRef.current === 'cancel') {
          setState('idle')
          clearTranscript()
          return
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        // ── Route: unavailable ──────────────────────────────────────────
        const { mode, serverFallback } = voiceModeRef.current
        if (mode === 'unavailable') {
          setErrorMsg('Voice unavailable — daily limit reached and this device cannot run local transcription.')
          setState('idle')
          clearTranscript()
          return
        }

        // ── Route: local (WASM) ─────────────────────────────────────────
        if (mode === 'local') {
          if (!await hasAudioSignal(blob)) { setState('idle'); clearTranscript(); return }
          try {
            setState('loading-model')
            setModelProgress(0)
            const { transcribeBlob } = await import('@/lib/voice/transcriber')
            const text = await transcribeBlob(blob, (pct) => setModelProgress(pct))
            setState('idle')
            clearTranscript()
            if (text) onTranscript(text, stopModeRef.current === 'auto')
            return
          } catch {
            if (!serverFallback) {
              setErrorMsg('Voice unavailable — daily limit reached and local transcription failed on this device.')
              setState('idle')
              clearTranscript()
              return
            }
            // serverFallback === true → fall through to server path
          }
        }

        // ── Route: server ───────────────────────────────────────────────
        if (!await hasAudioSignal(blob)) { setState('idle'); clearTranscript(); return }
        setState('transcribing')
        try {
          const fd = new FormData()
          fd.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json() as { text: string }
            if (text?.trim()) onTranscript(text.trim(), stopModeRef.current === 'auto')
          } else {
            const body = await res.json().catch(() => ({})) as { error?: string }
            setErrorMsg(body.error ?? 'Transcription failed. Please try again.')
          }
        } catch {
          setErrorMsg('Network error during transcription.')
        }
        setState('idle')
        clearTranscript()
      }
      recorder.start()
      mediaRecorderRef.current = recorder
    } catch {
      setErrorMsg('Could not access microphone. Check your browser settings.')
      setState('idle')
    }
  }

  function startRecording() {
    setErrorMsg('')
    clearTranscript()
    setState('recording')
    if (!isBraveBrowser() && getSpeechRecognition()) {
      setIsWhisperMode(false)
      shouldRestartRef.current = true
      startWebSpeech()
    } else {
      setIsWhisperMode(true)
      void startMediaRecorder()
    }
  }

  function stopRecording() {
    shouldRestartRef.current = false // stop the restart loop
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
  }

  const handleCancel = useCallback(() => {
    stopModeRef.current = 'cancel'
    shouldRestartRef.current = false
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    setState('idle')
    clearTranscript()
    setErrorMsg('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state !== 'recording') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, handleCancel])

  function handleDesktopSend() {
    stopModeRef.current = 'auto'
    stopRecording()
  }

  function handleDesktopFill() {
    stopModeRef.current = 'fill'
    stopRecording()
  }

  function handleDesktopClick() {
    if (touchActiveRef.current) { touchActiveRef.current = false; return }
    if (disabled) return
    if (state === 'recording') {
      stopModeRef.current = 'fill'
      stopRecording()
    } else if (state === 'idle') {
      stopModeRef.current = 'fill'
      startRecording()
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (disabled || state !== 'idle') return
    e.preventDefault()
    touchActiveRef.current = true
    stopModeRef.current = 'auto'
    startRecording()
  }

  function handleTouchEnd() {
    if (!touchActiveRef.current || state !== 'recording') return
    stopModeRef.current = 'auto'
    stopRecording()
  }

  const displayText = transcript + interim
  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'
  const isLoadingModel = state === 'loading-model'
  const isProcessing = isTranscribing || isLoadingModel

  return (
    <div className="relative">
      {/* Voice overlay */}
      {(isRecording || isProcessing) && (
        <div className="absolute bottom-full mb-3 right-0 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl p-4 z-50">
          <div className="flex items-center gap-2 mb-3">
            {isProcessing ? (
              <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
            ) : (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
            <span className="text-xs font-medium text-gray-700">
              {isLoadingModel ? 'Loading model…' : isTranscribing ? 'Processing…' : 'Listening'}
            </span>
            <span className="ml-auto text-xs text-gray-400 shrink-0">
              {isMobile ? 'Release to send' : isWhisperMode ? 'Click Send when done' : 'Esc to cancel'}
            </span>
          </div>

          {isLoadingModel ? (
            <div className="min-h-[80px] flex flex-col items-center justify-center gap-2">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${modelProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Downloading speech model… {modelProgress}%<br />
                <span className="text-gray-300">(one-time download)</span>
              </p>
            </div>
          ) : isWhisperMode ? (
            <div className="min-h-[80px] flex items-center justify-center">
              {isTranscribing ? (
                <p className="text-xs text-gray-400">Transcribing…</p>
              ) : (
                <div className="flex items-end gap-0.5 h-6">
                  {[2, 4, 6, 4, 3, 5, 6, 3, 4, 2].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-red-400 animate-pulse"
                      style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-[80px] text-sm leading-relaxed break-words">
              {displayText ? (
                <>
                  <span className="text-gray-900">{transcript}</span>
                  <span className="text-gray-400">{interim}</span>
                </>
              ) : (
                <span className="text-gray-400 italic">Speak now…</span>
              )}
            </div>
          )}

          {!isMobile && isRecording && (
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
              <button type="button" onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              {isWhisperMode && (
                <button type="button" onClick={handleDesktopFill}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button type="button" onClick={handleDesktopSend} disabled={!isWhisperMode && !displayText}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
                <SendHorizontal className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          )}
        </div>
      )}

      {errorMsg && state === 'idle' && (
        <div className="absolute bottom-full mb-3 right-0 w-64 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 z-50 shadow-md">
          <p className="text-xs text-red-600">{errorMsg}</p>
          <button type="button" onClick={() => setErrorMsg('')}
            className="mt-1 text-xs text-red-500 underline hover:no-underline">Dismiss</button>
        </div>
      )}

      <button
        type="button"
        disabled={disabled || isProcessing}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleDesktopClick}
        title="Voice is processed by your browser's speech engine or OpenAI Whisper. Audio is not stored by Finvio."
        aria-label={isRecording ? 'Stop voice recording' : 'Start voice input'}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 select-none',
          isRecording
            ? 'bg-red-500 text-white shadow-md scale-110 ring-4 ring-red-100'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700',
          (disabled || isProcessing) && 'opacity-40 cursor-not-allowed',
        )}
      >
        {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
    </div>
  )
}
