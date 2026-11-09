/**
 * FiveFeetVerdictCardUI — the single floating verdict card (passive view).
 *
 * Owns: the card surface (dark BackPlate, 25 cm wide at scale 1), the rows
 *   VerdictText (large), ReasonText (one short reason), ActionText (what to do),
 *   DoneButton (UI Kit button, only when there is something to do),
 *   FooterText ("State rule..."), billboarding toward the user, growing with the user's
 *   distance, and the auto-hide timer (view state only).
 * Public API (main script calls these):
 *   showVerdict(verdict, reason, verdictColor, worldPosition, action?, showDone?)
 *   hide(), onDone
 *   isShowing(), isDoneShowing(), getVerdictText(), getReasonText(), getActionText(),
 *   getFooterText(), getDistanceScale()
 * Must NOT: decide which verdict applies to which item, or what Done does. That is FiveFeetMain's job.
 *
 * Scene contract: runtime-created children are named so tests can find them:
 *   VerdictCard (this) / CardPanel / Content / VerdictText | ReasonText | ActionText |
 *   DoneButton | FooterText
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
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {addContentToElement} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContentFactory"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

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
const VERDICT_LINE_HEIGHT_FALLBACK_CM = 2.24 // measured line box of the HeadlineXL verdict at 140 cm sizing

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

  @input("vec4", "{1,0.9,0.6,1}")
  @hint("Action line color (keep light: the display is additive)")
  @widget(new ColorWidget())
  actionColor: vec4 = new vec4(1, 0.9, 0.6, 1)

  @input
  @hint("Done button width in cm at scale 1 (brief: at least 8 cm)")
  @widget(new SliderWidget(8, 22, 0.5))
  doneButtonWidthCm: number = 14

  @input
  @hint("Done button height in cm at scale 1")
  @widget(new SliderWidget(3, 8, 0.25))
  doneButtonHeightCm: number = 5

  @input
  @hint("Label on the Done button")
  doneLabel: string = "Done"
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Distance scaling</span>')
  @ui.group_start("Distance scaling")
  @input
  @hint("Grow the card with the user's distance so the verdict keeps the same apparent size")
  scaleWithDistance: boolean = true

  @input
  @hint("Verdict text height (cm) when the user is at the reference distance (brief: about 3 cm at 1 m)")
  @widget(new SliderWidget(1, 6, 0.1))
  verdictHeightAtReferenceCm: number = 3

  @input
  @hint("Reference distance (cm) for the verdict height above")
  @widget(new SliderWidget(50, 200, 5))
  referenceDistanceCm: number = 100

  @input
  @hint("Closer than this (cm) the card stops shrinking")
  @widget(new SliderWidget(30, 150, 5))
  minScaleDistanceCm: number = 70

  @input
  @hint("Farther than this (cm) the card stops growing")
  @widget(new SliderWidget(200, 800, 10))
  maxScaleDistanceCm: number = 400
  @ui.group_end

  private panel!: SceneObject
  private verdictText!: Text
  private reasonText!: Text
  private footerText!: Text
  private actionText!: Text
  private doneButtonSo!: SceneObject
  private doneButton!: Button
  private readonly doneEvent = new Event<void>()
  readonly onDone: PublicApi<void> = this.doneEvent.publicApi()
  private hideEvent!: DelayedCallbackEvent
  private showing = false
  private initialHideDone = false
  private anchorLocal = vec3.zero() // anchor in the parent's (rig's) space, so the card stays with the yard
  private cardHeightCm = 0
  private distanceScale = 1

  onAwake(): void {
    this.buildCard()
    this.hideEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.hideEvent.bind(() => this.hide())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /**
   * Show the card centered at worldPosition (its center at scale 1) with the given verdict.
   * Restarts the auto-hide timer. While showing, the card grows with the user's distance and
   * lifts so its bottom edge stays where it would be at scale 1.
   */
  showVerdict(
    verdict: string,
    reason: string,
    verdictColor: vec4,
    worldPosition: vec3,
    action: string = "",
    showDone: boolean = false
  ): void {
    this.verdictText.text = verdict
    this.verdictText.textFill.color = verdictColor
    this.reasonText.text = reason
    this.reasonText.sceneObject.enabled = reason.length > 0
    this.actionText.text = action
    this.actionText.sceneObject.enabled = action.length > 0
    this.doneButtonSo.enabled = showDone
    this.footerText.text = this.footerLine
    this.anchorLocal = this.toParentSpace(worldPosition)
    this.getTransform().setWorldPosition(worldPosition)
    this.panel.getTransform().setLocalScale(vec3.one())
    this.panel.enabled = true
    this.showing = true
    this.initialHideDone = true
    this.applyDistanceScale()
    this.faceUser()
    this.hideEvent.reset(this.autoHideSeconds)
  }

  /** Current card scale from the user's distance (1 when distance scaling is off). */
  getDistanceScale(): number {
    return this.distanceScale
  }

  hide(): void {
    this.showing = false
    if (this.panel) this.panel.enabled = false
  }

  isShowing(): boolean {
    return this.showing
  }

  /** True while the card is showing with its Done button. */
  isDoneShowing(): boolean {
    return this.showing && this.doneButtonSo.enabled
  }

  getActionText(): string {
    return this.actionText ? this.actionText.text : ""
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
    if (this.showing) {
      this.applyDistanceScale()
      this.faceUser()
    }
  }

  /**
   * Scale the whole card by the user's ground distance to its anchor, so the verdict text is
   * verdictHeightAtReferenceCm tall at referenceDistanceCm and the same apparent size elsewhere.
   */
  private applyDistanceScale(): void {
    const t = this.getTransform()
    const anchorWorld = this.toWorldSpace(this.anchorLocal)
    if (!this.scaleWithDistance) {
      this.distanceScale = 1
      t.setWorldScale(vec3.one())
      t.setWorldPosition(anchorWorld)
      return
    }
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const d = anchorWorld.sub(eye)
    const ground = new vec3(d.x, 0, d.z).length
    const clamped = Math.min(this.maxScaleDistanceCm, Math.max(this.minScaleDistanceCm, ground))
    const targetHeight = this.verdictHeightAtReferenceCm * (clamped / this.referenceDistanceCm)
    this.distanceScale = targetHeight / this.verdictLineHeightCm()
    t.setWorldScale(vec3.one().uniformScale(this.distanceScale))
    const lift = (this.cardHeightCm / 2) * (this.distanceScale - 1)
    t.setWorldPosition(anchorWorld.add(vec3.up().uniformScale(lift)))
  }

  private toParentSpace(world: vec3): vec3 {
    const parent = this.sceneObject.getParent()
    return parent ? parent.getTransform().getInvertedWorldTransform().multiplyPoint(world) : world
  }

  private toWorldSpace(local: vec3): vec3 {
    const parent = this.sceneObject.getParent()
    return parent ? parent.getTransform().getWorldTransform().multiplyPoint(local) : local
  }

  /** Height (cm, unscaled) of the verdict line as laid out. Measured: 2.24 cm for this font size. */
  private verdictLineHeightCm(): number {
    const r = this.verdictText.getBoundingBox()
    const h = r.top - r.bottom
    return h > 0.1 ? h : VERDICT_LINE_HEIGHT_FALLBACK_CM
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
      this.cardHeightCm = r.containerHeight
    })

    const d = this.readingDistanceCm
    this.verdictText = this.addRow(content, "VerdictText", "HeadlineXL", d, inner, 3.0, HorizontalOverflow.Shrink)
    this.reasonText = this.addRow(content, "ReasonText", "Body", d, inner, 3.4, HorizontalOverflow.Wrap)
    this.reasonText.textFill.color = this.reasonColor
    this.actionText = this.addRow(content, "ActionText", "Callout", d, inner, 3.4, HorizontalOverflow.Wrap)
    this.actionText.textFill.color = this.actionColor
    this.doneButtonSo = this.addDoneButton(content)
    this.footerText = this.addRow(content, "FooterText", "Caption", d, inner, 3.0, HorizontalOverflow.Wrap)
    this.footerText.textFill.color = this.footerColor
    this.footerText.text = this.footerLine

    const rows = [this.verdictText.sceneObject, this.reasonText.sceneObject, this.actionText.sceneObject]
    rows.push(this.doneButtonSo, this.footerText.sceneObject)
    flex.addItems(rows.map((so) => so.getComponent(FlexItem.getTypeName()) as FlexItem))
  }

  /**
   * One centered UI Kit button. It is its own flex item: the layout sizes UI Kit Elements through
   * their width and height, while a plain wrapper object would be stretched by scale.
   * Pressing it fires onDone.
   */
  private addDoneButton(parent: SceneObject): SceneObject {
    const buttonSo = global.scene.createSceneObject("DoneButton")
    buttonSo.setParent(parent)
    const button = buttonSo.createComponent(Button.getTypeName()) as Button
    button.setTheme("SnapOS3", "Primary")
    button.size = new vec3(this.doneButtonWidthCm, this.doneButtonHeightCm, 1)
    addContentToElement(buttonSo, {text: this.doneLabel, textSize: roleSize("Button", this.readingDistanceCm)})
    button.initialize()
    button.onTriggerUp.add(() => this.doneEvent.invoke())
    const item = buttonSo.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    this.doneButton = button
    return buttonSo
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
