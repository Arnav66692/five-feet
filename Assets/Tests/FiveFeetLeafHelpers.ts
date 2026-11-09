/**
 * Shared helpers for the Five Feet LEAF scenarios. Test-only, read-only access to the Lens.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetVerdictCardUI} from "../Scripts/FiveFeetVerdictCardUI"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

export const RING_DRAW_WAIT_MS = 2500
export const SETTLE_AFTER_PINCH_MS = 400
export const FOOTER_EXPECTED_SUBSTRING = "State rule"

export type CardReading = {
  item: string
  verdictText: string
  reasonText: string
  footerText: string
  showing: boolean
}

function textOf(name: string): string {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`Scene object "${name}" not found`)
  const t = so.getComponent("Component.Text") as Text
  if (!t) throw new Error(`Scene object "${name}" has no Text component`)
  return t.text
}

export function getCard(): FiveFeetVerdictCardUI {
  const so = findSceneObjectByName("VerdictCard")
  if (!so) throw new Error(`Scene object "VerdictCard" not found`)
  const card = so.getComponent(FiveFeetVerdictCardUI.getTypeName()) as FiveFeetVerdictCardUI
  if (!card) throw new Error(`VerdictCard has no FiveFeetVerdictCardUI`)
  return card
}

/** Find the named SceneObject and return its script component of the given type, or throw. */
export function requireComponent<T>(objectName: string, typeName: unknown): T {
  const so = findSceneObjectByName(objectName)
  if (!so) throw new Error(`Scene object "${objectName}" not found`)
  const c = so.getComponent(typeName as keyof ComponentNameMap)
  if (!c) throw new Error(`"${objectName}" has no ${String(typeName)}`)
  return c as unknown as T
}

/**
 * Stand the user groundDistanceCm from an item, straight ahead. The preview camera is the user's
 * eyes and stays put, so this slides the whole FiveFeet rig along the ground instead (same relative
 * geometry as the user walking). Returns the ground distance measured afterwards.
 */
export function standAtDistanceFrom(itemName: string, groundDistanceCm: number): number {
  const rig = findSceneObjectByName("FiveFeet")
  const item = findSceneObjectByName(itemName)
  if (!rig || !item) throw new Error(`FiveFeet rig or "${itemName}" not found`)
  const cam = WorldCameraFinderProvider.getInstance()
  const eye = cam.getWorldPosition()
  const look = cam.getTransform().forward.uniformScale(-1)
  const ahead = new vec3(look.x, 0, look.z).normalize()
  const itemPos = item.getTransform().getWorldPosition()
  const target = new vec3(eye.x + ahead.x * groundDistanceCm, itemPos.y, eye.z + ahead.z * groundDistanceCm)
  const delta = target.sub(itemPos)
  const rigT = rig.getTransform()
  rigT.setWorldPosition(rigT.getWorldPosition().add(new vec3(delta.x, 0, delta.z)))
  const now = item.getTransform().getWorldPosition().sub(eye)
  return new vec3(now.x, 0, now.z).length
}

/**
 * Turn the user's gaze onto a world point without moving the preview camera: rotate the whole
 * FiveFeet rig around the eye so the point sits on the camera's view axis. Rotating the yard around
 * the eye is the same, for everything the user sees, as the user turning their head.
 */
export function lookAtFromEye(worldPoint: vec3): void {
  const rig = findSceneObjectByName("FiveFeet")
  if (!rig) throw new Error(`FiveFeet rig not found`)
  const cam = WorldCameraFinderProvider.getInstance()
  const eye = cam.getWorldPosition()
  const forward = cam.getTransform().forward.uniformScale(-1).normalize()
  const toPoint = worldPoint.sub(eye).normalize()
  const q = quat.rotationFromTo(toPoint, forward)
  const t = rig.getTransform()
  t.setWorldPosition(eye.add(q.multiplyVec3(t.getWorldPosition().sub(eye))))
  t.setWorldRotation(q.multiply(t.getWorldRotation()))
}

/** Undo any tilt: put the rig's rotation back to `rotation`, keeping it level around the eye. */
export function restoreRigRotation(rotation: quat): void {
  const rig = findSceneObjectByName("FiveFeet")
  if (!rig) throw new Error(`FiveFeet rig not found`)
  const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
  const t = rig.getTransform()
  const q = rotation.multiply(t.getWorldRotation().invert())
  t.setWorldPosition(eye.add(q.multiplyVec3(t.getWorldPosition().sub(eye))))
  t.setWorldRotation(rotation)
}

/** Poll every stepMs until done() is true or timeoutMs passes. Returns whether done() became true. */
export async function waitFor(done: () => boolean, timeoutMs: number, stepMs: number = 50): Promise<boolean> {
  let waited = 0
  while (!done() && waited < timeoutMs) {
    await sleep(stepMs)
    waited += stepMs
  }
  return done()
}

/** Press the card's UI Kit Done button through its SIK Interactable with the LEAF SIK interactor. */
export async function pressDone(interactor: DefaultLeafInteractor): Promise<void> {
  const interactable = findInteractableByName("DoneButton", undefined, true)
  if (!interactable) throw new Error(`Interactable "DoneButton" not found or not enabled`)
  await interactor.trigger(interactable)
  await sleep(SETTLE_AFTER_PINCH_MS)
}

/** Distance (cm) from the house wall face to the item's center, measured along the wall's +Z. */
export function wallDistanceCm(itemName: string): number {
  const wall = findSceneObjectByName("HouseWall")
  const item = findSceneObjectByName(itemName)
  if (!wall || !item) throw new Error(`HouseWall or "${itemName}" not found`)
  const wt = wall.getTransform()
  return item.getTransform().getWorldPosition().sub(wt.getWorldPosition()).dot(wt.forward.normalize())
}

/** Pinch an item through its SIK Interactable with the LEAF SIK interactor, then read the card. */
export async function pinchAndRead(interactor: DefaultLeafInteractor, itemName: string): Promise<CardReading> {
  const interactable = findInteractableByName(itemName, undefined, true)
  if (!interactable) throw new Error(`Interactable "${itemName}" not found or not enabled`)
  await interactor.trigger(interactable)
  await sleep(SETTLE_AFTER_PINCH_MS)
  const reading: CardReading = {
    item: itemName,
    verdictText: textOf("VerdictText"),
    reasonText: textOf("ReasonText"),
    footerText: textOf("FooterText"),
    showing: getCard().isShowing()
  }
  print(
    `[FiveFeetLEAF] ${itemName}: verdict="${reading.verdictText}" reason="${reading.reasonText}" ` +
      `footer="${reading.footerText}" showing=${reading.showing}`
  )
  return reading
}
