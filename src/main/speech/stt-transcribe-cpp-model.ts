import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type * as TranscribeCpp from 'transcribe-cpp'
import { loadSileroVad } from './stt-vad-pause-segmenter'
import type { SttRecognizerInit, SttRecognizerPost } from './stt-recognizer'

// Past ~8 threads decode slowed 2-4x under load in the 2026-11 benchmark; E-cores and SMT siblings
// don't help. Half the logical CPUs is close to the performance cores on Apple silicon and SMT x86.
function performanceCoreThreads(): number {
  const logical = availableParallelism()
  return Math.min(logical, 8, Math.max(4, Math.floor(logical / 2)))
}

export type LoadedTranscribeCppModel = {
  transcribe: typeof TranscribeCpp
  model: TranscribeCpp.TranscribeModel
  session: TranscribeCpp.Session
  vadModel: TranscribeCpp.TranscribeModel | null
  modelRate: number
  baseOptions: TranscribeCpp.TranscribeOptions
  streamOptions(vocabulary: readonly string[]): TranscribeCpp.TranscribeOptions
  dispose(): void
}

export async function loadTranscribeCppModel(
  init: SttRecognizerInit,
  post: SttRecognizerPost
): Promise<LoadedTranscribeCppModel> {
  const entry = join(init.speechModulesDir, 'transcribe-cpp', 'dist', 'index.js')
  const transcribe: typeof TranscribeCpp = await import(pathToFileURL(entry).href)
  const gguf = init.files.find((file) => file.endsWith('.gguf'))
  if (!gguf) {
    throw new Error(`No .gguf model file in: ${init.files.join(', ')}`)
  }
  // Device setup (Metal shader library, Vulkan drivers) and reading the weights each report done,
  // so a cold disk or a busy machine isn't taken for a GPU that hung.
  await transcribe.initialize()
  post({ type: 'loading' })
  const model = await transcribe.TranscribeModel.load(join(init.modelDir, gguf))
  post({ type: 'loading' })
  // The child runs one call at a time, so every stream can share one session.
  const session = model.createSession({ nThreads: performanceCoreThreads() })
  const { languages } = model.capabilities
  // The setting is ISO-639-1; Nemotron names locales (ko-KR) and rejects the bare code.
  const language = init.language
    ? (languages.find((code) => code === init.language) ??
      languages.find((code) => code.startsWith(`${init.language}-`)))
    : undefined
  const baseOptions: TranscribeCpp.TranscribeOptions = {
    timestamps: 'none',
    ...(language ? { language } : {})
  }
  // A plain list as context, not the `vocabulary` option: in the 2026-11 dev bench that dropped
  // Whisper's sentence-final periods. Whisper keeps a long prompt's end, so the first terms go last.
  const streamOptions = (vocabulary: readonly string[]): TranscribeCpp.TranscribeOptions =>
    vocabulary.length > 0 && model.supports('context_prompt')
      ? { ...baseOptions, prompt: `${vocabulary.toReversed().join(', ')}.` }
      : baseOptions
  const modelRate = model.capabilities.nativeSampleRate || init.sampleRate
  const vadModel = await loadSileroVad(transcribe, init.vadModelPath, modelRate)

  return {
    transcribe,
    model,
    session,
    vadModel,
    modelRate,
    baseOptions,
    streamOptions,
    dispose() {
      session.dispose()
      vadModel?.dispose()
      model.dispose()
    }
  }
}
