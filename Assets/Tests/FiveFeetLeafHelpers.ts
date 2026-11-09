/**
 * Shared helpers for the Five Feet LEAF scenarios. Test-only, read-only access to the Lens.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetVerdictCardUI} from "../Scripts/FiveFeetVerdictCardUI"

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
