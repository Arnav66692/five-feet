/**
 * Criterion 1: the Zone 0 line's outer edge is 152 +/- 5 cm from the wall face along its
 * full length, and it spans the wall's 400 cm width aligned with the wall ends.
 * Measured from world transforms and mesh bounds, independent of the ring script's own math.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetZoneRing} from "../Scripts/FiveFeetZoneRing"
import {RING_DRAW_WAIT_MS} from "./FiveFeetLeafHelpers"

const TARGET_CM = 152
const WALL_WIDTH_CM = 400
const TOL_CM = 5
const DRAW_TIMEOUT_MS = 8000

function requireObj(name: string): SceneObject {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`Scene object "${name}" not found`)
  return so
}

function meshBounds(so: SceneObject): {min: vec3; max: vec3} {
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (!rmv || !rmv.mesh) throw new Error(`"${so.name}" has no RenderMeshVisual mesh`)
  return {min: rmv.mesh.aabbMin, max: rmv.mesh.aabbMax}
}

function toWorld(so: SceneObject, local: vec3): vec3 {
  return so.getTransform().getWorldTransform().multiplyPoint(local)
}

@component
export class FiveFeetRingDistanceScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(RING_DRAW_WAIT_MS)
    const ringSo = requireObj("Zone0Ring")
    const ring = ringSo.getComponent(FiveFeetZoneRing.getTypeName()) as FiveFeetZoneRing
    let waited = 0
    while (ring && !ring.isDrawComplete() && waited < DRAW_TIMEOUT_MS) {
      await sleep(100)
      waited += 100
    }
    expect(ring.isDrawComplete(), "ring draw did not complete").toBe(true)

    const wall = requireObj("HouseWall")
    const line = requireObj("RingOuterLine")
    const panel = requireObj("WallPanel")
    const wallT = wall.getTransform()
    const wallPos = wallT.getWorldPosition()
    const n = wallT.forward.normalize()
    const r = wallT.right.normalize()

    // Method A (brief formula): world position delta dotted with wall forward + half world depth.
    const lineT = line.getTransform()
    const lineCenter = lineT.getWorldPosition()
    const halfDepth = lineT.getWorldScale().z / 2
    const halfWidth = lineT.getWorldScale().x / 2
    const lineRight = lineT.right.normalize()
    const distA = (p: vec3) => p.sub(wallPos).dot(n) + halfDepth
    const aLeft = distA(lineCenter.sub(lineRight.uniformScale(halfWidth)))
    const aCenter = distA(lineCenter)
    const aRight = distA(lineCenter.add(lineRight.uniformScale(halfWidth)))
    const aSpan = halfWidth * 2

    // Method B (mesh bounds): transform the line mesh's local AABB corners to world, take the
    // edge farthest from the wall face. Does not assume the mesh is a unit box.
    const b = meshBounds(line)
    const midY = (b.min.y + b.max.y) / 2
    const midX = (b.min.x + b.max.x) / 2
    const outerAt = (x: number) =>
      Math.max(
        toWorld(line, new vec3(x, midY, b.min.z)).sub(wallPos).dot(n),
        toWorld(line, new vec3(x, midY, b.max.z)).sub(wallPos).dot(n)
      )
    const bLeft = outerAt(b.min.x)
    const bCenter = outerAt(midX)
    const bRight = outerAt(b.max.x)
    const lineEndL = toWorld(line, new vec3(b.min.x, midY, 0)).sub(wallPos).dot(r)
    const lineEndR = toWorld(line, new vec3(b.max.x, midY, 0)).sub(wallPos).dot(r)
    const bSpan = Math.abs(lineEndR - lineEndL)

    // Wall ends from the wall panel mesh bounds, along the wall's right axis.
    const w = meshBounds(panel)
    const wy = (w.min.y + w.max.y) / 2
    const wz = (w.min.z + w.max.z) / 2
    const wallEndA = toWorld(panel, new vec3(w.min.x, wy, wz)).sub(wallPos).dot(r)
    const wallEndB = toWorld(panel, new vec3(w.max.x, wy, wz)).sub(wallPos).dot(r)
    const wallL = Math.min(wallEndA, wallEndB)
    const wallR = Math.max(wallEndA, wallEndB)
    const lineL = Math.min(lineEndL, lineEndR)
    const lineR = Math.max(lineEndL, lineEndR)
    const wallWidth = wallR - wallL

    const scriptDist = ring.getMeasuredOuterEdgeDistanceCm()
    const scriptSpan = ring.getOuterLineSpanCm()
    const f = (v: number) => v.toFixed(2)
    print(
      `[FiveFeetLEAF] ring A(transform): left=${f(aLeft)} center=${f(aCenter)} right=${f(aRight)} span=${f(aSpan)}`
    )
    print(
      `[FiveFeetLEAF] ring B(mesh bounds): left=${f(bLeft)} center=${f(bCenter)} right=${f(bRight)} span=${f(bSpan)}`
    )
    print(
      `[FiveFeetLEAF] wall: width=${f(wallWidth)} ends=[${f(wallL)}, ${f(wallR)}] line ends=[${f(lineL)}, ${f(lineR)}]`
    )
    print(`[FiveFeetLEAF] ring script: getMeasuredOuterEdgeDistanceCm=${f(scriptDist)} getOuterLineSpanCm=${f(scriptSpan)}`)

    const within = (label: string, v: number, target: number) =>
      expect(Math.abs(v - target) <= TOL_CM, `${label}=${f(v)} not within ${target}+/-${TOL_CM}`).toBe(true)
    within("A.left", aLeft, TARGET_CM)
    within("A.center", aCenter, TARGET_CM)
    within("A.right", aRight, TARGET_CM)
    within("B.left", bLeft, TARGET_CM)
    within("B.center", bCenter, TARGET_CM)
    within("B.right", bRight, TARGET_CM)
    within("A.span", aSpan, WALL_WIDTH_CM)
    within("B.span", bSpan, WALL_WIDTH_CM)
    within("wall.width", wallWidth, WALL_WIDTH_CM)
    within("line.leftEnd-vs-wall", lineL - wallL, 0)
    within("line.rightEnd-vs-wall", lineR - wallR, 0)
  }
}
