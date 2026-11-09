/**
 * FiveFeetVoice — reads a card out loud with text to speech (controller).
 *
 * Owns: turning a line of text into audio with the TextToSpeechModule and playing it.
 *   The module's synthesize() is not in this SDK's typings (the class is marked deprecated),
 *   so it is feature-checked at runtime. If text to speech is missing or fails, it logs one
 *   warning and does nothing else: the card keeps working without voice.
 * Expects @inputs: ttsModule (optional TextToSpeechModule asset).
 * Public API: speak(text), isAvailable(), getLastSpoken()
 * Must NOT: decide what to say. FiveFeetMain passes the verdict and the action.
 */

type TtsSuccess = (audio: AudioTrackAsset) => void
type TtsError = (code: number, description: string) => void
type TtsLike = {
  synthesize: (text: string, options: unknown, onSuccess: TtsSuccess, onError: TtsError) => void
}

@component
export class FiveFeetVoice extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetVoice – reads the card out loud</span>')
  @ui.separator
  @input
  @allowUndefined
  @hint("Text To Speech module asset. Without it (or without TTS support) the Lens logs a warning and stays silent")
  ttsModule: TextToSpeechModule

  @input
  @hint("Voice volume")
  @widget(new SliderWidget(0, 1, 0.05))
  volume: number = 1

  private audio: AudioComponent
  private warned = false
  private lastSpoken = ""
  private requestId = 0

  onAwake(): void {
    this.audio = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    this.audio.volume = this.volume
  }

  /** True when a TTS module is wired and exposes synthesize(). */
  isAvailable(): boolean {
    const tts = this.ttsModule as unknown as TtsLike | undefined
    return !!tts && typeof tts.synthesize === "function"
  }

  getLastSpoken(): string {
    return this.lastSpoken
  }

  /** Speak the text. A newer call replaces a line that is still being synthesized. */
  speak(text: string): void {
    this.lastSpoken = text
    if (!this.isAvailable()) {
      this.warnOnce("text to speech not available (no TextToSpeechModule or no synthesize()). Card works without voice")
      return
    }
    const id = ++this.requestId
    try {
      const tts = this.ttsModule as unknown as TtsLike
      tts.synthesize(
        text,
        TextToSpeech.Options.create(),
        (audioTrack) => {
          if (id !== this.requestId) return // a newer card replaced this line
          this.play(audioTrack)
        },
        (code, description) => this.warnOnce("text to speech failed (" + code + ": " + description + ")")
      )
    } catch (e) {
      this.warnOnce("text to speech threw: " + e)
    }
  }

  private play(audioTrack: AudioTrackAsset): void {
    try {
      if (this.audio.isPlaying()) this.audio.stop(false)
      this.audio.audioTrack = audioTrack
      this.audio.play(1)
      print("[FiveFeet] voice: \"" + this.lastSpoken + "\"")
    } catch (e) {
      this.warnOnce("could not play the text to speech audio: " + e)
    }
  }

  private warnOnce(message: string): void {
    if (this.warned) return
    this.warned = true
    print("[FiveFeet] WARN: " + message)
  }
}
