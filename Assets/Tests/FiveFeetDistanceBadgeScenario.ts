/**
 * Criterion 9: with the user 3 m from an item, the item shows its badge and no full card is
 * showing (a pinch from there does not open one either). With the user 1.5 m away, pinching it
 * shows the full card.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetItem} from "../Scripts/FiveFeetItem"
import {FiveFeetItemBadgeUI} from "../Scripts/FiveFeetItemBadgeUI"
import {getCard, pinchAndRead, requireComponent, standAtDistanceFrom} from "./FiveFeetLeafHelpers"

const ITEM = "Item_Firewood"
const BADGE = "Badge_Firewood"
const FAR_CM = 300
const NEAR_CM = 150
const SETTLE_MS = 300

@component
export class FiveFeetDistanceBadgeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const interactor = new DefaultLeafInteractor()
    const item = requireComponent<FiveFeetItem>(ITEM, FiveFeetItem.getTypeName())
    const badge = requireComponent<FiveFeetItemBadgeUI>(BADGE, FiveFeetItemBadgeUI.getTypeName())
    const card = getCard()

    const far = standAtDistanceFrom(ITEM, FAR_CM)
    await sleep(SETTLE_MS)
    const farBadge = badge.isVisible()
    const farCardBefore = card.isShowing()
    const farPinch = await pinchAndRead(interactor, ITEM)
    print(
      `[FiveFeetLEAF] c9 at ${(far / 100).toFixed(2)} m: isFar=${item.isFar()} badgeVisible=${farBadge} ` +
        `badge="${badge.getStatus()}" cardShowingBeforePinch=${farCardBefore} cardShowingAfterPinch=${farPinch.showing}`
    )
    expect(Math.abs(far - FAR_CM) < 1, `stood ${far.toFixed(1)} cm from ${ITEM}`).toBe(true)
    expect(farBadge, "badge visible at 3 m").toBe(true)
    expect(farCardBefore, "full card showing at 3 m").toBe(false)
    expect(farPinch.showing, "full card showing after a pinch at 3 m").toBe(false)

    const near = standAtDistanceFrom(ITEM, NEAR_CM)
    await sleep(SETTLE_MS)
    const nearBadge = badge.isVisible()
    const nearPinch = await pinchAndRead(interactor, ITEM)
    print(
      `[FiveFeetLEAF] c9 at ${(near / 100).toFixed(2)} m: isFar=${item.isFar()} badgeVisible=${nearBadge} ` +
        `cardShowingAfterPinch=${nearPinch.showing} verdict="${nearPinch.verdictText}"`
    )
    expect(Math.abs(near - NEAR_CM) < 1, `stood ${near.toFixed(1)} cm from ${ITEM}`).toBe(true)
    expect(nearPinch.showing, "full card showing after a pinch at 1.5 m").toBe(true)
    expect(nearPinch.verdictText, "verdict at 1.5 m").toBe("Move now")
  }
}
