'use client'

import { pipeline, type ProgressInfo } from '@huggingface/transformers'

// Single-threaded WASM — avoids COEP/COOP header requirements for SharedArrayBuffer.
// We cast through unknown because the onnxruntime-common Env type doesn't expose `wasm`
// in its public TypeScript surface, but the property exists at runtime.
import { env } from '@huggingface/transformers'
;(env.backends.onnx as unknown as { wasm?: { numThreads?: number } }).wasm ??= {}
;(env.backends.onnx as unknown as { wasm: { numThreads?: number } }).wasm.numThreads = 1

type ASRPipeline = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>
let pipe: ASRPipeline | null = null
let initPromise: Promise<ASRPipeline> | null = null

function onProgressCallback(onProgress?: (pct: number) => void) {
  return (info: ProgressInfo) => {
    if (info.status === 'progress' && onProgress) {
      onProgress(Math.round(info.progress))
    }
  }
}

async function ensurePipeline(onProgress?: (pct: number) => void): Promise<ASRPipeline> {
  if (pipe) return pipe
  if (!initPromise) {
    initPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      progress_callback: onProgressCallback(onProgress),
    }).then((p) => {
      pipe = p
      return p
    })
  }
  return initPromise
}

/** Download and cache the model. Call on mount so it's ready before the user records. */
export async function initModel(onProgress?: (pct: number) => void): Promise<void> {
  await ensurePipeline(onProgress)
}

/** Transcribe a recorded audio blob locally via WASM. Throws on failure. */
export async function transcribeBlob(
  blob: Blob,
  onProgress?: (pct: number) => void
): Promise<string> {
  const p = await ensurePipeline(onProgress)
  const ctx = new AudioContext({ sampleRate: 16000 })
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
  void ctx.close()
  const result = await p(audio.getChannelData(0)) as { text: string }
  return result.text?.trim() ?? ''
}
