/**
 * FiveFeetProgressUI — small progress panel on the house wall (passive view).
 *
 * Owns: a dark BackPlate with one light line "Zone 0: N of M fixed", fixed to the wall face
 *   (no billboarding), sized to read from where the user stands.
 * Public API: setProgress(fixed, total), getText()
 * Must NOT: count anything. FiveFeetMain owns the count.
 *
 * Scene contract: runtime-created children are Panel / Content / ProgressText.
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

const FONT_SIZE_SCALE = 1.0
const SUBHEADLINE = {size: 41, weight: 700}
const CONTENT_Z = 0.6
const LINE_HEIGHT_PER_SIZE = 0.036 // measured: size 78.9 text has a 2.24 cm line box, plus a little room

@component
export class FiveFeetProgressUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetProgressUI – Zone 0 progress on the wall</span>')
  @ui.separator
  @input
  @hint("Text pattern. {fixed} and {total} are replaced")
  pattern: string = "Zone 0: {fixed} of {total} fixed"

  @input
  @hint("Distance (cm) the text is sized for. The user stands about 2.5 m from the wall")
  @widget(new SliderWidget(100, 400, 5))
  readingDistanceCm: number = 250

  @input
  @hint("Panel width (cm)")
  @widget(new SliderWidget(20, 80, 1))
  widthCm: number = 46

  @input("vec4", "{1,1,1,0.95}")
  @hint("Text color while items still need fixing (keep light: the display is additive)")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 0.95)

  @input("vec4", "{0.55,1,0.6,1}")
  @hint("Text color once everything is fixed")
  @widget(new ColorWidget())
  doneColor: vec4 = new vec4(0.55, 1, 0.6, 1)

  private progressText!: Text

  onAwake(): void {
    this.build()
  }

  setProgress(fixed: number, total: number): void {
    if (!this.progressText) return
    this.progressText.text = this.pattern.replace("{fixed}", "" + fixed).replace("{total}", "" + total)
    this.progressText.textFill.color = total > 0 && fixed >= total ? this.doneColor : this.textColor
  }

  getText(): string {
    return this.progressText ? this.progressText.text : ""
  }

  private build(): void {
    const panel = global.scene.createSceneObject("Panel")
    panel.setParent(this.sceneObject)
    panel.createComponent("Component.Canvas")
    const backPlate = panel.createComponent(BackPlate.getTypeName()) as BackPlate
    backPlate.style = "dark"

    const content = global.scene.createSceneObject("Content")
    content.setParent(panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const size = SUBHEADLINE.size * FONT_SIZE_SCALE * (this.readingDistanceCm / 110)
    const heightCm = size * LINE_HEIGHT_PER_SIZE
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // the text row is registered explicitly with addItems below
    flex.width = this.widthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Center
    flex.paddingTop = 1.2
    flex.paddingBottom = 1.2
    flex.paddingLeft = 2
    flex.paddingRight = 2
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(this.widthCm, r.containerHeight)
    })

    const so = global.scene.createSceneObject("ProgressText")
    so.setParent(content)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = size
    ;(t as Text & {weight?: number}).weight = SUBHEADLINE.weight
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const inner = this.widthCm - 4
    t.layoutRect = Rect.create(-inner / 2, inner / 2, -heightCm / 2, heightCm / 2)
    t.textFill.color = this.textColor
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = heightCm
    flex.addItems([item])
    this.progressText = t
    this.setProgress(0, 0)
  }
}
