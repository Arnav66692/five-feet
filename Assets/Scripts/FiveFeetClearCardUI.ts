/**
 * FiveFeetClearCardUI — the "Zone 0 clear" card at the center of the wall (passive view).
 *
 * Owns: a dark BackPlate with a large green title and the state-rule footer, billboarding
 *   toward the user, hidden until show().
 * Public API: show(), hide(), isShowing(), getTitle(), getFooter()
 * Must NOT: decide when the zone is clear. FiveFeetMain does.
 *
 * Scene contract: runtime-created children are Panel / Content / ClearTitle | ClearFooter.
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
const TITLE = {size: 62, weight: 700} // HeadlineXL
const CAPTION = {size: 38, weight: 500}
const CONTENT_Z = 0.6
const LINE_HEIGHT_PER_SIZE = 0.036 // measured: size 78.9 text has a 2.24 cm line box, plus a little room

@component
export class FiveFeetClearCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetClearCardUI – Zone 0 clear card</span>')
  @ui.separator
  @input
  @hint("Title shown when every item is fixed")
  title: string = "Zone 0 clear"

  @input
  @hint("Footer line under the title")
  footerLine: string = "State rule. Check your local fire agency."

  @input
  @hint("Distance (cm) the text is sized for. The user stands about 2.5 m from the wall")
  @widget(new SliderWidget(100, 400, 5))
  readingDistanceCm: number = 250

  @input
  @hint("Card width (cm)")
  @widget(new SliderWidget(30, 100, 1))
  widthCm: number = 60

  @input("vec4", "{0.55,1,0.6,1}")
  @hint("Title color (keep light: the display is additive)")
  @widget(new ColorWidget())
  titleColor: vec4 = new vec4(0.55, 1, 0.6, 1)

  @input("vec4", "{1,1,1,0.75}")
  @hint("Footer color (keep light: the display is additive)")
  @widget(new ColorWidget())
  footerColor: vec4 = new vec4(1, 1, 1, 0.75)

  private panel!: SceneObject
  private titleText!: Text
  private footerText!: Text
  private showing = false
  private startHideDone = false

  onAwake(): void {
    this.build()
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  show(): void {
    this.showing = true
    if (this.startHideDone) this.panel.enabled = true
    this.faceUser()
  }

  hide(): void {
    this.showing = false
    if (this.startHideDone) this.panel.enabled = false
  }

  isShowing(): boolean {
    return this.showing && this.panel.enabled && this.sceneObject.isEnabledInHierarchy
  }

  getTitle(): string {
    return this.titleText ? this.titleText.text : ""
  }

  getFooter(): string {
    return this.footerText ? this.footerText.text : ""
  }

  private onUpdate(): void {
    if (!this.startHideDone) {
      // Apply visibility after the BackPlate has initialized on OnStart (disabling before start skips its init).
      this.startHideDone = true
      this.panel.enabled = this.showing
    }
    if (this.showing) this.faceUser()
  }

  private faceUser(): void {
    const cam = WorldCameraFinderProvider.getInstance()
    const t = this.getTransform()
    const toCam = cam.getWorldPosition().sub(t.getWorldPosition())
    if (toCam.length < 0.001) return
    t.setWorldRotation(quat.lookAt(toCam.normalize(), vec3.up()))
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

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // rows are registered explicitly with addItems below
    flex.width = this.widthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.rowGap = 1
    flex.paddingTop = 2
    flex.paddingBottom = 2
    flex.paddingLeft = 2.5
    flex.paddingRight = 2.5
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(this.widthCm, r.containerHeight)
    })

    const k = this.readingDistanceCm / 110
    this.titleText = this.addRow(content, "ClearTitle", TITLE.size * k, TITLE.weight, HorizontalOverflow.Shrink)
    this.titleText.text = this.title
    this.titleText.textFill.color = this.titleColor
    this.footerText = this.addRow(content, "ClearFooter", CAPTION.size * k, CAPTION.weight, HorizontalOverflow.Wrap)
    this.footerText.text = this.footerLine
    this.footerText.textFill.color = this.footerColor
    flex.addItems(
      [this.titleText, this.footerText].map((t) => t.sceneObject.getComponent(FlexItem.getTypeName()) as FlexItem)
    )
  }

  private addRow(parent: SceneObject, name: string, size: number, weight: number, overflow: HorizontalOverflow): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = size * FONT_SIZE_SCALE
    ;(t as Text & {weight?: number}).weight = weight
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    const inner = this.widthCm - 5
    const lines = overflow === HorizontalOverflow.Wrap ? 2 : 1
    const heightCm = size * LINE_HEIGHT_PER_SIZE * lines
    t.layoutRect = Rect.create(-inner / 2, inner / 2, -heightCm / 2, heightCm / 2)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = heightCm
    return t
  }
}
