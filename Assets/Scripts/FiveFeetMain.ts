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

const DONE_TAP_GUARD_SEC = 0.5
const TOUCH_SETTLE_SEC = 0.3 // after a release, SIK may still report the press it started on a stale target
const CLEAR_CARD_GAP_DEG = 0.6 // clear space between the clear card and anything below it, as the user sees it
const VIEW_MARGIN_DEG = 1.5 // keep the clear card this far inside the edge of the view
const MIN_FORESHORTEN = 0.3 // never grow the wall panel more than 1/0.3 to make up for a steep view
const LIFT_SEARCH_STEPS = 24
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
  @hint("Angular height (degrees) of a far-away badge's status line, kept the same at any distance")
  @widget(new SliderWidget(0.4, 3, 0.05))
  badgeAngleDeg: number = 1.1

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
  private lastDoneTime = -10
  private touchActive = false
  private lastTouchEndTime = -10
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
    this.createEvent("TouchStartEvent").bind(() => (this.touchActive = true))
    this.createEvent("TouchEndEvent").bind((e) => {
      this.touchActive = false
      this.lastTouchEndTime = getTime()
      this.resolveTap(e.getTouchPosition())
    })
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
    this.verdictCard.onDone.add(() => this.onDonePressed(false))
    this.verdictCard.onHidden.add(() => {
      if (this.currentItem) this.currentItem.setTagSuppressed(false)
    })
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
    this.layoutBadges(eye)
    this.layoutWallUi(eye)
  }

  /**
   * Smallest text line (cm) that reads at least as tall as a badge's status word at this distance:
   * a badge's line at scale 1, or badgeAngleDeg once the badge has grown with distance.
   */
  private minLineCm(distCm: number): number {
    const badge = this.items.map((it) => it.badge).find((b) => !!b)
    const badgeLine = badge ? badge.getLineHeightCm() : 0
    return Math.max(badgeLine, (distCm * this.badgeAngleDeg * Math.PI) / 180)
  }

  /** Wall progress panel and clear card: scale with distance like the badges; lift the card clear of the yard. */
  private layoutWallUi(eye: vec3): void {
    if (this.progress) {
      const t = this.progress.getTransform()
      const rel = t.getWorldPosition().sub(eye)
      const dir = rel.normalize()
      // The panel is flat on the wall, so a view from above or below squashes it vertically.
      const a = Math.abs(dir.dot(t.forward.normalize()))
      const b = dir.dot(t.up.normalize())
      const foreshorten = Math.max(MIN_FORESHORTEN, a / Math.max(0.001, Math.sqrt(a * a + b * b)))
      const need = this.minLineCm(rel.length) / foreshorten
      this.progress.setViewScale(Math.max(1, need / this.progress.getLineHeightCm()))
    }
    if (this.clearCard && this.clearCard.isShowing()) this.layoutClearCard(eye)
  }

  /**
   * Scale the clear card so its title reads at least as tall as a badge, then lift it just above
   * every item, check and badge in view, keeping it fully inside the view.
   */
  private layoutClearCard(eye: vec3): void {
    const card = this.clearCard
    const cam = WorldCameraFinderProvider.getInstance()
    const camComp = cam.getComponent()
    const camT = cam.getTransform()
    const fwd = camT.forward.uniformScale(-1).normalize()
    const right = camT.right.normalize()
    const camUp = camT.up.normalize()
    const up = this.getTransform().up.normalize()
    const base = card.getBaseWorldPosition()
    const scale = Math.max(1, this.minLineCm(base.sub(eye).length) / card.getTitleLineHeightCm())
    card.setViewScale(scale)
    const size = card.getSizeCm().uniformScale(scale)
    const project = (p: vec3): vec2 => {
      const rel = p.sub(eye)
      const depth = Math.max(1, rel.dot(fwd))
      return new vec2(rel.dot(right) / depth, rel.dot(camUp) / depth)
    }
    type Box = {x0: number; x1: number; y0: number; y1: number}
    const cardBox = (lift: number): Box => {
      const c = base.add(up.uniformScale(lift))
      const depth = Math.max(1, c.sub(eye).dot(fwd))
      const p = project(c)
      const hw = size.x / 2 / depth
      const hh = size.y / 2 / depth
      return {x0: p.x - hw, x1: p.x + hw, y0: p.y - hh, y1: p.y + hh}
    }
    const obstacles = this.viewObstacles(project)
    const gap = Math.tan((CLEAR_CARD_GAP_DEG * Math.PI) / 180)
    const overlaps = (box: Box): Box | undefined =>
      obstacles.find((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 + gap && box.y1 > o.y0)
    let lift = 0
    for (let pass = 0; pass <= obstacles.length; pass++) {
      const box = cardBox(lift)
      const hit = overlaps(box)
      if (!hit) break
      const depth = Math.max(1, base.add(up.uniformScale(lift)).sub(eye).dot(fwd))
      lift += (hit.y1 + gap - box.y0) * depth + 0.5
    }
    if (camComp) {
      // Fully inside the view wins over clearing the yard: lower the card until its top fits.
      const topLimit = Math.tan(camComp.fov / 2 - (VIEW_MARGIN_DEG * Math.PI) / 180)
      if (cardBox(lift).y1 > topLimit) {
        let lo = lift - 500
        let hi = lift
        for (let i = 0; i < LIFT_SEARCH_STEPS; i++) {
          const mid = (lo + hi) / 2
          if (cardBox(mid).y1 > topLimit) hi = mid
          else lo = mid
        }
        lift = lo
      }
    }
    card.setLift(lift)
  }

  /** View-space boxes (tangent units) of the Zone 0 line and every item's meshes, check and visible badge. */
  private viewObstacles(project: (p: vec3) => vec2): {x0: number; x1: number; y0: number; y1: number}[] {
    const boxes: {x0: number; x1: number; y0: number; y1: number}[] = []
    const addBounds = (min: vec3, max: vec3): void => {
      let x0 = Infinity
      let x1 = -Infinity
      let y0 = Infinity
      let y1 = -Infinity
      for (const x of [min.x, max.x])
        for (const y of [min.y, max.y])
          for (const z of [min.z, max.z]) {
            const p = project(new vec3(x, y, z))
            x0 = Math.min(x0, p.x)
            x1 = Math.max(x1, p.x)
            y0 = Math.min(y0, p.y)
            y1 = Math.max(y1, p.y)
          }
      boxes.push({x0, x1, y0, y1})
    }
    for (const rmv of this.meshesUnder(this.zoneRing.sceneObject)) {
      if (rmv.sceneObject.isEnabledInHierarchy) addBounds(rmv.worldAabbMin(), rmv.worldAabbMax())
    }
    for (const item of this.items) {
      const b = item.getVisualWorldBounds()
      addBounds(b.min, b.max)
      if (item.checkBadge && item.checkBadge.isEnabledInHierarchy) {
        for (const rmv of this.meshesUnder(item.checkBadge)) addBounds(rmv.worldAabbMin(), rmv.worldAabbMax())
      }
      if (item.badge && item.badge.isVisible()) {
        const t = item.badge.getTransform()
        const half = item.badge.getSizeCm().uniformScale(t.getWorldScale().x / 2)
        const c = t.getWorldPosition()
        const r = t.right.normalize().uniformScale(half.x)
        const u = t.up.normalize().uniformScale(half.y)
        const corners = [c.add(r).add(u), c.add(r).sub(u), c.sub(r).add(u), c.sub(r).sub(u)]
        const ps = corners.map((p) => project(p))
        boxes.push({
          x0: Math.min(...ps.map((p) => p.x)),
          x1: Math.max(...ps.map((p) => p.x)),
          y0: Math.min(...ps.map((p) => p.y)),
          y1: Math.max(...ps.map((p) => p.y))
        })
      }
    }
    return boxes
  }

  private meshesUnder(so: SceneObject): RenderMeshVisual[] {
    const out = (so.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[]).slice()
    for (let i = 0; i < so.getChildrenCount(); i++) out.push(...this.meshesUnder(so.getChild(i)))
    return out
  }

  /**
   * Far-away badges: scale each so its status line subtends badgeAngleDeg (readable from 4.5 m),
   * then lift any badge that would overlap one placed before it, as the user sees them.
   */
  private layoutBadges(eye: vec3): void {
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const fwd = camT.forward.uniformScale(-1).normalize()
    const right = camT.right.normalize()
    const up = camT.up.normalize()
    const angle = (this.badgeAngleDeg * Math.PI) / 180
    type Box = {x: number; y: number; hw: number; hh: number}
    const placed: Box[] = []
    const badges = this.items
      .filter((it) => it.isFar() && it.badge)
      .map((it) => it.badge)
      .sort((a, b) => a.getBaseWorldPosition().y - b.getBaseWorldPosition().y)
    for (const badge of badges) {
      const base = badge.getBaseWorldPosition()
      const dist = Math.max(1, base.sub(eye).length)
      const scale = Math.max(1, (dist * angle) / badge.getLineHeightCm())
      badge.setViewScale(scale)
      const size = badge.getSizeCm().uniformScale(scale)
      let lift = 0
      for (let pass = 0; pass < placed.length + 1; pass++) {
        const rel = base.add(vec3.up().uniformScale(lift)).sub(eye)
        const depth = Math.max(1, rel.dot(fwd))
        const box = {x: rel.dot(right) / depth, y: rel.dot(up) / depth, hw: size.x / 2 / depth, hh: size.y / 2 / depth}
        const hit = placed.find((p) => Math.abs(p.x - box.x) < p.hw + box.hw && Math.abs(p.y - box.y) < p.hh + box.hh)
        if (!hit) {
          placed.push(box)
          break
        }
        lift += (hit.y + hit.hh + box.hh - box.y) * depth + 0.5
      }
      badge.setLift(lift)
    }
  }

  /** Update one item's far state from the user's eye position. Returns its ground distance (cm). */
  private refreshFar(item: FiveFeetItem, eye: vec3): number {
    const d = item.getGroundDistanceCm(eye)
    const limit = item.isFar() ? this.badgeDistanceCm - this.badgeHysteresisCm : this.badgeDistanceCm
    item.setFar(d > limit)
    return d
  }

  /**
   * Mouse and touch taps in the preview. SIK's mouse interactor keeps its target locked to what was
   * under the cursor before the press, so a tap on a new spot triggers the old target (and Done only
   * gets hovered after the release). Taps are resolved here instead: on release, a ray from the
   * camera through the tap picks Done, the card, or the nearest item's pinch box. SIK pinches and
   * Done presses that arrive during a touch are ignored. Hands and LEAF never send touches, so they
   * go through SIK as before.
   */
  private resolveTap(screenPos: vec2): void {
    const camProvider = WorldCameraFinderProvider.getInstance()
    const cam = camProvider.getComponent()
    if (!cam || this.items.length === 0) return
    const origin = camProvider.getWorldPosition()
    const dir = cam.screenSpaceToWorldSpace(screenPos, 100).sub(origin).normalize()
    if (this.verdictCard.doneRayHit(origin, dir)) {
      print("[FiveFeet] tap on Done")
      this.onDonePressed(true)
      return
    }
    if (this.verdictCard.panelRayHit(origin, dir)) return // the card blocks what is behind it
    let best: FiveFeetItem | null = null
    let bestDist = Infinity
    for (const item of this.items) {
      const d = item.rayHitDistance(origin, dir)
      if (d >= 0 && d < bestDist) {
        best = item
        bestDist = d
      }
    }
    if (best) this.onItemPinched(best, true)
  }

  /** True during a mouse or touch press and just after it, while SIK may still report a stale target. */
  private isTouchInput(): boolean {
    return this.touchActive || getTime() - this.lastTouchEndTime < TOUCH_SETTLE_SEC
  }

  private onItemPinched(item: FiveFeetItem, fromTap: boolean = false): void {
    if (!fromTap && this.isTouchInput()) return // a mouse or touch press: resolved on release instead
    // The same tap that pressed Done must not also pinch the item behind the card.
    if (getTime() - this.lastDoneTime < DONE_TAP_GUARD_SEC) return
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
    if (this.currentItem && this.currentItem !== item) this.currentItem.setTagSuppressed(false)
    item.setTagSuppressed(true) // the open card names the item; its tag would sit under the card
    const bounds = item.getVisualWorldBounds()
    this.verdictCard.showVerdict(verdict, reason, color, bounds.min, bounds.max, action, item.needsAction())
    if (this.voice) this.voice.speak(action.length > 0 ? verdict + ". " + action : verdict + ".")
    this.currentItem = item
    this.lastVerdict = verdict
    this.cardAudio.play(1)
    print("[FiveFeet] pinched " + item.sceneObject.name + " (" + item.displayName + ") -> " + verdict)
  }

  /** Done on the card: run the shown item's fix, then mark it fixed. */
  private onDonePressed(fromTap: boolean): void {
    if (!fromTap && this.isTouchInput()) return // a mouse or touch press: resolved on release instead
    const item = this.currentItem
    if (!item || !item.needsAction()) return
    this.lastDoneTime = getTime()
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
