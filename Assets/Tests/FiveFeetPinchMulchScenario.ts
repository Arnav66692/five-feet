/**
 * Criterion: pinching Item_Mulch through its SIK Interactable shows the verdict "Phase-in" on a visible card.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FOOTER_EXPECTED_SUBSTRING, pinchAndRead, RING_DRAW_WAIT_MS} from "./FiveFeetLeafHelpers"

@component
export class FiveFeetPinchMulchScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(RING_DRAW_WAIT_MS)
    const interactor = new DefaultLeafInteractor()
    const card = await pinchAndRead(interactor, "Item_Mulch")
    expect(card.verdictText, "verdict for Item_Mulch").toBe("Phase-in")
    expect(card.showing, "card showing after pinching Item_Mulch").toBe(true)
    expect(card.footerText.includes(FOOTER_EXPECTED_SUBSTRING), "footer for Item_Mulch: " + card.footerText).toBe(true)
  }
}
