/**
 * FiveFeetItem — one pinchable stand-in item near the house wall (controller).
 *
 * Owns: this item's verdict data (displayName, verdict, reason, action, color), its SIK
 *   pinch target (box ColliderComponent + Interactable on THIS SceneObject, so
 *   LEAF can find it with findInteractablesByName("Item_<Name>")), the hover highlight,
 *   the ember glow, its near/far look (tag or badge) and its fixed state (green check).
 * Expects @inputs: visualRoot (leaf meshes to tint on hover), tag (its name tag view),
 *   badge (far-away status), checkBadge (green check shown once fixed).
 * Emits: onPinched(item). FiveFeetMain decides what to show.
 * Must NOT: touch the verdict card. Must NOT scale this SceneObject (Hard Rule 6:
 *   the collider lives on this unit-scale node; sizes live on the visual leaves).
 *
 * Placement contract: this SceneObject sits at the CENTER of the item's bounding box,
 *   so the box collider (which has no offset) is centered on the visual.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FiveFeetItemTagUI} from "./FiveFeetItemTagUI"
import {FiveFeetItemBadgeUI} from "./FiveFeetItemBadgeUI"

const TARGETING_BOTH = 3 // direct poke + far-field ray

@component
export class FiveFeetItem extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetItem – pinchable stand-in with a verdict</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Parent of this item's mesh leaves. They are tinted while the item is aimed at")
  visualRoot: SceneObject

  @input
  @allowUndefined
  @hint("Name tag above this item (optional). Shown when the user is near")
  tag: FiveFeetItemTagUI

  @input
  @allowUndefined
  @hint("Colored status badge (optional). Shown instead of the tag when the user is far away")
  badge: FiveFeetItemBadgeUI

  @input
  @allowUndefined
  @hint("Green check shown above the item once it is fixed (optional, starts hidden)")
  checkBadge: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Fixed</span>')
  @ui.group_start("Fixed")
  @input
  @hint("Badge status once the item is fixed")
  fixedLabel: string = "Fixed"

  @input("vec4", "{0.55,1,0.6,1}")
  @hint("Badge and card color once fixed (keep light: the display is additive)")
  @widget(new ColorWidget())
  fixedColor: vec4 = new vec4(0.55, 1, 0.6, 1)
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Verdict</span>')
  @ui.group_start("Verdict")
  @input
  @hint("What this item is, for logs and tests")
  displayName: string = "Item"

  @input
  @hint("Verdict shown in large text. Leave empty to show the fallback 'Not sure' verdict")
  verdict: string = ""

  @input
  @hint("One short reason shown under the verdict")
  reason: string = ""

  @input("vec4", "{1,1,1,1}")
  @hint("Color of the verdict text (keep light: the display is additive)")
  @widget(new ColorWidget())
  verdictColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Short status on the far-away badge (for example 'Needs gap'). Empty uses the verdict")
  badgeLabel: string = ""

  @input
  @hint("What to do, shown under the reason with a Done button. Empty means nothing to do")
  action: string = ""
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Interaction</span>')
  @ui.group_start("Interaction")
  @input("vec3", "{40,40,40}")
  @hint("Size (cm) of the pinch target box, centered on this object. Bigger than the visual = easier to hit")
  hitBoxSizeCm: vec3 = new vec3(40, 40, 40)

  @input
  @hint("Height (cm) from this object's origin up to the top of the item. The card floats above this point")
  topOffsetCm: number = 20

  @input("vec4", "{1,0.9,0.6,1}")
  @hint("Color the item's meshes blend toward while aimed at")
  @widget(new ColorWidget())
  hoverTint: vec4 = new vec4(1, 0.9, 0.6, 1)

  @input
  @hint("How strongly the hover tint is applied (0 = none, 1 = full tint)")
  @widget(new SliderWidget(0, 1, 0.05))
  hoverStrength: number = 0.45

  @input
  @hint("Draw the pinch target box as a wireframe (debug)")
  debugCollider: boolean = false
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Embers</span>')
  @ui.group_start("Embers")
  @input
  @hint("Catches embers (wood, mulch). Embers that land on it make it glow. A small nonwoody plant does not")
  combustible: boolean = false

  @input("vec4", "{1,0.45,0.1,1}")
  @hint("Color the item's meshes blend toward while an ember makes it glow")
  @widget(new ColorWidget())
  glowColor: vec4 = new vec4(1, 0.45, 0.1, 1)
  @ui.group_end

  private readonly pinchedEvent = new Event<FiveFeetItem>()
  readonly onPinched: PublicApi<FiveFeetItem> = this.pinchedEvent.publicApi()

  private interactable: Interactable
  private collider: ColliderComponent
  private materials: Material[] = []
  private baseColors: vec4[] = []
  private hoverCount = 0
  private glowUntil = 0
  private glowCount = 0
  private wasGlowing = false
  private far = false
  private farApplied = false
  private fixed = false
  private visuals: RenderMeshVisual[] = []

  onAwake(): void {
    if (this.checkBadge) this.checkBadge.enabled = false
    this.createCollider()
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = TARGETING_BOTH
    this.collectMaterials()
    this.createEvent("OnStartEvent").bind(() => {
      // The badge is a child, so it is only awake (and its methods callable) from OnStart on.
      if (this.badge) {
        const label = this.badgeLabel.trim().length > 0 ? this.badgeLabel : this.verdict
        this.badge.setStatus(label, this.verdictColor)
      }
      this.interactable.onTriggerStart.add(() => this.pinchedEvent.invoke(this))
      this.interactable.onHoverEnter.add(() => this.setHover(+1))
      this.interactable.onHoverExit.add(() => this.setHover(-1))
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /**
   * An ember landed on this item. A combustible item glows for `seconds` and returns true.
   * A non-combustible item ignores it and returns false.
   */
  ignite(seconds: number): boolean {
    if (!this.combustible) return false
    if (!this.isGlowing()) this.glowCount++
    this.glowUntil = Math.max(this.glowUntil, getTime() + seconds)
    return true
  }

  isGlowing(): boolean {
    return getTime() < this.glowUntil
  }

  /** How many separate times this item started glowing (for tests and logs). */
  getGlowCount(): number {
    return this.glowCount
  }

  /** Far away: show only the colored badge. Near: show the name tag. FiveFeetMain decides which. */
  setFar(far: boolean): void {
    if (this.farApplied && this.far === far) return
    this.far = far
    this.farApplied = true
    if (this.tag) this.tag.sceneObject.enabled = !far
    if (this.badge) this.badge.setVisible(far)
  }

  isFar(): boolean {
    return this.far
  }

  /** Distance (cm) along the ground from a world point (the user's eyes) to this item. */
  getGroundDistanceCm(fromWorld: vec3): number {
    const d = this.getTransform().getWorldPosition().sub(fromWorld)
    return new vec3(d.x, 0, d.z).length
  }

  /** The fix for this item is done: green check on, badge says Fixed. */
  markFixed(): void {
    this.fixed = true
    if (this.checkBadge) this.checkBadge.enabled = true
    if (this.badge) this.badge.setStatus(this.fixedLabel, this.fixedColor)
  }

  isFixed(): boolean {
    return this.fixed
  }

  /** Something to do about this item (it has an action and is not fixed yet). */
  needsAction(): boolean {
    return this.action.trim().length > 0 && !this.fixed
  }

  /** The item's mesh parts (each has its own material clone). */
  getMeshVisuals(): RenderMeshVisual[] {
    return this.visuals.slice()
  }

  /** Register a mesh part created at runtime (for example a split fence rail) for tinting. */
  addMeshVisual(rmv: RenderMeshVisual): void {
    this.visuals.push(rmv)
    this.materials.push(rmv.mainMaterial)
    this.baseColors.push(rmv.mainMaterial.mainPass.baseColor)
  }

  /** Change the resting color of one of this item's materials (after a fix recolors it). */
  setBaseColor(mat: Material, color: vec4): void {
    const i = this.materials.indexOf(mat)
    if (i >= 0) this.baseColors[i] = color
    this.applyTint()
  }

  /** True when the world point is inside this item's pinch box, grown by padCm on every side. */
  containsWorldPoint(worldPoint: vec3, padCm: number): boolean {
    const local = this.getTransform().getInvertedWorldTransform().multiplyPoint(worldPoint)
    const h = this.hitBoxSizeCm.uniformScale(0.5).add(vec3.one().uniformScale(padCm))
    return Math.abs(local.x) <= h.x && Math.abs(local.y) <= h.y && Math.abs(local.z) <= h.z
  }

  /** World point at the top-center of the item. */
  getTopWorldPosition(): vec3 {
    const t = this.getTransform()
    return t.getWorldPosition().add(vec3.up().uniformScale(this.topOffsetCm))
  }

  setColliderDebug(on: boolean): void {
    if (this.collider) this.collider.debugDrawEnabled = on
  }

  private createCollider(): void {
    const collider = this.sceneObject.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = this.hitBoxSizeCm
    collider.shape = shape
    collider.fitVisual = false
    collider.debugDrawEnabled = this.debugCollider
    this.collider = collider
  }

  private collectMaterials(): void {
    if (!this.visualRoot) {
      print("[FiveFeetItem] " + this.sceneObject.name + ": visualRoot not wired, hover highlight disabled")
      return
    }
    this.walk(this.visualRoot, (so) => {
      const rmvs = so.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[]
      for (const rmv of rmvs) {
        if (!rmv.mainMaterial) continue
        const mat = rmv.mainMaterial.clone()
        rmv.mainMaterial = mat
        this.visuals.push(rmv)
        this.materials.push(mat)
        this.baseColors.push(mat.mainPass.baseColor)
      }
    })
  }

  private walk(so: SceneObject, fn: (so: SceneObject) => void): void {
    fn(so)
    for (let i = 0; i < so.getChildrenCount(); i++) this.walk(so.getChild(i), fn)
  }

  private setHover(delta: number): void {
    this.hoverCount = Math.max(0, this.hoverCount + delta)
    this.applyTint()
    if (this.tag) this.tag.setHighlighted(this.hoverCount > 0)
  }

  private onUpdate(): void {
    const glowing = this.isGlowing()
    if (glowing || this.wasGlowing) this.applyTint()
    this.wasGlowing = glowing
  }

  /** Combine the hover tint and the pulsing ember glow on top of each mesh's base color. */
  private applyTint(): void {
    const hover = this.hoverCount > 0
    const glow = this.isGlowing() ? 0.7 + 0.25 * Math.sin(getTime() * 16) : 0
    for (let i = 0; i < this.materials.length; i++) {
      const base = this.baseColors[i]
      let c = hover ? vec4.lerp(base, this.hoverTint, this.hoverStrength) : base
      if (glow > 0) c = vec4.lerp(c, this.glowColor, glow)
      this.materials[i].mainPass.baseColor = new vec4(c.x, c.y, c.z, base.w)
    }
  }
}
