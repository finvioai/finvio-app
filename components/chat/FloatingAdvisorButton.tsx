'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, Mic, X, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Storage key used by the advisor page to pick up the voice query
export const VOICE_QUERY_KEY = 'finvio_voice_query'

type ButtonState = 'idle' | 'countdown' | 'recording' | 'transcribing'
type StopMode = 'send' | 'cancel'

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
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// navigator.brave is synchronously present in Brave; no async call needed.
function isBraveBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return 'brave' in (navigator as Navigator & { brave?: unknown })
}

async function hasAudioSignal(blob: Blob): Promise<boolean> {
  try {
    const ctx = new AudioContext()
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
    void ctx.close()
    const ch = audio.getChannelData(0)
    let sum = 0
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i]
    return Math.sqrt(sum / ch.length) > 0.004
  } catch {
    return true
  }
}

// Long-press threshold in ms
const LONG_PRESS_MS = 350

export function FloatingAdvisorButton() {
  const pathname = usePathname()
  const router = useRouter()

  const [btnState, setBtnState] = useState<ButtonState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [isWhisperMode, setIsWhisperMode] = useState(false)

  const transcriptRef = useRef('')
  const interimRef = useRef('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const shouldRestartRef = useRef(false)
  const fallingBackRef = useRef(false)
  const stopModeRef = useRef<StopMode>('cancel')
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchActiveRef = useRef(false)

  useEffect(() => { setIsMobile('ontouchstart' in window) }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(pressTimerRef.current ?? undefined)
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

  function deliverTranscript() {
    const text = (transcriptRef.current + interimRef.current).trim()
    clearTranscript()
    if (!text) return
    sessionStorage.setItem(VOICE_QUERY_KEY, text)
    router.push('/advisor')
  }

  function startWebSpeech() {
    const SpeechRecognition = getSpeechRecognition()!
    const recognition = new SpeechRecognition()
    recognition.continuous = false // restart-on-end is more reliable than continuous:true
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
      if (e.error === 'no-speech' || e.error === 'aborted') return
      shouldRestartRef.current = false
      if (e.error === 'network') {
        // Google's speech servers unreachable — fall back to MediaRecorder + Whisper
        fallingBackRef.current = true
        recognitionRef.current = null
        void startMediaRecorder()
        return
      }
      setBtnState('idle')
      clearTranscript()
    }

    recognition.onend = () => {
      if (fallingBackRef.current) {
        fallingBackRef.current = false
        return // MediaRecorder is now handling the recording
      }
      if (shouldRestartRef.current) {
        try { recognition.start() } catch { /* already restarting */ }
      } else {
        if (stopModeRef.current === 'send') deliverTranscript()
        else clearTranscript()
        setBtnState('idle')
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
        if (stopModeRef.current === 'cancel') { setBtnState('idle'); clearTranscript(); return }
        setBtnState('transcribing')
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          if (!await hasAudioSignal(blob)) { setBtnState('idle'); clearTranscript(); return }
          const fd = new FormData()
          fd.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/chat/transcribe', { method: 'POST', body: fd })
          if (res.ok) {
            const { text } = await res.json() as { text: string }
            if (text?.trim()) {
              sessionStorage.setItem(VOICE_QUERY_KEY, text.trim())
              router.push('/advisor')
            }
          }
        } catch { /* network error — silently fail */ }
        setBtnState('idle')
        clearTranscript()
      }
      recorder.start()
      mediaRecorderRef.current = recorder
    } catch {
      setBtnState('idle')
    }
  }

  function startRecording() {
    clearTranscript()
    setBtnState('recording')
    if (!isBraveBrowser() && getSpeechRecognition()) {
      setIsWhisperMode(false)
      shouldRestartRef.current = true
      startWebSpeech()
    } else {
      setIsWhisperMode(true)
      void startMediaRecorder()
    }
  }

  function stopRecording(mode: StopMode) {
    stopModeRef.current = mode
    shouldRestartRef.current = false
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
  }

  const handleCancel = useCallback(() => {
    clearTimeout(pressTimerRef.current ?? undefined)
    pressTimerRef.current = null
    stopModeRef.current = 'cancel'
    shouldRestartRef.current = false
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop()
    setBtnState('idle')
    clearTranscript()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape to cancel
  useEffect(() => {
    if (btnState !== 'recording') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [btnState, handleCancel])

  // ─── Mobile touch handlers ────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    touchActiveRef.current = true
    // Short-tap threshold: if released before LONG_PRESS_MS → navigate; else → record
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null
      startRecording()
    }, LONG_PRESS_MS)
  }

  function handleTouchEnd() {
    if (!touchActiveRef.current) return
    touchActiveRef.current = false

    if (pressTimerRef.current !== null) {
      // Released before threshold → short tap → navigate
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
      router.push('/advisor')
    } else if (btnState === 'recording') {
      // Released after recording started → send
      stopRecording('send')
    }
  }

  // ─── Desktop mouse handlers ───────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null
      startRecording()
    }, LONG_PRESS_MS)
  }

  function handleMouseUp() {
    if (pressTimerRef.current !== null) {
      // Released before threshold → short click → navigate
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
      router.push('/advisor')
    } else if (btnState === 'recording') {
      // Released after recording started → stop + fill textarea, don't auto-send on desktop
      stopRecording('send')
      // onend will deliver to /advisor (we always send on the floating button)
    }
  }

  const displayText = transcript + interim
  const isRecording = btnState === 'recording'
  const isTranscribing = btnState === 'transcribing'
  const isActive = isRecording || isTranscribing

  // Hidden on /advisor page — in-chat mic handles voice there
  if (pathname === '/advisor') return null

  return (
    <>
      {/* Full-screen voice overlay */}
      {isActive && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-12 px-6 bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800">
          {/* Status */}
          <div className="flex items-center gap-2.5 mt-4">
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 text-white/70 animate-spin" />
            ) : (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
            )}
            <span className="text-white/80 text-sm font-medium tracking-wide">
              {isTranscribing
                ? 'Processing…'
                : isMobile
                  ? 'Release to send'
                  : 'Recording — click ✓ or release to send'}
            </span>
          </div>

          {/* Transcript / recorder area */}
          <div className="flex-1 flex items-center justify-center w-full max-w-lg px-4 text-center">
            {isWhisperMode ? (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-end gap-1 h-10">
                  {[3, 5, 8, 6, 4, 7, 9, 5, 3, 6, 8, 4].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-white/60 animate-pulse"
                      style={{ height: `${h * 4}px`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-lg text-white/70">Speak now</p>
                  <p className="text-sm text-white/45 mt-1">Click ✓ to submit · X to cancel</p>
                </div>
              </div>
            ) : displayText ? (
              <p className="text-3xl sm:text-4xl font-semibold text-white leading-snug">
                <span>{transcript}</span>
                <span className="opacity-50">{interim}</span>
              </p>
            ) : (
              <p className="text-3xl sm:text-4xl font-medium text-white/40 italic">
                Speak now…
              </p>
            )}
          </div>

          {/* Bottom controls */}
          <div className="flex items-center justify-between w-full max-w-xs">
            <button
              onClick={handleCancel}
              aria-label="Cancel voice input"
              className="h-16 w-16 rounded-full bg-white/15 border border-white/20 flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
            >
              <X className="h-7 w-7 text-white" />
            </button>

            {/* Confirm button — always visible so desktop users can click Send */}
            <button
              onClick={() => stopRecording('send')}
              disabled={(isWhisperMode ? false : !displayText) || isTranscribing}
              aria-label="Send voice message"
              className={cn(
                'h-16 w-16 rounded-full flex items-center justify-center transition-all active:scale-95',
                (isWhisperMode || displayText) && !isTranscribing
                  ? 'bg-white shadow-lg hover:bg-white/90'
                  : 'bg-white/20 border border-white/20 cursor-not-allowed',
              )}
            >
              <Check className={cn('h-7 w-7', (isWhisperMode || displayText) && !isTranscribing ? 'text-blue-600' : 'text-white/40')} />
            </button>
          </div>
        </div>
      )}

      {/* The floating button — stays above overlay so touch/mouse events still fire */}
      <button
        aria-label={isActive ? 'Voice recording active' : 'Open AI Advisor or hold for voice'}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
        onTouchCancel={isMobile ? handleCancel : undefined}
        onMouseDown={!isMobile ? handleMouseDown : undefined}
        onMouseUp={!isMobile ? handleMouseUp : undefined}
        onMouseLeave={!isMobile && btnState === 'recording' ? () => stopRecording('send') : undefined}
        className={cn(
          'fixed bottom-6 right-6 z-[101] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 select-none md:bottom-8 md:right-8',
          isRecording
            ? 'bg-red-500 ring-4 ring-red-300 scale-110'
            : isTranscribing
              ? 'bg-indigo-600 scale-105'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95',
        )}
      >
        {isRecording ? (
          <Mic className="h-6 w-6 text-white animate-pulse" />
        ) : isTranscribing ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <Bot className="h-6 w-6 text-white" />
        )}
      </button>
    </>
  )
}
