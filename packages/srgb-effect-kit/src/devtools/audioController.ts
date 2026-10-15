import { analyserFrame, randomFrame, silentFrame, writeAudioFrame, type AudioFrame } from './audio';
import type { FrameScheduler } from './context';
import type { MockAudio } from './engine';
import type { DevtoolsStorage } from './storage';

/** Where `engine.audio` comes from. */
export type AudioMode = 'silent' | 'random' | 'microphone' | 'system';
export const AUDIO_MODES: readonly AudioMode[] = ['silent', 'random', 'microphone', 'system'];

/** A live audio input that produces one frame per call. */
export interface AudioSource {
  read(): AudioFrame;
  stop(): void;
}

/**
 * Opens a capture source; `openAudioCapture` in browsers, a fake in tests. `onEnded` runs when the
 * user stops sharing.
 */
export type OpenAudioCapture = (
  kind: 'microphone' | 'system',
  onEnded: () => void,
) => Promise<AudioSource>;

export interface AudioController {
  readonly mode: AudioMode;
  /** Message of the last failed capture attempt, cleared by the next mode change. */
  readonly error: string | undefined;
  /**
   * Switches the source. Capture modes ask for permission; on failure the mode falls back to
   * `silent` and `error` explains why. Resolves once the new mode is running.
   */
  setMode(mode: AudioMode): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'audio';
/** Capture modes need a user gesture, so only these survive a reload. */
const RESTORABLE: readonly AudioMode[] = ['silent', 'random'];

const isStoredAudio = (value: unknown): value is { mode: AudioMode } =>
  typeof value === 'object' &&
  value !== null &&
  RESTORABLE.includes((value as { mode?: AudioMode }).mode as AudioMode);

/**
 * Drives `engine.audio` from the selected mode, once per native animation frame (SignalRGB updates
 * audio independently of the effect's frame rate). Restores `silent` or `random` from storage.
 */
export function createAudioController(
  audio: MockAudio,
  storage: DevtoolsStorage,
  raf: FrameScheduler,
  openCapture: OpenAudioCapture,
): AudioController {
  let mode: AudioMode = 'silent';
  let error: string | undefined;
  let source: AudioSource | undefined;
  let frameId: number | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const stop = () => {
    if (frameId !== undefined) raf.cancel(frameId);
    frameId = undefined;
    source?.stop();
    source = undefined;
  };
  const run = (next: AudioSource) => {
    source = next;
    const frame = () => {
      writeAudioFrame(audio, next.read());
      frameId = raf.request(frame);
    };
    frame();
  };

  const setMode = async (next: AudioMode) => {
    const current = (generation += 1);
    stop();
    error = undefined;
    mode = next;
    if (RESTORABLE.includes(next)) storage.write(STORAGE_KEY, { mode: next });
    if (next === 'silent') writeAudioFrame(audio, silentFrame());
    else if (next === 'random') run({ read: () => randomFrame(), stop: () => {} });
    notify();
    if (next !== 'microphone' && next !== 'system') return;

    try {
      const capture = await openCapture(next, () => {
        if (current === generation) void setMode('silent');
      });
      // A newer setMode() call won the race: drop this capture.
      if (current !== generation) {
        capture.stop();
        return;
      }
      run(capture);
    } catch (reason) {
      if (current !== generation) return;
      error = reason instanceof Error ? reason.message : String(reason);
      mode = 'silent';
      writeAudioFrame(audio, silentFrame());
    }
    notify();
  };

  const stored = storage.read(STORAGE_KEY, isStoredAudio);
  if (stored) void setMode(stored.mode);

  return {
    get mode() {
      return mode;
    },
    get error() {
      return error;
    },
    setMode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Captures the microphone (`getUserMedia`) or system/tab audio (`getDisplayMedia`, with "Share
 * audio" ticked) and analyses it per frame: stereo time-domain samples for level and width, and
 * byte frequency data (fftSize 512) for the 200 bands and density. `onEnded` runs when the user
 * stops sharing.
 * @throws Error when permission is denied or no audio track was shared.
 */
export async function openAudioCapture(
  kind: 'microphone' | 'system',
  onEnded: () => void,
  media: MediaDevices = navigator.mediaDevices,
): Promise<AudioSource> {
  const stream =
    kind === 'microphone'
      ? await media.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
      : await media.getDisplayMedia({ audio: true, video: true });
  const stopStream = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  const [track] = stream.getAudioTracks();
  if (!track) {
    stopStream();
    throw new Error('No audio was shared. Pick a tab or screen and tick "Share audio".');
  }

  const context = new AudioContext();
  void context.resume();
  const input = context.createMediaStreamSource(new MediaStream([track]));
  const splitter = context.createChannelSplitter(2);
  const left = context.createAnalyser();
  const right = context.createAnalyser();
  const mixed = context.createAnalyser();
  left.fftSize = 1024;
  right.fftSize = 1024;
  mixed.fftSize = 512;
  mixed.smoothingTimeConstant = 0.8;
  input.connect(splitter);
  splitter.connect(left, 0);
  splitter.connect(right, 1);
  input.connect(mixed);

  const leftSamples = new Float32Array(left.fftSize);
  const rightSamples = new Float32Array(right.fftSize);
  const spectrum = new Uint8Array(mixed.frequencyBinCount);
  const mono = track.getSettings().channelCount === 1;
  track.addEventListener('ended', onEnded);

  return {
    read() {
      left.getFloatTimeDomainData(leftSamples);
      right.getFloatTimeDomainData(rightSamples);
      mixed.getByteFrequencyData(spectrum);
      return analyserFrame({ left: leftSamples, right: rightSamples, spectrum, mono });
    },
    stop() {
      input.disconnect();
      stopStream();
      void context.close();
    },
  };
}
