/**
 * FiveFeetVerdictCardUI — the single floating verdict card (passive view).
 *
 * Owns: the card surface (dark BackPlate), the rows VerdictText (large), ReasonText (one short
 *   reason), ActionText (what to do), DoneButton (light green UI Kit button, only when there is
 *   something to do), FooterText ("State rule..."), where the card sits in the user's view,
 *   billboarding toward the user, and the auto-hide timer (view state only).
 * Placement: on the line from the user's eye to the item's top, cardDistanceCm from the eye (closer
 *   when the item is nearer), lifted so its bottom edge sits just above the highest point of the
 *   item's bounds as the user sees them,
 *   and scaled so the verdict always subtends verdictAngleDeg (same apparent size at any distance).
 *   If the card would leave the current view, it slides back inside it. "Up" is the yard's up
 *   (the parent's), so the card stays right when the yard is tilted.
 * Public API (main script calls these):
 *   showVerdict(verdict, reason, verdictColor, itemBoundsMin, itemBoundsMax, action?, showDone?)
 *   hide(), onDone, onHidden
 *   isShowing(), isDoneShowing(), getVerdictText(), getReasonText(), getActionText(),
 *   getFooterText(), getVerdictAngleDeg()
 * Must NOT: decide which verdict applies to which item, or what Done does. That is FiveFeetMain's job.
 *
 * Scene contract: runtime-created children are named so tests can find them:
 *   VerdictCard (this) / CardPanel / Content / VerdictText | ReasonText | ActionText |
 *   DoneButton (/ DoneLabel) | FooterText
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
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"
import {GradientParameters} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
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
const LINE_HEIGHT_PER_SIZE = 0.0284 // measured: size 78.9 text has a 2.24 cm line box
const CHAR_WIDTH_PER_SIZE = 0.0135 // measured 0.0132 for bold text, rounded up so wrapping is never underestimated
const ROW_PAD_CM = 0.3
const VIEW_MARGIN_DEG = 1.5
const MIN_CARD_DISTANCE_CM = 35
const ITEM_GAP_CM = 25 // keep the card at least this far in front of the item

/** Solid (single color) gradient for a UI Kit rounded rectangle state. */
function solid(color: vec4): GradientParameters {
  return {
    enabled: true,
    type: "Linear",
    start: new vec2(-1, 0),
    end: new vec2(1, 0),
    stop0: {enabled: true, percent: 0, color},
    stop1: {enabled: true, percent: 1, color}
  }
}

