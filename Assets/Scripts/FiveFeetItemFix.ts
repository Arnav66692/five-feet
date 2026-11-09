/**
 * FiveFeetItemFix — what pressing Done does to one item (controller).
 *
 * Owns: the fix animation for one item, picked by `mode`:
 *   "slide"      moves the item away from the wall until its center is targetWallDistanceCm out
 *                (firewood: about 2.2 m, over 1 s).
 *   "resurface"  recolors every mesh of the item to the replacement material's color
 *                (wood mulch -> gray gravel).
 *   "metalNearWall" turns every mesh part within metalLengthCm of the wall into metal, splitting
 *                parts that cross that line (the first 1 m of the attached fence).
 *   Sits on a child of the item it fixes; `item` is that FiveFeetItem.
 * Expects @inputs: item, houseWall (origin on the wall face, +Z away from the wall), and the
 *   material for the chosen mode.
 * Public API: play(onDone), isPlaying(), isApplied()
 * Must NOT: count progress, show cards or badges. FiveFeetMain and FiveFeetItem do that.
 */
import {FiveFeetItem} from "./FiveFeetItem"

const SPLIT_EPS_CM = 0.5

@component
export class FiveFeetItemFix extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetItemFix – what Done does to this item</span>')
  @ui.separator
  @input
  @hint("The item this fix changes")
  item: FiveFeetItem

  @input
  @hint("House wall root. Its origin is on the wall face and its +Z points away from the wall")
  houseWall: SceneObject

  @input
  @hint("slide: move out from the wall. resurface: recolor to the material. metalNearWall: metal within the length")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("slide", "slide"),
      new ComboBoxItem("resurface", "resurface"),
      new ComboBoxItem("metalNearWall", "metalNearWall")
    ])
  )
  mode: string = "slide"

  @input
  @hint("slide: distance (cm) from the wall face to the item's center after the fix")
  @widget(new SliderWidget(150, 400, 5))
  targetWallDistanceCm: number = 220

  @input
  @hint("metalNearWall: how far (cm) out from the wall the metal goes (brief: the first 1 m)")
  @widget(new SliderWidget(20, 200, 5))
  metalLengthCm: number = 100

  @input
  @allowUndefined
  @hint("resurface / metalNearWall: material whose color the changed parts take (gravel or metal)")
  replacementMaterial: Material

  @input
  @hint("Seconds the fix takes")
  @widget(new SliderWidget(0.1, 3, 0.1))
  durationSec: number = 1

  private playing = false
  private applied = false
  private elapsed = 0
  private onDoneCb: (() => void) | null = null
  private slideFrom = vec3.zero()
  private slideTo = vec3.zero()
  private recolorTargets: {mat: Material; from: vec4; to: vec4}[] = []

  onAwake(): void {
    if (!this.item || !this.houseWall) {
      print("[FiveFeet] ERROR: FiveFeetItemFix on " + this.sceneObject.name + " needs item and houseWall")
      return
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Run the fix once. onDone fires when the animation has finished. */
  play(onDone: () => void): void {
    if (this.applied || this.playing) return
    this.onDoneCb = onDone
    this.elapsed = 0
    this.recolorTargets = []
    if (this.mode === "slide") this.prepareSlide()
    else if (this.mode === "resurface") this.prepareResurface()
    else if (this.mode === "metalNearWall") this.prepareMetal()
    else print("[FiveFeet] WARN: unknown fix mode '" + this.mode + "' on " + this.sceneObject.name)
    this.playing = true
  }

  isPlaying(): boolean {
    return this.playing
  }

  isApplied(): boolean {
    return this.applied
  }

  private onUpdate(): void {
    if (!this.playing) return
    this.elapsed += getDeltaTime()
    const p = Math.min(1, this.elapsed / Math.max(0.01, this.durationSec))
    const k = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    if (this.mode === "slide") {
      this.item.getTransform().setWorldPosition(vec3.lerp(this.slideFrom, this.slideTo, k))
    }
    for (const r of this.recolorTargets) r.mat.mainPass.baseColor = vec4.lerp(r.from, r.to, k)
    if (p >= 1) this.finish()
  }

  private finish(): void {
    this.playing = false
    this.applied = true
    // The item's hover and glow tint start from these new colors from now on.
    for (const r of this.recolorTargets) this.item.setBaseColor(r.mat, r.to)
    print("[FiveFeet] fix applied: " + this.item.sceneObject.name + " (" + this.mode + ")")
    if (this.onDoneCb) this.onDoneCb()
  }

  private wallNormal(): vec3 {
    return this.houseWall.getTransform().forward.normalize()
  }

  private wallDistanceCm(world: vec3): number {
    return world.sub(this.houseWall.getTransform().getWorldPosition()).dot(this.wallNormal())
  }

  private prepareSlide(): void {
    const t = this.item.getTransform()
    this.slideFrom = t.getWorldPosition()
    const out = this.targetWallDistanceCm - this.wallDistanceCm(this.slideFrom)
    this.slideTo = this.slideFrom.add(this.wallNormal().uniformScale(out))
  }

  private prepareResurface(): void {
    const to = this.replacementColor()
    if (!to) return
    for (const rmv of this.item.getMeshVisuals()) this.addRecolor(rmv, this.vary(to, rmv))
  }

  /** Metal for every part within metalLengthCm of the wall; parts that cross the line are split. */
  private prepareMetal(): void {
    const to = this.replacementColor()
    if (!to) return
    for (const rmv of this.item.getMeshVisuals()) {
      const span = this.wallSpan(rmv.sceneObject)
      if (span.far <= this.metalLengthCm + SPLIT_EPS_CM) {
        this.addRecolor(rmv, to)
      } else if (span.near < this.metalLengthCm - SPLIT_EPS_CM) {
        const metalPart = this.splitAt(rmv, span, this.metalLengthCm)
        this.addRecolor(metalPart, to)
      }
    }
  }

  private addRecolor(rmv: RenderMeshVisual, to: vec4): void {
    const mat = rmv.mainMaterial
    const from = mat.mainPass.baseColor
    this.recolorTargets.push({mat, from, to: new vec4(to.x, to.y, to.z, from.w)})
  }

  private replacementColor(): vec4 | null {
    if (!this.replacementMaterial) {
      print("[FiveFeet] WARN: " + this.sceneObject.name + " has no replacementMaterial for " + this.mode)
      return null
    }
    return this.replacementMaterial.mainPass.baseColor
  }

  /** Lighter top chips and darker bed so gravel does not read as one flat block. */
  private vary(c: vec4, rmv: RenderMeshVisual): vec4 {
    const s = rmv.sceneObject.getTransform().getLocalScale()
    const small = s.x < 20 && s.z < 20
    const k = small ? 1.12 : 0.95
    return new vec4(Math.min(1, c.x * k), Math.min(1, c.y * k), Math.min(1, c.z * k), c.w)
  }

  /**
   * How far (cm) from the wall face a box part starts and ends. Assumes the part is an unrotated
   * unit box scaled by its local scale, as the stand-in fence parts are.
   */
  private wallSpan(so: SceneObject): {near: number; far: number; axis: number} {
    const t = so.getTransform()
    const parentInv = so.getParent().getTransform().getInvertedWorldTransform()
    const nLocal = parentInv.multiplyDirection(this.wallNormal()).normalize()
    const s = t.getLocalScale()
    const ax = [Math.abs(nLocal.x), Math.abs(nLocal.y), Math.abs(nLocal.z)]
    const axis = ax[0] >= ax[1] && ax[0] >= ax[2] ? 0 : ax[1] >= ax[2] ? 1 : 2
    const half = 0.5 * (Math.abs(s.x * nLocal.x) + Math.abs(s.y * nLocal.y) + Math.abs(s.z * nLocal.z))
    const center = this.wallDistanceCm(t.getWorldPosition())
    return {near: center - half, far: center + half, axis}
  }

  /**
   * Cut one box part at wall distance `at`: the original keeps the far piece, a new copy takes
   * the near piece. Returns the near piece (the one that turns to metal).
   */
  private splitAt(rmv: RenderMeshVisual, span: {near: number; far: number; axis: number}, at: number): RenderMeshVisual {
    const so = rmv.sceneObject
    const t = so.getTransform()
    const parentInv = so.getParent().getTransform().getInvertedWorldTransform()
    const nLocal = parentInv.multiplyDirection(this.wallNormal()).normalize()
    const sign = [nLocal.x, nLocal.y, nLocal.z][span.axis] >= 0 ? 1 : -1
    const center = (span.near + span.far) / 2
    const pos = t.getLocalPosition()
    const scale = t.getLocalScale()

    const nearLen = at - span.near
    const farLen = span.far - at
    const along = (d: number) => {
      const v = [pos.x, pos.y, pos.z]
      v[span.axis] += sign * d
      return new vec3(v[0], v[1], v[2])
    }
    const sized = (len: number) => {
      const v = [scale.x, scale.y, scale.z]
      v[span.axis] = len
      return new vec3(v[0], v[1], v[2])
    }

    const copy = global.scene.createSceneObject(so.name + "_Metal")
    copy.setParent(so.getParent())
    const ct = copy.getTransform()
    ct.setLocalRotation(t.getLocalRotation())
    ct.setLocalPosition(along((span.near + at) / 2 - center))
    ct.setLocalScale(sized(nearLen))
    const copyRmv = copy.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    copyRmv.mesh = rmv.mesh
    copyRmv.mainMaterial = rmv.mainMaterial.clone()
    this.item.addMeshVisual(copyRmv)

    t.setLocalPosition(along((at + span.far) / 2 - center))
    t.setLocalScale(sized(farLen))
    return copyRmv
  }
}
