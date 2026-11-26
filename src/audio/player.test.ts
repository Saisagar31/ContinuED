import { describe, expect, it, vi } from 'vitest';
import { availabilityFor, playFor, type PlayerDeps, type SpeechLike } from './player';

function fakeSpeech(langs: string[]): SpeechLike & { spoken: unknown[] } {
  const spoken: unknown[] = [];
  return { spoken, getVoices: () => langs.map((lang) => ({ lang })), cancel: () => {}, speak: (u) => void spoken.push(u) };
}

function deps(over: Partial<PlayerDeps>): PlayerDeps {
  return {
    getClip: async () => null,
    playBlob: vi.fn(async () => {}),
    speech: fakeSpeech([]),
    makeUtterance: (text, voice, lang) => ({ text, voice, lang }),
    ...over,
  };
}

describe('playFor', () => {
  it('plays the exact clip when the active pack has it', async () => {
    const d = deps({ getClip: async () => new Blob([new Uint8Array([1])]) });
    expect(await playFor('mr', 'a.nr.1', 'text', d)).toBe('clip');
    expect(d.playBlob).toHaveBeenCalledOnce();
  });

  it('falls back to device speech with a matching voice', async () => {
    const speech = fakeSpeech(['en-US', 'mr_IN']);
    const d = deps({ speech });
    expect(await playFor('mr', 'a.nr.1', 'नमस्कार', d)).toBe('device_speech');
    expect(speech.spoken).toEqual([{ text: 'नमस्कार', voice: { lang: 'mr_IN' }, lang: 'mr_IN' }]);
  });

  it('falls back to device speech when clip playback fails', async () => {
    const d = deps({ getClip: async () => new Blob([]), playBlob: async () => Promise.reject(new Error('autoplay blocked')), speech: fakeSpeech(['kn-IN']) });
    expect(await playFor('kn', 'x', 'text', d)).toBe('device_speech');
  });

  it('falls back to text only when no clip and no voice', async () => {
    const d = deps({ speech: fakeSpeech(['en-IN']) });
    expect(await playFor('ml', 'x', 'text', d)).toBe('text_only');
  });

  it('never throws, even when everything breaks', async () => {
    const d = deps({
      getClip: async () => {
        throw new Error('cache gone');
      },
      speech: {
        getVoices: () => {
          throw new Error('no speech');
        },
        cancel: () => {},
        speak: () => {},
      },
    });
    expect(await playFor('te', 'x', 'text', d)).toBe('text_only');
    expect(await availabilityFor('te', 'x', d)).toBe('text_only');
  });

  it('availabilityFor reports the state without playing', async () => {
    const d = deps({ speech: fakeSpeech(['hi-IN']) });
    expect(await availabilityFor('hi', 'x', d)).toBe('device_speech');
    expect(d.playBlob).not.toHaveBeenCalled();
  });
});
