/**
 * FiveFeetZoneRing — the Zone 0 boundary drawn on the ground (controller).
 *
 * Owns: placing and animating the authored line segments from the rule distance.
 *   Origin of THIS SceneObject = where the wall face meets the ground, +Z pointing
 *   away from the wall toward the user, X along the wall.
 *   Segments: RingSideLeft (wall -> out), RingOuterLine (full wall width), RingSideRight
 *   (out -> wall), RingFill (faint zone fill, fades in after the draw).
 *   The OUTER edge of RingOuterLine sits exactly outerEdgeDistanceCm from the wall face.
 * Expects @inputs: houseWall (origin on the wall face plane, +Z = wall normal) + the 4 segments.
 * Public API: startDraw(), isDrawComplete(), getDrawCompleteTime(), getMeasuredOuterEdgeDistanceCm(),
 *   getOuterLineSpanCm(), animateColors(line, fill, seconds), getLineColor(),
 *   outerEdgeDistanceCm (input), onDrawComplete.
 * Must NOT: handle items or the verdict card.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const MIN_LEN = 0.01

@component
export class FiveFeetZoneRing extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetZoneRing – Zone 0 line, 5 ft from the wall</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("House wall root. Its origin is on the wall face and its +Z points away from the wall")
  houseWall: SceneObject

  @input
  @hint("Line parallel to the wall at the rule distance")
  outerLine: SceneObject

  @input
  @hint("Left leg from the wall out to the outer line")
  sideLeft: SceneObject

  @input
  @hint("Right leg from the outer line back to the wall")
  sideRight: SceneObject

  @input
  @hint("Faint fill marking the zone")
  fill: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Distance (cm) from the wall face to the OUTER edge of the line. Zone 0 is 5 ft = 152 cm")
  @widget(new SliderWidget(50, 300, 1))
  outerEdgeDistanceCm: number = 152

  @input
  @hint("Width of the line (cm)")
  @widget(new SliderWidget(1, 20, 0.5))
  lineWidthCm: number = 5

  @input
  @hint("Length of the zone along the wall (cm). Matches the wall width")
  @widget(new SliderWidget(50, 1000, 10))
  runWidthCm: number = 400

  @input
  @hint("Line thickness above the ground (cm)")
  @widget(new SliderWidget(0.1, 3, 0.1))
  lineThicknessCm: number = 0.6

  @input
  @hint("Draw the legs from the wall out to the line so the zone reads as a boundary")
  showSideLegs: boolean = true

  @input
  @hint("Seconds the line takes to draw itself end to end (brief default 2 s)")
  @widget(new SliderWidget(0.2, 10, 0.1))
  drawDurationSec: number = 2

  @input
  @hint("Seconds for the faint fill to fade in after the line is drawn")
  @widget(new SliderWidget(0, 5, 0.1))
  fillFadeSec: number = 0.8

  @input("vec4", "{1,0.68,0.32,1}")
  @hint("Line color (light orange)")
  @widget(new ColorWidget())
  lineColor: vec4 = new vec4(1, 0.68, 0.32, 1)

  @input("vec4", "{1,0.6,0.25,0.14}")
  @hint("Zone fill color. Alpha controls how faint it is")
  @widget(new ColorWidget())
  fillColor: vec4 = new vec4(1, 0.6, 0.25, 0.14)
  @ui.group_end

  private readonly drawCompleteEvent = new Event<number>()
  readonly onDrawComplete: PublicApi<number> = this.drawCompleteEvent.publicApi()

  private elapsed = 0
  private drawing = false
  private complete = false
  private fillMaterial: Material | null = null
  private drawCompleteTime = -1
  private lineMaterial: Material | null = null
  private colorFromLine = vec4.one()
  private colorToLine = vec4.one()
  private colorFromFill = vec4.one()
  private colorToFill = vec4.one()
  private colorElapsed = 0
  private colorDuration = 0
  private colorAnimating = false

  onAwake(): void {
    if (!this.houseWall || !this.outerLine || !this.sideLeft || !this.sideRight || !this.fill) {
      print("[FiveFeetZoneRing] ERROR: segment or wall references not wired")
      return
    }
    this.applyColors()
    this.applyProgress(0)
    this.setFillAlpha(0)
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Begin the end-to-end draw-on animation. */
  startDraw(): void {
    this.elapsed = 0
    this.drawing = true
    this.complete = false
    this.applyProgress(0)
    this.setFillAlpha(0)
  }

  isDrawComplete(): boolean {
    return this.complete
  }

  /**
   * Blend the line and the zone fill to new colors over `seconds` (for example orange to green
   * once the zone is clear).
   */
  animateColors(line: vec4, fill: vec4, seconds: number): void {
    this.colorFromLine = this.getLineColor()
    this.colorToLine = line
    this.colorFromFill = this.fillColor
    this.colorToFill = fill
    this.colorElapsed = 0
    this.colorDuration = Math.max(0.01, seconds)
    this.colorAnimating = true
  }

  /** Current line color, read from the line material. */
  getLineColor(): vec4 {
    return this.lineMaterial ? this.lineMaterial.mainPass.baseColor : this.lineColor
  }

  /** Lens time (getTime()) when the draw finished, or -1 before that. */
  getDrawCompleteTime(): number {
    return this.drawCompleteTime
  }

  /** Current drawn length of the outer line along the wall (cm). */
  getOuterLineSpanCm(): number {
    if (!this.outerLine.enabled) return 0
    return this.outerLine.getTransform().getWorldScale().x
  }

  /**
   * Measured distance from the wall face plane to the outer edge of the outer line, in world cm.
   * Computed from live world transforms, not from the input value.
   */
  getMeasuredOuterEdgeDistanceCm(): number {
    const wallT = this.houseWall.getTransform()
    const normal = wallT.forward.normalize()
    const lineT = this.outerLine.getTransform()
    const toLine = lineT.getWorldPosition().sub(wallT.getWorldPosition())
    const halfWidth = lineT.getWorldScale().z / 2
    return toLine.dot(normal) + halfWidth
  }

  private onUpdate(): void {
    if (this.colorAnimating) this.stepColors()
    if (!this.drawing) return
    this.elapsed += getDeltaTime()
    const p = Math.min(1, this.elapsed / Math.max(0.01, this.drawDurationSec))
    this.applyProgress(this.easeInOut(p))
    if (p >= 1 && !this.complete) {
      this.complete = true
      this.drawCompleteTime = getTime()
      const measured = this.getMeasuredOuterEdgeDistanceCm()
      print(
        "[FiveFeet] Zone0Ring drawn at t=" +
          this.drawCompleteTime.toFixed(2) +
          "s: outer edge " +
          measured.toFixed(1) +
          " cm from wall face, span " +
          this.getOuterLineSpanCm().toFixed(1) +
          " cm"
      )
      this.drawCompleteEvent.invoke(measured)
    }
    if (this.complete) {
      const fadeT = this.elapsed - this.drawDurationSec
      const a = this.fillFadeSec <= 0 ? 1 : Math.min(1, fadeT / this.fillFadeSec)
      this.setFillAlpha(a)
      if (a >= 1) this.drawing = false
    }
  }

  private stepColors(): void {
    this.colorElapsed += getDeltaTime()
    const p = Math.min(1, this.colorElapsed / this.colorDuration)
    if (this.lineMaterial) this.lineMaterial.mainPass.baseColor = vec4.lerp(this.colorFromLine, this.colorToLine, p)
    this.fillColor = vec4.lerp(this.colorFromFill, this.colorToFill, p)
    if (this.fill.enabled) this.setFillAlpha(1)
    if (p >= 1) this.colorAnimating = false
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  /** Lay out all segments for a normalized progress 0..1 along the path. */
  private applyProgress(p: number): void {
    const D = this.outerEdgeDistanceCm
    const W = this.runWidthCm
    const w = this.lineWidthCm
    const h = this.lineThicknessCm
    const y = h / 2 + 0.2
    const legs = this.showSideLegs
    const total = legs ? D + W + D : W
    let s = p * total

    // Left leg: from the wall (z=0) outward to z=D at x = -W/2 + w/2
    let a = 0
    if (legs) {
      a = Math.min(Math.max(s, 0), D)
      s -= D
    }
    this.place(this.sideLeft, a, new vec3(-W / 2 + w / 2, y, a / 2), new vec3(w, h, a))

    // Outer line: from x = -W/2 to +W/2, outer edge at z = D
    const b = Math.min(Math.max(s, 0), W)
    s -= W
    this.place(this.outerLine, b, new vec3(-W / 2 + b / 2, y, D - w / 2), new vec3(b, h, w))

    // Right leg: from z=D back to the wall at x = W/2 - w/2
    const c = legs ? Math.min(Math.max(s, 0), D) : 0
    this.place(this.sideRight, c, new vec3(W / 2 - w / 2, y, D - c / 2), new vec3(w, h, c))

    // Fill covers the zone inside the line
    const fillT = this.fill.getTransform()
    fillT.setLocalPosition(new vec3(0, 0.1, (D - w) / 2))
    fillT.setLocalScale(new vec3(W - (legs ? 2 * w : 0), 0.1, D - w))
  }

  private place(so: SceneObject, len: number, pos: vec3, scale: vec3): void {
    so.enabled = len > MIN_LEN
    const t = so.getTransform()
    t.setLocalPosition(pos)
    t.setLocalScale(scale)
  }

  private applyColors(): void {
    // One clone shared by the three line segments, so a color change recolors the whole line
    // without touching the material asset.
    for (const so of [this.outerLine, this.sideLeft, this.sideRight]) {
      const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      if (!rmv || !rmv.mainMaterial) continue
      if (!this.lineMaterial) this.lineMaterial = rmv.mainMaterial.clone()
      rmv.mainMaterial = this.lineMaterial
      this.lineMaterial.mainPass.baseColor = this.lineColor
    }
    const fillRmv = this.fill.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    if (fillRmv && fillRmv.mainMaterial) {
      this.fillMaterial = fillRmv.mainMaterial.clone()
      fillRmv.mainMaterial = this.fillMaterial
    }
  }

  private setFillAlpha(a: number): void {
    if (!this.fillMaterial) return
    const c = this.fillColor
    this.fillMaterial.mainPass.baseColor = new vec4(c.x, c.y, c.z, c.w * a)
    this.fill.enabled = a > 0
  }
}
