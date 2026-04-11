/**
 * Audio system utility — wraps expo-audio with safety guards.
 * expo-audio@1.1.1 (SDK 54 compatible) exports everything at the top level:
 *   - useAudioRecorder, useAudioPlayer (hooks)
 *   - setAudioModeAsync, requestRecordingPermissionsAsync, createAudioPlayer (functions)
 *   - RecordingPresets (constants)
 */

let _expoAudio: any = null;
let _isSupported = false;

try {
  _expoAudio = require('expo-audio');
  _isSupported = true;
} catch (e) {
  console.warn('[AudioSystem] expo-audio module not available:', (e as any)?.message);
  _isSupported = false;
}

/**
 * Returns a guarded version of expo-audio exports.
 */
export const audioSystem = {
  get isSupported() {
    return _isSupported;
  },

  /** Direct access to the underlying module (for hooks that must be imported at top-level). */
  get module() {
    return _expoAudio;
  },

  // Safe wrapper for setAudioModeAsync (top-level export)
  setAudioModeAsync: async (mode: any) => {
    if (_expoAudio?.setAudioModeAsync) {
      return await _expoAudio.setAudioModeAsync(mode);
    }
    console.warn('[AudioSystem] setAudioModeAsync not available');
  },

  // Safe wrapper for requestRecordingPermissionsAsync (top-level export)
  requestRecordingPermissionsAsync: async () => {
    if (_expoAudio?.requestRecordingPermissionsAsync) {
      return await _expoAudio.requestRecordingPermissionsAsync();
    }
    return { status: 'denied', granted: false, canAskAgain: false };
  },

  // Safe wrapper for createAudioPlayer (top-level export)
  createAudioPlayer: (source: any) => {
    if (_expoAudio?.createAudioPlayer) {
      return _expoAudio.createAudioPlayer(source);
    }
    return null;
  }
};