@component
export class FiveFeetVerdictCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetVerdictCardUI – floating verdict card</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Card width in cm at scale 1")
  @widget(new SliderWidget(15, 40, 0.5))
  cardWidthCm: number = 28

  @input
  @hint("Inner padding of the card in cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  paddingCm: number = 1.0

  @input
  @hint("Gap between the rows in cm")
  @widget(new SliderWidget(0, 3, 0.05))
  rowGapCm: number = 0.35

  @input
  @hint("Distance (cm) the text sizes are designed for (the card is then scaled for its real distance)")
  @widget(new SliderWidget(80, 250, 5))
  readingDistanceCm: number = 140

  @input
  @hint("Seconds before a card with nothing to do hides itself (brief default 8 s)")
  @widget(new SliderWidget(2, 30, 0.5))
  autoHideSeconds: number = 8

  @input
  @hint("Seconds before a card with a Done button hides itself, so there is time to act and press Done")
  @widget(new SliderWidget(2, 60, 0.5))
  actionCardHideSeconds: number = 20

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
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Done button</span>')
  @ui.group_start("Done button")
  @input
  @hint("Done button width in cm at scale 1 (about 13.7 cm at 0.9 m with the default text size)")
  @widget(new SliderWidget(8, 22, 0.5))
  doneButtonWidthCm: number = 15

  @input
  @hint("Done button height in cm at scale 1")
  @widget(new SliderWidget(3, 8, 0.25))
  doneButtonHeightCm: number = 4

  @input
  @hint("Label on the Done button")
  doneLabel: string = "Done"

  @input("vec4", "{0.55,0.95,0.6,1}")
  @hint("Done button fill (light green)")
  @widget(new ColorWidget())
  doneColor: vec4 = new vec4(0.55, 0.95, 0.6, 1)

  @input("vec4", "{0.05,0.16,0.08,1}")
  @hint("Done label color (dark, on the light green fill)")
  @widget(new ColorWidget())
  doneTextColor: vec4 = new vec4(0.05, 0.16, 0.08, 1)
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Placement</span>')
  @ui.group_start("Placement")
  @input
  @hint("Distance (cm) from the eye to the card, along the line to the item (closer if the item is nearer)")
  @widget(new SliderWidget(40, 200, 5))
  cardDistanceCm: number = 90

  @input
  @hint("Angular height (degrees) of the verdict text. Kept the same at every distance")
  @widget(new SliderWidget(0.8, 3, 0.05))
  verdictAngleDeg: number = 1.3

  @input
  @hint("Gap (degrees) between the item's top and the card's bottom edge, as the user sees it")
  @widget(new SliderWidget(0, 5, 0.1))
  gapAboveItemDeg: number = 0.8
  @ui.group_end

  private panel!: SceneObject
  private flex!: FlexLayout
  private verdictText!: Text
  private reasonText!: Text
  private footerText!: Text
  private actionText!: Text
  private doneButtonSo!: SceneObject
  private doneButton!: Button
  private readonly doneEvent = new Event<void>()
  readonly onDone: PublicApi<void> = this.doneEvent.publicApi()
  private readonly hiddenEvent = new Event<void>()
  readonly onHidden: PublicApi<void> = this.hiddenEvent.publicApi()
  private hideEvent!: DelayedCallbackEvent
  private showing = false
  private initialHideDone = false
  // Item bounds corners in the parent's (rig's) space, so the card stays with the yard.
  private itemCornersLocal: vec3[] = []
  private cardHeightCm = 0
  private doneFired = false

  onAwake(): void {
    this.buildCard()
    this.hideEvent = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.hideEvent.bind(() => this.hide())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /**
   * Show the card for an item with these world bounds (its meshes). Restarts the auto-hide timer.
   * While showing, the card follows the user's eye so it stays in view above the item.
   */
  showVerdict(
    verdict: string,
    reason: string,
    verdictColor: vec4,
    itemBoundsMin: vec3,
    itemBoundsMax: vec3,
    action: string = "",
    showDone: boolean = false
  ): void {
    this.verdictText.text = verdict
    this.verdictText.textFill.color = verdictColor
    this.setRow(this.reasonText, reason, "Body")
    this.setRow(this.actionText, action, "Callout")
    this.doneButtonSo.enabled = showDone
    this.footerText.text = this.footerLine
    this.setFlexRows(showDone)
    this.itemCornersLocal = []
    for (const x of [itemBoundsMin.x, itemBoundsMax.x])
      for (const y of [itemBoundsMin.y, itemBoundsMax.y])
        for (const z of [itemBoundsMin.z, itemBoundsMax.z]) this.itemCornersLocal.push(this.toParentSpace(new vec3(x, y, z)))
    this.panel.getTransform().setLocalScale(vec3.one())
    this.panel.enabled = true
    this.showing = true
    this.initialHideDone = true
    this.doneFired = false
    this.place()
    this.hideEvent.reset(showDone ? this.actionCardHideSeconds : this.autoHideSeconds)
  }

  hide(): void {
    const wasShowing = this.showing
    this.showing = false
    if (this.panel) this.panel.enabled = false
    if (wasShowing) this.hiddenEvent.invoke()
  }

  isShowing(): boolean {
    return this.showing
  }

  /** True while the card is showing with its Done button. */
  isDoneShowing(): boolean {
    return this.showing && this.doneButtonSo.enabled
  }

  /** Angular height (degrees) the verdict line has at the card's current distance and scale. */
  getVerdictAngleDeg(): number {
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const t = this.verdictText.getTransform()
    const h = this.verdictLineHeightCm() * t.getWorldScale().y
    const d = t.getWorldPosition().sub(eye).length
    return (2 * Math.atan(h / 2 / d) * 180) / Math.PI
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

  /** Current card height and width (cm, unscaled), for tests. */
  getCardSizeCm(): vec2 {
    return new vec2(this.cardWidthCm, this.cardHeightCm)
  }

  /** True when a ray (world origin, unit direction) hits the Done button while it is showing. */
  doneRayHit(origin: vec3, dir: vec3): boolean {
    if (!this.isDoneShowing()) return false
    return this.rayHitsRect(this.doneButtonSo.getTransform(), origin, dir, this.doneButtonWidthCm, this.doneButtonHeightCm)
  }

  /** True when a ray hits the card panel while it is showing (the card blocks what is behind it). */
  panelRayHit(origin: vec3, dir: vec3): boolean {
    if (!this.showing) return false
    return this.rayHitsRect(this.panel.getTransform(), origin, dir, this.cardWidthCm, this.cardHeightCm)
  }

  private rayHitsRect(t: Transform, origin: vec3, dir: vec3, w: number, h: number): boolean {
    const inv = t.getInvertedWorldTransform()
    const o = inv.multiplyPoint(origin)
    const d = inv.multiplyDirection(dir)
    if (Math.abs(d.z) < 1e-6) return false
    const k = -o.z / d.z
    if (k <= 0) return false
    const p = o.add(d.uniformScale(k))
    return Math.abs(p.x) <= w / 2 && Math.abs(p.y) <= h / 2
  }

  private fireDone(): void {
    if (!this.isDoneShowing() || this.doneFired) return
    this.doneFired = true
    this.doneEvent.invoke()
  }

  private onUpdate(): void {
    if (!this.initialHideDone) {
      // Hide after the BackPlate has initialized on OnStart (disabling before start would skip its init).
      this.initialHideDone = true
      this.panel.enabled = false
      return
    }
    if (this.showing) this.place()
  }

  /** Put the card on the eye-to-item line, above the item in view, scaled for its distance. */
  private place(): void {
    const t = this.getTransform()
    const cam = WorldCameraFinderProvider.getInstance()
    const eye = cam.getWorldPosition()
    const corners = this.itemCornersLocal.map((p) => this.toWorldSpace(p))
    if (corners.length === 0) return
    // Aim at the top center of the item's bounds.
    let minP = corners[0]
    let maxP = corners[0]
    for (const p of corners) {
      minP = new vec3(Math.min(minP.x, p.x), Math.min(minP.y, p.y), Math.min(minP.z, p.z))
      maxP = new vec3(Math.max(maxP.x, p.x), Math.max(maxP.y, p.y), Math.max(maxP.z, p.z))
    }
    const top = new vec3((minP.x + maxP.x) / 2, maxP.y, (minP.z + maxP.z) / 2)
    const toTop = top.sub(eye)
    const itemDist = Math.max(1, toTop.length)
    const v = toTop.uniformScale(1 / itemDist)
    const up = this.perpendicularUp(v)
    // The highest the item reaches in the user's view, as an angle above the aim line.
    let maxElev = 0
    for (const p of corners) {
      const rel = p.sub(eye)
      maxElev = Math.max(maxElev, Math.atan2(rel.dot(up), Math.max(1, rel.dot(v))))
    }

    const c = Math.max(MIN_CARD_DISTANCE_CM, Math.min(this.cardDistanceCm, itemDist - ITEM_GAP_CM))
    const angle = (this.verdictAngleDeg * Math.PI) / 180
    const s = (2 * c * Math.tan(angle / 2)) / this.verdictLineHeightCm()
    const half = (this.cardHeightCm * s) / 2
    const bottom = c * Math.tan(maxElev + (this.gapAboveItemDeg * Math.PI) / 180)
    let center = eye.add(v.uniformScale(c)).add(up.uniformScale(bottom + half))
    center = this.keepInView(center, eye, half, (this.cardWidthCm * s) / 2)

    t.setWorldScale(vec3.one().uniformScale(s))
    t.setWorldPosition(center)
    const toEye = eye.sub(center)
    if (toEye.length > 0.001) t.setWorldRotation(quat.lookAt(toEye.normalize(), up))
  }

  /** Slide the card (in the view's plane) so its edges stay VIEW_MARGIN_DEG inside the camera view. */
  private keepInView(center: vec3, eye: vec3, halfH: number, halfW: number): vec3 {
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const camComp = WorldCameraFinderProvider.getInstance().getComponent()
    if (!camComp) return center
    const fwd = camT.forward.uniformScale(-1).normalize()
    const right = camT.right.normalize()
    const camUp = camT.up.normalize()
    const rel = center.sub(eye)
    const depth = rel.dot(fwd)
    if (depth <= 1) return center
    const halfV = camComp.fov / 2 - (VIEW_MARGIN_DEG * Math.PI) / 180
    const halfHz = Math.atan(Math.tan(camComp.fov / 2) * camComp.aspect) - (VIEW_MARGIN_DEG * Math.PI) / 180
    const maxY = depth * Math.tan(halfV) - halfH
    const maxX = depth * Math.tan(halfHz) - halfW
    const y = rel.dot(camUp)
    const x = rel.dot(right)
    const ny = maxY > 0 ? Math.max(-maxY, Math.min(maxY, y)) : 0
    const nx = maxX > 0 ? Math.max(-maxX, Math.min(maxX, x)) : 0
    return center.add(camUp.uniformScale(ny - y)).add(right.uniformScale(nx - x))
  }

  /** The yard's up direction, made perpendicular to v. */
  private perpendicularUp(v: vec3): vec3 {
    const parent = this.sceneObject.getParent()
    const worldUp = parent ? parent.getTransform().up.normalize() : vec3.up()
    const u = worldUp.sub(v.uniformScale(worldUp.dot(v)))
    return u.length > 0.001 ? u.normalize() : worldUp
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

  /** Set a wrapping row's text and size the row to the lines it needs, so the card stays compact. */
  private setRow(t: Text, text: string, role: TextRole): void {
    t.text = text
    t.sceneObject.enabled = text.length > 0
    const size = roleSize(role, this.readingDistanceCm)
    const inner = this.cardWidthCm - this.paddingCm * 2
    const perLine = Math.max(1, Math.floor(inner / (CHAR_WIDTH_PER_SIZE * size)))
    const lines = Math.max(1, Math.ceil(text.length / perLine))
    const h = lines * size * LINE_HEIGHT_PER_SIZE + ROW_PAD_CM
    const r = t.layoutRect
    t.layoutRect = Rect.create(r.left, r.right, -h / 2, h / 2)
    const item = t.sceneObject.getComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = h
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
    this.flex = flex

    const d = this.readingDistanceCm
    const verdictH = roleSize("HeadlineXL", d) * LINE_HEIGHT_PER_SIZE + ROW_PAD_CM
    const footerH = roleSize("Caption", d) * LINE_HEIGHT_PER_SIZE + ROW_PAD_CM
    this.verdictText = this.addRow(content, "VerdictText", "HeadlineXL", d, inner, verdictH, HorizontalOverflow.Shrink)
    this.reasonText = this.addRow(content, "ReasonText", "Body", d, inner, 3.4, HorizontalOverflow.Wrap)
    this.reasonText.textFill.color = this.reasonColor
    this.actionText = this.addRow(content, "ActionText", "Callout", d, inner, 3.4, HorizontalOverflow.Wrap)
    this.actionText.textFill.color = this.actionColor
    this.doneButtonSo = this.addDoneButton(content)
    this.footerText = this.addRow(content, "FooterText", "Caption", d, inner, footerH, HorizontalOverflow.Shrink)
    this.footerText.textFill.color = this.footerColor
    this.footerText.text = this.footerLine

    this.setFlexRows(true)
  }

  /** Register the rows in order. A hidden Done button is left out so it does not leave a gap. */
  private setFlexRows(withDone: boolean): void {
    const rows = [this.verdictText.sceneObject, this.reasonText.sceneObject, this.actionText.sceneObject]
    if (withDone) rows.push(this.doneButtonSo)
    rows.push(this.footerText.sceneObject)
    this.flex.clearItems()
    this.flex.addItems(rows.map((so) => so.getComponent(FlexItem.getTypeName()) as FlexItem))
  }

  /**
   * One centered UI Kit button with a solid light green fill and a dark label. It is its own flex
   * item: the layout sizes UI Kit Elements through their width and height, while a plain wrapper
   * object would be stretched by scale. Pressing it fires onDone once per shown card.
   */
  private addDoneButton(parent: SceneObject): SceneObject {
    const buttonSo = global.scene.createSceneObject("DoneButton")
    buttonSo.setParent(parent)
    const button = buttonSo.createComponent(Button.getTypeName()) as Button
    button.setTheme("SnapOS3", "Primary")
    button.size = new vec3(this.doneButtonWidthCm, this.doneButtonHeightCm, 1)
    button.initialize()
    this.paintButton(button)
    button.onTriggerUp.add(() => this.fireDone())

    const labelSo = global.scene.createSceneObject("DoneLabel")
    labelSo.setParent(buttonSo)
    labelSo.getTransform().setLocalPosition(new vec3(0, 0, 0.8))
    const label = labelSo.createComponent("Component.Text") as Text
    label.depthTest = true
    applyTextRole(label, "Callout", this.readingDistanceCm)
    label.horizontalAlignment = HorizontalAlignment.Center
    label.verticalAlignment = VerticalAlignment.Center
    label.horizontalOverflow = HorizontalOverflow.Shrink
    const w = this.doneButtonWidthCm - 1
    const h = this.doneButtonHeightCm - 0.6
    label.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
    label.text = this.doneLabel
    label.textFill.color = this.doneTextColor

    const item = buttonSo.createComponent(FlexItem.getTypeName()) as FlexItem
    item.alignSelf = FlexAlignSelf.Center
    this.doneButton = button
    return buttonSo
  }

  /** Light green in every state (a little lighter on hover, a little deeper while pressed). */
  private paintButton(button: Button): void {
    const visual = button.visual
    if (!(visual instanceof RoundedRectangleVisual)) {
      print("[FiveFeet] WARN: Done button visual is not a rounded rectangle, keeping the theme color")
      return
    }
    const c = this.doneColor
    const lighter = new vec4(Math.min(1, c.x + 0.12), Math.min(1, c.y + 0.05), Math.min(1, c.z + 0.12), c.w)
    const deeper = new vec4(c.x * 0.8, c.y * 0.88, c.z * 0.8, c.w)
    visual.defaultBaseType = "Gradient"
    visual.hoveredBaseType = "Gradient"
    visual.triggeredBaseType = "Gradient"
    visual.defaultGradient = solid(c)
    visual.hoveredGradient = solid(lighter)
    visual.triggeredGradient = solid(deeper)
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
