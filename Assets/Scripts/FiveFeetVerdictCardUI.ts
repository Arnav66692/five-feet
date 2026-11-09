/**
 * FiveFeetVerdictCardUI — the single floating verdict card (passive view).
 *
 * Owns: the card surface (dark BackPlate, 25 cm wide), three text rows
 *   VerdictText (large), ReasonText (one short reason), FooterText ("State rule..."),
 *   billboarding toward the user, and the auto-hide timer (view state only).
 * Public API (main script calls these):
 *   showVerdict(verdict, reason, verdictColor, worldPosition)
 *   hide()
 *   isShowing(), getVerdictText(), getReasonText(), getFooterText()
 * Must NOT: decide which verdict applies to which item. That is FiveFeetMain's job.
 *
 * Scene contract: runtime-created children are named so tests can find them:
 *   VerdictCard (this) / CardPanel / Content / VerdictText | ReasonText | FooterText
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

// ── Typography: the single source of truth for text size + weight ────────────
const FONT_SIZE_SCALE = 1.0 // SnapOS system font metrics.

type TextRole =
  | "Title1"
  | "Title2"
  | "HeadlineXL"
  | "Headline1"
  | "Headline2"
  | "Subheadline"
  | "Button"
  | "Callout"
  | "Body"
  | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500}
}

function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const CONTENT_Z = 0.6 // depth tie-breaker in front of the BackPlate face
const MIN_SCALE = 0.0001

@component
export class FiveFeetVerdictCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetVerdictCardUI – floating verdict card</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Card width in cm (brief default 25 cm)")
  @widget(new SliderWidget(15, 40, 0.5))
  cardWidthCm: number = 25

  @input
  @hint("Inner padding of the card in cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  paddingCm: number = 1.5

  @input
  @hint("Gap between the verdict, reason and footer rows in cm")
  @widget(new SliderWidget(0, 3, 0.1))
  rowGapCm: number = 0.6

  @input
  @hint("Distance (cm) the text is sized for. The card is read from about 1.2 to 1.7 m away")
  @widget(new SliderWidget(80, 250, 5))
  readingDistanceCm: number = 140

  @input
  @hint("Seconds before the card hides itself after it is shown (brief default 8 s)")
  @widget(new SliderWidget(2, 30, 0.5))
  autoHideSeconds: number = 8

  @input
  @hint("Footer line shown on every card")
  footerLine: string = "State rule. Check your local fire agency."

  @input("vec4", "{1,1,1,0.95}")
  @hint("Reason text color (keep light: the display is additive)")
  @widget(new ColorWidget())
  reasonColor: vec4 = new vec4(1, 1, 1, 0.95)

  @input("vec4", "{1,1,1,0.7}")
  @hint("Footer text color (keep light: the display is additive)")
  @widget(new ColorWidget())
  footerColor: vec4 = new vec4(1, 1, 1, 0.7)
  @ui.group_end

  private panel!: SceneObject
  private verdictText!: Text
  private reasonText!: Text
  private footerText!: Text
  private hideEvent!: DelayedCallbackEvent
  private showing = false
  private initialHideDone = false

  onAwake(): void {
    this.buildCard()
    this.hideEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.hideEvent.bind(() => this.hide())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Show the card centered at worldPosition with the given verdict. Restarts the auto-hide timer. */
  showVerdict(verdict: string, reason: string, verdictColor: vec4, worldPosition: vec3): void {
    this.verdictText.text = verdict
    this.verdictText.textFill.color = verdictColor
    this.reasonText.text = reason
    this.reasonText.sceneObject.enabled = reason.length > 0
    this.footerText.text = this.footerLine
    this.getTransform().setWorldPosition(worldPosition)
    this.panel.getTransform().setLocalScale(vec3.one())
    this.panel.enabled = true
    this.showing = true
    this.initialHideDone = true
    this.faceUser()
    this.hideEvent.reset(this.autoHideSeconds)
  }

  hide(): void {
    this.showing = false
    if (this.panel) this.panel.enabled = false
  }

  isShowing(): boolean {
    return this.showing
  }

  getVerdictText(): string {
    return this.verdictText ? this.verdictText.text : ""
  }

  getReasonText(): string {
    return this.reasonText ? this.reasonText.text : ""
  }

  getFooterText(): string {
    return this.footerText ? this.footerText.text : ""
  }

  private onUpdate(): void {
    if (!this.initialHideDone) {
      // Hide after the BackPlate has initialized on OnStart (disabling before start would skip its init).
      this.initialHideDone = true
      this.panel.enabled = false
      return
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

  private buildCard(): void {
    const panel = global.scene.createSceneObject("CardPanel")
    panel.setParent(this.sceneObject)
    panel.getTransform().setLocalScale(new vec3(MIN_SCALE, MIN_SCALE, MIN_SCALE)) // invisible until first show
    this.panel = panel

    panel.createComponent("Component.Canvas") // Hierarchy sort: backing first, content after
    const backPlate = panel.createComponent(BackPlate.getTypeName()) as BackPlate
    backPlate.style = "dark"

    const content = global.scene.createSceneObject("Content")
    content.setParent(panel)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const inner = this.cardWidthCm - this.paddingCm * 2
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false // rows are registered explicitly with addItems below
    flex.width = this.cardWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.alignItems = FlexAlign.Stretch
    flex.justifyContent = FlexJustify.Start
    flex.rowGap = this.rowGapCm
    flex.paddingTop = this.paddingCm
    flex.paddingBottom = this.paddingCm
    flex.paddingLeft = this.paddingCm
    flex.paddingRight = this.paddingCm
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(this.cardWidthCm, r.containerHeight)
    })

    const d = this.readingDistanceCm
    this.verdictText = this.addRow(content, "VerdictText", "HeadlineXL", d, inner, 3.0, HorizontalOverflow.Shrink)
    this.reasonText = this.addRow(content, "ReasonText", "Body", d, inner, 3.4, HorizontalOverflow.Wrap)
    this.reasonText.textFill.color = this.reasonColor
    this.footerText = this.addRow(content, "FooterText", "Caption", d, inner, 3.0, HorizontalOverflow.Wrap)
    this.footerText.textFill.color = this.footerColor
    this.footerText.text = this.footerLine

    flex.addItems(
      [this.verdictText, this.reasonText, this.footerText].map(
        (t) => t.sceneObject.getComponent(FlexItem.getTypeName()) as FlexItem
      )
    )
  }

  private addRow(
    parent: SceneObject,
    name: string,
    role: TextRole,
    distanceCm: number,
    widthCm: number,
    heightCm: number,
    overflow: HorizontalOverflow
  ): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const t = so.createComponent("Component.Text") as Text
    t.depthTest = true
    applyTextRole(t, role, distanceCm)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    t.textFill.color = new vec4(1, 1, 1, 1)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Stretch
    item.overrideHeight = heightCm
    return t
  }
}
