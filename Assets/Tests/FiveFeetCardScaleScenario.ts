/**
 * Criterion 10 (changed Nov 9): at 1.5 m and at 3 m from the item, the whole card is inside the
 * camera view and the verdict text's angular height is the same within 10%.
 * At each distance the user looks at the item (the rig is turned around the eye so the item's top
 * is on the view axis, the same as the user looking down at it). The card is opened at 1.5 m and
 * stays open while the user steps back to 3 m. Also checks the card sits above the item in view.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {FiveFeetItem} from "../Scripts/FiveFeetItem"
import {
  getCard,
  lookAtFromEye,
  pinchAndRead,
  requireComponent,
  restoreRigRotation,
  standAtDistanceFrom
} from "./FiveFeetLeafHelpers"

const ITEM = "Item_Firewood"
const NEAR_CM = 150
const FAR_CM = 300
const MAX_ANGLE_DIFF = 0.1
const SETTLE_MS = 400

type ViewCheck = {inView: boolean; aboveItem: boolean; worstEdgeDeg: number; verdictDeg: number; gapDeg: number}

/** Angles (radians) of a world point from the camera's view axis: x right, y up. */
function viewAngles(p: vec3): vec2 {
  const camT = WorldCameraFinderProvider.getInstance().getTransform()
  const rel = p.sub(camT.getWorldPosition())
  const fwd = camT.forward.uniformScale(-1).normalize()
  const depth = rel.dot(fwd)
  return new vec2(Math.atan2(rel.dot(camT.right.normalize()), depth), Math.atan2(rel.dot(camT.up.normalize()), depth))
}

function checkCard(item: FiveFeetItem): ViewCheck {
  const card = getCard()
  const cam = WorldCameraFinderProvider.getInstance().getComponent()
  const halfV = cam.fov / 2
  const halfH = Math.atan(Math.tan(cam.fov / 2) * cam.aspect)
  const size = card.getCardSizeCm()
  const panel = findSceneObjectByName("CardPanel")
  if (!panel) throw new Error(`"CardPanel" not found`)
  const m = panel.getTransform().getWorldTransform()
  const corners = [
    new vec3(-size.x / 2, -size.y / 2, 0),
    new vec3(size.x / 2, -size.y / 2, 0),
    new vec3(-size.x / 2, size.y / 2, 0),
    new vec3(size.x / 2, size.y / 2, 0)
  ].map((c) => viewAngles(m.multiplyPoint(c)))
  let worst = -10
  for (const a of corners) worst = Math.max(worst, Math.abs(a.x) - halfH, Math.abs(a.y) - halfV)
  const cardBottom = Math.min(...corners.map((a) => a.y))

  const b = item.getVisualWorldBounds()
  let itemTop = -10
  for (const x of [b.min.x, b.max.x])
    for (const y of [b.min.y, b.max.y])
      for (const z of [b.min.z, b.max.z]) itemTop = Math.max(itemTop, viewAngles(new vec3(x, y, z)).y)
  const deg = (r: number) => (r * 180) / Math.PI
  return {
    inView: worst <= 0,
    aboveItem: cardBottom > itemTop,
    worstEdgeDeg: deg(worst),
    verdictDeg: card.getVerdictAngleDeg(),
    gapDeg: deg(cardBottom - itemTop)
  }
}

function itemTopCenter(item: FiveFeetItem): vec3 {
  const b = item.getVisualWorldBounds()
  return new vec3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2)
}

@component
export class FiveFeetCardScaleScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const interactor = new DefaultLeafInteractor()
    const item = requireComponent<FiveFeetItem>(ITEM, FiveFeetItem.getTypeName())
    const rig = findSceneObjectByName("FiveFeet")
    if (!rig) throw new Error(`FiveFeet rig not found`)
    const level = rig.getTransform().getWorldRotation()

    const near = standAtDistanceFrom(ITEM, NEAR_CM)
    lookAtFromEye(itemTopCenter(item))
    await sleep(SETTLE_MS)
    const opened = await pinchAndRead(interactor, ITEM)
    await sleep(SETTLE_MS)
    const a = checkCard(item)

    restoreRigRotation(level)
    const far = standAtDistanceFrom(ITEM, FAR_CM)
    lookAtFromEye(itemTopCenter(item))
    await sleep(SETTLE_MS)
    const showingFar = getCard().isShowing()
    const b = checkCard(item)

    const diff = Math.abs(b.verdictDeg - a.verdictDeg) / a.verdictDeg
    const f = (v: number) => v.toFixed(3)
    print(
      `[FiveFeetLEAF] c10 card in view: at ${(near / 100).toFixed(2)} m inView=${a.inView} worstEdge=${f(a.worstEdgeDeg)}deg ` +
        `aboveItem=${a.aboveItem} gap=${f(a.gapDeg)}deg verdict=${f(a.verdictDeg)}deg | at ${(far / 100).toFixed(2)} m ` +
        `showing=${showingFar} inView=${b.inView} worstEdge=${f(b.worstEdgeDeg)}deg aboveItem=${b.aboveItem} ` +
        `gap=${f(b.gapDeg)}deg verdict=${f(b.verdictDeg)}deg | angleDiff=${(diff * 100).toFixed(1)}%`
    )
    expect(opened.showing, "card opened at 1.5 m").toBe(true)
    expect(a.inView, `whole card in view at 1.5 m (worst edge ${f(a.worstEdgeDeg)} deg)`).toBe(true)
    expect(a.aboveItem, "card above the item in view at 1.5 m").toBe(true)
    expect(showingFar, "card still showing at 3 m").toBe(true)
    expect(b.inView, `whole card in view at 3 m (worst edge ${f(b.worstEdgeDeg)} deg)`).toBe(true)
    expect(b.aboveItem, "card above the item in view at 3 m").toBe(true)
    expect(diff <= MAX_ANGLE_DIFF, `verdict angular height differs by ${(diff * 100).toFixed(1)}%`).toBe(true)
  }
}
