/**
 * FiveFeetEmberOpener — the opener: embers drift down from above the roof onto the yard (controller).
 *
 * Owns: spawning about 20 ember meshes over the spawn window, flying each one down to a planned
 *   landing point, and deciding what it hit from the items' hit boxes. A combustible item glows,
 *   anything else (ground, the plant) lets the ember fade out.
 *   Origin of THIS SceneObject = where the wall face meets the ground (same frame as Zone0Ring),
 *   +Z away from the wall toward the user, X along the wall.
 * Expects @inputs: emberMesh, emberMaterial. Items are passed to play() by FiveFeetMain.
 * Public API: play(items), isComplete(), getSpawnedCount(), getLandedCount(), getSpawnTimes(), getHitCounts(),
 *   getCompleteTime(), onComplete.
 * Must NOT: start the Zone 0 line or touch the card. FiveFeetMain sequences the opener and the line.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FiveFeetItem} from "./FiveFeetItem"

const ROOF_TOP_CM = 290 // spawn height above the ground, just over the roof eave
const SPAWN_Z_MIN_CM = 15 // spawn over the eave and gutter
const SPAWN_Z_MAX_CM = 70
const GROUND_LAND_Y_CM = 0.6
const GROUND_X_HALF_CM = 185
const GROUND_Z_MIN_CM = 15
const GROUND_Z_MAX_CM = 280
const HIT_PAD_CM = 2
const FADE_SEC = 0.5

type Ember = {
  so: SceneObject
  from: vec3
  to: vec3
  spawnAt: number
  state: "waiting" | "falling" | "fading" | "done"
  t: number
  wobblePhase: number
}

@component
export class FiveFeetEmberOpener extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FiveFeetEmberOpener – embers fall, combustibles glow</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Mesh for one ember (a small sphere)")
  emberMesh: RenderMesh

  @input
  @hint("Bright orange unlit material for the embers (keep light: the display is additive)")
  emberMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("How many embers fall (brief: about 20)")
  @widget(new SliderWidget(5, 40, 1))
  emberCount: number = 20

  @input
  @hint("Embers that aim at each combustible item. The rest land on the ground or the plant")
  @widget(new SliderWidget(0, 6, 1))
  embersPerCombustible: number = 3

  @input
  @hint("Embers that aim at each item that is not combustible (shows that it does not catch)")
  @widget(new SliderWidget(0, 3, 1))
  embersPerSafeItem: number = 1

  @input
  @hint("Seconds before the first ember appears")
  @widget(new SliderWidget(0, 2, 0.05))
  startDelaySec: number = 0.2

  @input
  @hint("Seconds over which the embers are released")
  @widget(new SliderWidget(0.5, 4, 0.1))
  spawnWindowSec: number = 2.0

  @input
  @hint("Seconds one ember takes to fall from above the roof to the ground")
  @widget(new SliderWidget(0.3, 3, 0.1))
  fallSec: number = 1.0

  @input
  @hint("Ember diameter (cm)")
  @widget(new SliderWidget(1, 8, 0.5))
  emberSizeCm: number = 5

  @input
  @hint("Seconds a combustible item glows after an ember lands on it (brief: about 1.5 s)")
  @widget(new SliderWidget(0.5, 4, 0.1))
  glowSec: number = 1.5

  @input
  @hint("Seed for the landing pattern, so every run looks the same")
  seed: number = 7
  @ui.group_end

  private readonly completeEvent = new Event<void>()
  readonly onComplete: PublicApi<void> = this.completeEvent.publicApi()

  private embers: Ember[] = []
  private items: FiveFeetItem[] = []
  private playing = false
  private complete = false
  private elapsed = 0
  private spawned = 0
  private landed = 0
  private spawnTimes: number[] = []
  private completeTime = -1
  private hitLog: Record<string, number> = {}
  private rngState = 1

  onAwake(): void {
    if (!this.emberMesh || !this.emberMaterial) {
      print("[FiveFeet] ERROR: FiveFeetEmberOpener emberMesh or emberMaterial not wired")
      return
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Plan the landing points against the given items and start releasing embers. */
  play(items: FiveFeetItem[]): void {
    this.items = items.slice()
    this.rngState = Math.max(1, Math.floor(this.seed))
    this.elapsed = 0
    this.spawned = 0
    this.landed = 0
    this.spawnTimes = []
    this.hitLog = {}
    this.complete = false
    this.completeTime = -1
    this.embers = this.planEmbers()
    this.playing = true
  }

  isComplete(): boolean {
    return this.complete
  }

  getSpawnedCount(): number {
    return this.spawned
  }

  getLandedCount(): number {
    return this.landed
  }

  /** Lens time (getTime(), seconds since Lens start) at which each ember appeared. */
  getSpawnTimes(): number[] {
    return this.spawnTimes.slice()
  }

  /** How many embers landed on each item (by SceneObject name) and on the "Ground". */
  getHitCounts(): Record<string, number> {
    return {...this.hitLog}
  }

  /** Lens time when the last ember landed, or -1 before that. */
  getCompleteTime(): number {
    return this.completeTime
  }

  private planEmbers(): Ember[] {
    const targets: vec3[] = []
    for (const item of this.items) {
      const n = item.combustible ? this.embersPerCombustible : this.embersPerSafeItem
      for (let i = 0; i < n && targets.length < this.emberCount; i++) targets.push(this.pointOnItem(item))
    }
    while (targets.length < this.emberCount) targets.push(this.pointOnGround())
    this.shuffle(targets)

    const count = targets.length
    const step = count > 1 ? this.spawnWindowSec / (count - 1) : 0
    return targets.map((to, i) => {
      const from = new vec3(
        to.x + this.rand(-40, 40),
        ROOF_TOP_CM + this.rand(0, 40),
        this.rand(SPAWN_Z_MIN_CM, SPAWN_Z_MAX_CM)
      )
      return {
        so: this.makeEmber(i),
        from,
        to,
        spawnAt: this.startDelaySec + i * step,
        state: "waiting",
        t: 0,
        wobblePhase: this.rand(0, Math.PI * 2)
      } as Ember
    })
  }

  /** A random point on top of the item, inside its footprint, in this object's local space. */
  private pointOnItem(item: FiveFeetItem): vec3 {
    const size = item.hitBoxSizeCm
    const local = new vec3(this.rand(-0.3, 0.3) * size.x, 0, this.rand(-0.3, 0.3) * size.z)
    const itemT = item.getTransform()
    const top = itemT.getWorldTransform().multiplyPoint(local).add(vec3.up().uniformScale(item.topOffsetCm))
    return this.getTransform().getInvertedWorldTransform().multiplyPoint(top)
  }

  private pointOnGround(): vec3 {
    return new vec3(
      this.rand(-GROUND_X_HALF_CM, GROUND_X_HALF_CM),
      GROUND_LAND_Y_CM,
      this.rand(GROUND_Z_MIN_CM, GROUND_Z_MAX_CM)
    )
  }

  private makeEmber(i: number): SceneObject {
    const so = global.scene.createSceneObject("Ember_" + (i < 9 ? "0" : "") + (i + 1))
    so.setParent(this.sceneObject)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.emberMesh
    rmv.mainMaterial = this.emberMaterial
    so.enabled = false
    return so
  }

  private onUpdate(): void {
    if (!this.playing) return
    const dt = getDeltaTime()
    this.elapsed += dt
    let active = 0
    for (const e of this.embers) {
      if (e.state === "done") continue
      active++
      if (e.state === "waiting") {
        if (this.elapsed < e.spawnAt) continue
        e.state = "falling"
        e.so.enabled = true
        this.spawned++
        this.spawnTimes.push(getTime())
      }
      if (e.state === "falling") this.stepFall(e, dt)
      else if (e.state === "fading") this.stepFade(e, dt)
    }
    // The opener is done once every ember has landed. The last fades overlap the line draw.
    if (!this.complete && this.landed >= this.embers.length) this.finish()
    if (active === 0) this.playing = false
  }

  private stepFall(e: Ember, dt: number): void {
    e.t = Math.min(1, e.t + dt / Math.max(0.05, this.fallSec))
    const k = e.t * e.t * (3 - 2 * e.t) // smooth start and landing
    const wobble = Math.sin(e.wobblePhase + e.t * 9) * 6 * (1 - e.t)
    const p = vec3.lerp(e.from, e.to, k).add(new vec3(wobble, 0, wobble * 0.5))
    const t = e.so.getTransform()
    t.setLocalPosition(p)
    const flicker = 1 + 0.25 * Math.sin((this.elapsed + e.wobblePhase) * 30)
    t.setLocalScale(vec3.one().uniformScale(this.emberSizeCm * flicker))
    if (e.t >= 1) this.land(e)
  }

  private land(e: Ember): void {
    this.landed++
    const world = this.getTransform().getWorldTransform().multiplyPoint(e.to)
    const hit = this.items.find((it) => it.containsWorldPoint(world, HIT_PAD_CM))
    const name = hit ? hit.sceneObject.name : "Ground"
    this.hitLog[name] = (this.hitLog[name] || 0) + 1
    if (hit && hit.ignite(this.glowSec)) {
      e.so.enabled = false // the ember sinks into the item, which now glows
      e.state = "done"
      return
    }
    e.state = "fading"
    e.t = 0
  }

  private stepFade(e: Ember, dt: number): void {
    e.t = Math.min(1, e.t + dt / FADE_SEC)
    e.so.getTransform().setLocalScale(vec3.one().uniformScale(this.emberSizeCm * (1 - e.t)))
    if (e.t >= 1) {
      e.so.enabled = false
      e.state = "done"
    }
  }

  private finish(): void {
    this.complete = true
    this.completeTime = getTime()
    const hits = Object.keys(this.hitLog)
      .map((k) => k + " x" + this.hitLog[k])
      .join(", ")
    print(
      "[FiveFeet] Embers landed at t=" +
        this.completeTime.toFixed(2) +
        "s: spawned " +
        this.spawned +
        ", landed " +
        this.landed +
        " (" +
        hits +
        ")"
    )
    this.completeEvent.invoke()
  }

  /** Small deterministic random (Park-Miller) so the opener looks the same every run. */
  private rand(min: number, max: number): number {
    this.rngState = (this.rngState * 48271) % 2147483647
    return min + (this.rngState / 2147483647) * (max - min)
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand(0, i + 1))
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
  }
}
