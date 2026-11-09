/**
 * FiveFeetMain — orchestrator for the Five Feet Zone 0 overlay.
 *
 * Owns: placing the whole rig in front of the user at start, sequencing the ember opener and
 *   the ring draw, near/far badges, routing item pinches to the single verdict card, the
 *   fallback verdict, routing the card's Done to the item's fix, and SFX.
 * Expects @inputs: verdictCard (FiveFeetVerdictCardUI), zoneRing (FiveFeetZoneRing),
 *   itemsRoot (parent whose children carry FiveFeetItem).
 * Must NOT: build UI or text (that lives in the *UI.ts modules) or hold per-item verdict
 *   data (that lives on each FiveFeetItem so it is editable in the Inspector).
 */
import {FiveFeetVerdictCardUI} from "./FiveFeetVerdictCardUI"
import {FiveFeetZoneRing} from "./FiveFeetZoneRing"
import {FiveFeetItem} from "./FiveFeetItem"
import {FiveFeetEmberOpener} from "./FiveFeetEmberOpener"
import {FiveFeetItemFix} from "./FiveFeetItemFix"
import {FiveFeetProgressUI} from "./FiveFeetProgressUI"
import {FiveFeetClearCardUI} from "./FiveFeetClearCardUI"
import {FiveFeetVoice} from "./FiveFeetVoice"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const CARD_SFX = requireAsset("../GeneratedSFX/CardShow.wav") as AudioTrackAsset
const RING_SFX = requireAsset("../GeneratedSFX/RingDraw.wav") as AudioTrackAsset

