/**
 * FiveFeetItemBadgeUI — small colored status badge above one item, read from far away (passive view).
 *
 * Owns: a dark BackPlate with one short colored status ("Move now", "Needs gap", "Fixed"),
 *   sized to read from about 3 m, yaw-billboarding toward the user, and its own visibility.
 * Public API: setStatus(text, color), setVisible(on), isVisible(), getStatus()
 * Must NOT: decide when it shows or what it says. FiveFeetItem drives it from distance and fix state.
 *
 * Scene contract: runtime-created children are Panel / Content / BadgeText.
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
const MIN_WIDTH_CHARS = 6 // keep short labels like "OK" from making a tiny badge
const LINE_HEIGHT_PER_SIZE = 0.036 // measured: size 78.9 text has a 2.24 cm line box, plus a little room

@component
export class FiveFeetItemBadgeUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetItemBadgeUI – far-away status badge</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Status shown until the item changes it (for example 'Move now')")
  status: string = "Status"

  @input("vec4", "{1,1,1,1}")
  @hint("Status text color (keep light: the display is additive)")
  @widget(new ColorWidget())
  statusColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Distance (cm) the text is sized for. Badges show from farther than 2.5 m")
  @widget(new SliderWidget(150, 500, 5))
  readingDistanceCm: number = 300

  @input
  @hint("Longest status the badge must fit, in characters")
  @widget(new SliderWidget(4, 16, 1))
  maxChars: number = 9
  @ui.group_end

  private badgeText!: Text
  private panel!: SceneObject
  private visible = false
  private startHideDone = false

  onAwake(): void {
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  setStatus(text: string, color: vec4): void {
    this.status = text
    this.statusColor = color
    if (!this.badgeText) return
    this.badgeText.text = text
    this.badgeText.textFill.color = color
  }

  setVisible(on: boolean): void {
    this.visible = on
    if (this.panel && this.startHideDone) this.panel.enabled = on
  }

  isVisible(): boolean {
    return this.visible && this.panel.enabled && this.sceneObject.isEnabledInHierarchy
  }

  getStatus(): string {
    return this.badgeText ? this.badgeText.text : this.status
  }

  private onUpdate(): void {
    if (!this.startHideDone) {
      // Apply visibility after the BackPlate has initialized on OnStart (disabling before start skips its init).
      this.startHideDone = true
      this.panel.enabled = this.visible
    }
    if (this.visible) this.faceUserYaw()
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
    const chars = Math.max(MIN_WIDTH_CHARS, this.maxChars)
    const widthCm = chars * size * CHAR_WIDTH_FACTOR + 3
    const heightCm = size * LINE_HEIGHT_PER_SIZE

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // the label row is registered explicitly with addItems below
    flex.width = widthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.paddingTop = 1
    flex.paddingBottom = 1
    flex.paddingLeft = 1.5
    flex.paddingRight = 1.5
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(widthCm, r.containerHeight)
    })

    const so = global.scene.createSceneObject("BadgeText")
    so.setParent(content)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = size
    ;(t as Text & {weight?: number}).weight = SUBHEADLINE.weight
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const inner = widthCm - 3
    t.layoutRect = Rect.create(-inner / 2, inner / 2, -heightCm / 2, heightCm / 2)
    t.text = this.status
    t.textFill.color = this.statusColor
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = heightCm
    flex.addItems([item])
    this.badgeText = t
  }
}
