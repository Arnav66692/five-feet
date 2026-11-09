/**
 * Criterion 12: pinching Done on the firewood card moves the firewood so its center is more than
 * 1.8 m from the wall, and its green check badge shows.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetItem} from "../Scripts/FiveFeetItem"
import {
  getCard,
  pinchAndRead,
  pressDone,
  requireComponent,
  RING_DRAW_WAIT_MS,
  waitFor,
  wallDistanceCm
} from "./FiveFeetLeafHelpers"

const ITEM = "Item_Firewood"
const CHECK = "Check_Firewood"
const MIN_WALL_DISTANCE_CM = 180
const FIX_WAIT_MS = 3000

@component
export class FiveFeetDoneFirewoodScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(RING_DRAW_WAIT_MS)
    const interactor = new DefaultLeafInteractor()
    const item = requireComponent<FiveFeetItem>(ITEM, FiveFeetItem.getTypeName())
    const check = findSceneObjectByName(CHECK)
    if (!check) throw new Error(`"${CHECK}" not found`)

    const before = wallDistanceCm(ITEM)
    const checkBefore = check.isEnabledInHierarchy
    const card = await pinchAndRead(interactor, ITEM)
    expect(getCard().isDoneShowing(), "Done button showing on the firewood card").toBe(true)
    await pressDone(interactor)
    await waitFor(() => item.isFixed(), FIX_WAIT_MS)

    const after = wallDistanceCm(ITEM)
    const checkAfter = check.isEnabledInHierarchy
    print(
      `[FiveFeetLEAF] c12 firewood: verdict="${card.verdictText}" wallDistance before=${before.toFixed(1)} cm ` +
        `after=${after.toFixed(1)} cm fixed=${item.isFixed()} checkBefore=${checkBefore} checkAfter=${checkAfter} ` +
        `cardShowingAfterDone=${getCard().isShowing()}`
    )
    expect(checkBefore, "check badge hidden before Done").toBe(false)
    expect(after > MIN_WALL_DISTANCE_CM, `firewood center ${after.toFixed(1)} cm from the wall`).toBe(true)
    expect(checkAfter, "check badge showing after Done").toBe(true)
  }
}