@component
export class FiveFeetMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetMain – Zone 0 overlay orchestrator</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The single floating verdict card")
  verdictCard: FiveFeetVerdictCardUI

  @input
  @hint("The Zone 0 ring on the ground")
  zoneRing: FiveFeetZoneRing

  @input
  @hint("Parent of the pinchable items. Every child with a FiveFeetItem is wired automatically")
  itemsRoot: SceneObject

  @input
  @allowUndefined
  @hint("Ember opener played before the line draws (optional: without it the line draws at start)")
  emberOpener: FiveFeetEmberOpener

  @input
  @allowUndefined
  @hint("Progress panel on the wall: 'Zone 0: N of M fixed' (optional)")
  progress: FiveFeetProgressUI

  @input
  @allowUndefined
  @hint("Card at the center of the wall shown when every item is fixed (optional)")
  clearCard: FiveFeetClearCardUI

  @input
  @allowUndefined
  @hint("Reads the verdict and the action out loud when a card shows (optional)")
  voice: FiveFeetVoice
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("At start, move the whole scene so the ground is under the user and the wall is straight ahead")
  placeAtUserStart: boolean = true

  @input
  @hint("User eye height above the ground (cm), used to put the ground under the user at start")
  @widget(new SliderWidget(100, 200, 1))
  userEyeHeightCm: number = 160

  @input
  @hint("Verdict shown for an item that has no verdict")
  fallbackVerdict: string = "Not sure. Ask your fire agency"

  @input
  @hint("Action line for an item with nothing to do")
  nothingToDoLine: string = "Nothing to do."

  @input
  @hint("Reason line on the card of an item that is already fixed")
  fixedReasonLine: string = "Done. Nothing else to do here."

  @input
  @hint("Height (cm) of the card's center above the top of the pinched item (brief default 30 cm)")
  @widget(new SliderWidget(10, 80, 1))
  cardHeightAboveItemCm: number = 30

  @input
  @hint("Farther than this along the ground (cm), an item shows only its badge and a pinch does not open the card")
  @widget(new SliderWidget(100, 500, 5))
  badgeDistanceCm: number = 250

  @input
  @hint("Band (cm) around the badge distance that stops the badge flickering when the user stands right at it")
  @widget(new SliderWidget(0, 30, 1))
  badgeHysteresisCm: number = 5

  @input("vec4", "{0.5,1,0.55,1}")
  @hint("Line color once every item is fixed (keep light: the display is additive)")
  @widget(new ColorWidget())
  clearLineColor: vec4 = new vec4(0.5, 1, 0.55, 1)

  @input("vec4", "{0.4,1,0.5,0.14}")
  @hint("Zone fill color once every item is fixed")
  @widget(new ColorWidget())
  clearFillColor: vec4 = new vec4(0.4, 1, 0.5, 0.14)

  @input
  @hint("Seconds the line takes to turn from orange to green (brief: 1 s)")
  @widget(new SliderWidget(0.2, 5, 0.1))
  clearColorSec: number = 1

  @input
  @hint("Volume of the card and ring sounds")
  @widget(new SliderWidget(0, 1, 0.05))
  sfxVolume: number = 0.8

  @input
  @hint("Draw every item's pinch target box as a wireframe (debug)")
  debugColliders: boolean = false
  @ui.group_end

  private items: FiveFeetItem[] = []
  private fixes = new Map<FiveFeetItem, FiveFeetItemFix>()
  private currentItem: FiveFeetItem | null = null
  private toFixTotal = 0
  private fixedCount = 0
  private zoneClear = false
  private cardAudio: AudioComponent
  private ringAudio: AudioComponent
  private lastVerdict = ""

  onAwake(): void {
    if (!this.verdictCard || !this.zoneRing || !this.itemsRoot) {
      print("[FiveFeet] ERROR: verdictCard, zoneRing or itemsRoot not wired")
      return
    }
    this.cardAudio = this.makeAudio("CardAudio", CARD_SFX, true)
    this.ringAudio = this.makeAudio("RingAudio", RING_SFX, false)
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.updateItemDistances())
  }

  /** All wired items (for tests and logs). */
  getItems(): FiveFeetItem[] {
    return this.items.slice()
  }

  /** Last verdict shown (for tests and logs). */
  getLastVerdict(): string {
    return this.lastVerdict
  }

  private onStart(): void {
    if (this.placeAtUserStart) this.placeRigAtUser()
    this.wireItems()
    this.verdictCard.onDone.add(() => this.onDonePressed())
    if (this.emberOpener) {
      this.emberOpener.onComplete.add(() => this.startRingDraw())
      this.emberOpener.play(this.items)
    } else {
      this.startRingDraw()
    }
  }

  private startRingDraw(): void {
    this.zoneRing.startDraw()
    this.ringAudio.play(1)
  }

  private wireItems(): void {
    for (let i = 0; i < this.itemsRoot.getChildrenCount(); i++) {
      const child = this.itemsRoot.getChild(i)
      const item = child.getComponent(FiveFeetItem.getTypeName()) as FiveFeetItem
      if (!item || typeof item.setColliderDebug !== "function") {
        print("[FiveFeet] WARN: " + child.name + " has no ready FiveFeetItem, skipped")
        continue
      }
      item.setColliderDebug(this.debugColliders)
      item.onPinched.add((it) => this.onItemPinched(it))
      this.items.push(item)
      const fix = this.findFix(child)
      if (fix) this.fixes.set(item, fix)
    }
    this.toFixTotal = this.items.filter((it) => it.needsAction()).length
    this.updateProgress()
    print("[FiveFeet] wired " + this.items.length + " items, " + this.toFixTotal + " to fix")
  }

  /** Each frame: items farther than the badge distance show only their badge. */
  private updateItemDistances(): void {
    if (this.items.length === 0) return
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    for (const item of this.items) this.refreshFar(item, eye)
  }

  /** Update one item's far state from the user's eye position. Returns its ground distance (cm). */
  private refreshFar(item: FiveFeetItem, eye: vec3): number {
    const d = item.getGroundDistanceCm(eye)
    const limit = item.isFar() ? this.badgeDistanceCm - this.badgeHysteresisCm : this.badgeDistanceCm
    item.setFar(d > limit)
    return d
  }

  private onItemPinched(item: FiveFeetItem): void {
    const distance = this.refreshFar(item, WorldCameraFinderProvider.getInstance().getWorldPosition())
    if (item.isFar()) {
      print(
        "[FiveFeet] pinched " + item.sceneObject.name + " from " + (distance / 100).toFixed(2) + " m: badge only, walk closer"
      )
      return
    }
    const hasVerdict = item.verdict.trim().length > 0
    let verdict = hasVerdict ? item.verdict : this.fallbackVerdict
    let reason = hasVerdict ? item.reason : ""
    let color = hasVerdict ? item.verdictColor : new vec4(1, 1, 1, 1)
    let action = item.action.trim().length > 0 ? item.action : this.nothingToDoLine
    if (item.isFixed()) {
      verdict = item.fixedLabel
      reason = this.fixedReasonLine
      color = item.fixedColor
      action = ""
    }
    const pos = item.getTopWorldPosition().add(vec3.up().uniformScale(this.cardHeightAboveItemCm))
    this.verdictCard.showVerdict(verdict, reason, color, pos, action, item.needsAction())
    if (this.voice) this.voice.speak(action.length > 0 ? verdict + ". " + action : verdict + ".")
    this.currentItem = item
    this.lastVerdict = verdict
    this.cardAudio.play(1)
    print("[FiveFeet] pinched " + item.sceneObject.name + " (" + item.displayName + ") -> " + verdict)
  }

  /** Done on the card: run the shown item's fix, then mark it fixed. */
  private onDonePressed(): void {
    const item = this.currentItem
    if (!item || !item.needsAction()) return
    this.verdictCard.hide()
    print("[FiveFeet] Done pressed for " + item.sceneObject.name)
    const fix = this.fixes.get(item)
    if (fix) fix.play(() => this.onItemFixed(item))
    else this.onItemFixed(item)
  }

  private onItemFixed(item: FiveFeetItem): void {
    item.markFixed()
    this.fixedCount++
    this.updateProgress()
    print(
      "[FiveFeet] fixed " + item.sceneObject.name + " (" + item.displayName + "): " + this.fixedCount + " of " + this.toFixTotal
    )
    if (!this.zoneClear && this.toFixTotal > 0 && this.fixedCount >= this.toFixTotal) this.onZoneClear()
  }

  /** Every item that needed work is fixed: the line turns green, then the clear card shows. */
  private onZoneClear(): void {
    this.zoneClear = true
    this.zoneRing.animateColors(this.clearLineColor, this.clearFillColor, this.clearColorSec)
    const showCard = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    showCard.bind(() => {
      if (this.clearCard) this.clearCard.show()
      print("[FiveFeet] Zone 0 clear")
    })
    showCard.reset(this.clearColorSec)
  }

  private updateProgress(): void {
    if (this.progress) this.progress.setProgress(this.fixedCount, this.toFixTotal)
  }

  /** True once every item that needed work is fixed (for tests and logs). */
  isZoneClear(): boolean {
    return this.zoneClear
  }

  /** The FiveFeetItemFix on one of the item's children, if it has one. */
  private findFix(itemSo: SceneObject): FiveFeetItemFix | null {
    for (let i = 0; i < itemSo.getChildrenCount(); i++) {
      const fix = itemSo.getChild(i).getComponent(FiveFeetItemFix.getTypeName()) as FiveFeetItemFix
      if (fix) return fix
    }
    return null
  }

  /** Put the ground under the user and turn the rig so the wall is straight ahead. */
  private placeRigAtUser(): void {
    const cam = WorldCameraFinderProvider.getInstance()
    const camPos = cam.getWorldPosition()
    const look = cam.getTransform().forward.uniformScale(-1)
    const flat = new vec3(look.x, 0, look.z)
    const t = this.getTransform()
    t.setWorldPosition(new vec3(camPos.x, camPos.y - this.userEyeHeightCm, camPos.z))
    if (flat.length > 0.01) {
      const f = flat.normalize()
      t.setWorldRotation(quat.angleAxis(Math.atan2(-f.x, -f.z), vec3.up()))
    }
  }

  private makeAudio(name: string, track: AudioTrackAsset, lowLatency: boolean): AudioComponent {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    const audio = so.createComponent("Component.AudioComponent") as AudioComponent
    audio.audioTrack = track
    audio.volume = this.sfxVolume
    if (lowLatency) audio.playbackMode = Audio.PlaybackMode.LowLatency
    return audio
  }
}
