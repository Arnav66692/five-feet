/**
 * FiveFeetItemTagUI — small floating name tag above one stand-in item (passive view).
 *
 * Owns: a dark BackPlate with one light label ("Firewood stack"), yaw-billboarding
 *   toward the user, and a highlighted look while the item is aimed at.
 * Public API: setHighlighted(on: boolean), getLabel()
 * Must NOT: handle pinches or verdicts. FiveFeetItem drives highlight; FiveFeetMain drives the card.
 *
 * Scene contract: runtime-created children are Panel / Content / TagText.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const FONT_SIZE_SCALE = 1.0
const SUBHEADLINE = {size: 41, weight: 700}
const CONTENT_Z = 0.6
const CHAR_WIDTH_FACTOR = 0.016 // cm of width per character per unit of text size (bold)

@component
export class FiveFeetItemTagUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetItemTagUI – item name tag</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Name shown on the tag")
  label: string = "Item"

  @input
  @hint("Distance (cm) the text is sized for")
  @widget(new SliderWidget(80, 250, 5))
  readingDistanceCm: number = 140

  @input("vec4", "{1,1,1,0.85}")
  @hint("Label color at rest (keep light: the display is additive)")
  @widget(new ColorWidget())
  restColor: vec4 = new vec4(1, 1, 1, 0.85)

  @input("vec4", "{1,0.8,0.45,1}")
  @hint("Label color while the item is aimed at")
  @widget(new ColorWidget())
  highlightColor: vec4 = new vec4(1, 0.8, 0.45, 1)
  @ui.group_end

  private tagText!: Text
  private panel!: SceneObject
  private baseScale = vec3.one()

  onAwake(): void {
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.faceUserYaw())
  }

  setHighlighted(on: boolean): void {
    if (!this.tagText) return
    this.tagText.textFill.color = on ? this.highlightColor : this.restColor
    this.panel.getTransform().setLocalScale(on ? this.baseScale.uniformScale(1.15) : this.baseScale)
  }

  getLabel(): string {
    return this.tagText ? this.tagText.text : this.label
  }

  private faceUserYaw(): void {
    const cam = WorldCameraFinderProvider.getInstance()
    const t = this.getTransform()
    const d = cam.getWorldPosition().sub(t.getWorldPosition())
    const flat = new vec3(d.x, 0, d.z)
    if (flat.length < 0.001) return
    t.setWorldRotation(quat.lookAt(flat.normalize(), vec3.up()))
  }

  private build(): void {
    const panel = global.scene.createSceneObject("Panel")
    panel.setParent(this.sceneObject)
    this.panel = panel
    panel.createComponent("Component.Canvas")
    const backPlate = panel.createComponent(BackPlate.getTypeName()) as BackPlate
    backPlate.style = "dark"

    const content = global.scene.createSceneObject("Content")
    content.setParent(panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const size = SUBHEADLINE.size * FONT_SIZE_SCALE * (this.readingDistanceCm / 110)
    const widthCm = Math.max(8, this.label.length * size * CHAR_WIDTH_FACTOR + 2)
    const heightCm = 3.4

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // the label row is registered explicitly with addItems below
    flex.width = widthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.paddingTop = 0.5
    flex.paddingBottom = 0.5
    flex.paddingLeft = 0.8
    flex.paddingRight = 0.8
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(widthCm, r.containerHeight)
    })

    const so = global.scene.createSceneObject("TagText")
    so.setParent(content)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = size
    ;(t as Text & {weight?: number}).weight = SUBHEADLINE.weight
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const inner = widthCm - 1.6
    t.layoutRect = Rect.create(-inner / 2, inner / 2, -heightCm / 2, heightCm / 2)
    t.text = this.label
    t.textFill.color = this.restColor
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = heightCm
    flex.addItems([item])
    this.tagText = t
  }
}
