/**
 * FiveFeetItem — one pinchable stand-in item near the house wall (controller).
 *
 * Owns: this item's verdict data (displayName, verdict, reason, color), its SIK
 *   pinch target (box ColliderComponent + Interactable on THIS SceneObject, so
 *   LEAF can find it with findInteractablesByName("Item_<Name>")), and the hover highlight.
 * Expects @inputs: visualRoot (leaf meshes to tint on hover), tag (its name tag view).
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
  @hint("Name tag above this item (optional)")
  tag: FiveFeetItemTagUI
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

  private readonly pinchedEvent = new Event<FiveFeetItem>()
  readonly onPinched: PublicApi<FiveFeetItem> = this.pinchedEvent.publicApi()

  private interactable: Interactable
  private collider: ColliderComponent
  private materials: Material[] = []
  private baseColors: vec4[] = []
  private hoverCount = 0

  onAwake(): void {
    this.createCollider()
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = TARGETING_BOTH
    this.collectMaterials()
    this.createEvent("OnStartEvent").bind(() => {
      this.interactable.onTriggerStart.add(() => this.pinchedEvent.invoke(this))
      this.interactable.onHoverEnter.add(() => this.setHover(+1))
      this.interactable.onHoverExit.add(() => this.setHover(-1))
    })
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
    const on = this.hoverCount > 0
    for (let i = 0; i < this.materials.length; i++) {
      const base = this.baseColors[i]
      const c = on ? vec4.lerp(base, this.hoverTint, this.hoverStrength) : base
      this.materials[i].mainPass.baseColor = new vec4(c.x, c.y, c.z, base.w)
    }
    if (this.tag) this.tag.setHighlighted(on)
  }
}
