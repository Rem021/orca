import { describe, expect, it, vi } from 'vitest'
import { resampleToRate } from './stt-audio-resample'
import { SttWorkerChildProcess, type SttWorkerRequest } from './stt-worker-process'

describe('resampleToRate', () => {
  it('resamples changing capture rates onto the same 16 kHz timeline', () => {
    const first = resampleToRate(
      Float32Array.from({ length: 480 }, (_, index) => index / 480),
      48000,
      16000
    )
    const second = resampleToRate(
      Float32Array.from({ length: 441 }, (_, index) => index / 441),
      44100,
      16000
    )

    expect(first).toHaveLength(160)
    expect(second).toHaveLength(160)
    expect(first[1]).toBeCloseTo(0.00625, 6)
    expect(first[80]).toBeCloseTo(0.5, 6)
    expect(second[1]).toBeCloseTo(0.00625, 6)
    expect(second[80]).toBeCloseTo(0.5, 6)
  })
})

describe('SttWorkerChildProcess.terminate', () => {
  it('requests a clean shutdown before falling back to a signal kill', async () => {
    vi.useFakeTimers()
    try {
      const sent: SttWorkerRequest[] = []
      let kills = 0
      const worker = new SttWorkerChildProcess({
        send: (message) => sent.push(message),
        kill: () => void (kills += 1)
      })

      const terminated = worker.terminate()
      expect(sent).toEqual([{ type: 'shutdown' }])
      expect(kills).toBe(0)

      worker.receiveExit(0)
      await vi.advanceTimersByTimeAsync(1_000)

      await expect(terminated).resolves.toBe(0)
      expect(kills).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('kills a child stuck in native code once the shutdown grace expires', async () => {
    vi.useFakeTimers()
    try {
      let kills = 0
      const worker = new SttWorkerChildProcess({
        send: () => undefined,
        kill: () => {
          kills += 1
          worker.receiveExit(143)
        }
      })

      const terminated = worker.terminate()
      await vi.advanceTimersByTimeAsync(500)

      await expect(terminated).resolves.toBe(143)
      expect(kills).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
