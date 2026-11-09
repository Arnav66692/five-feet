/**
 * Criterion 6: every card (all 4 items pinched in turn) carries the "State rule" footer.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CardReading, FOOTER_EXPECTED_SUBSTRING, pinchAndRead, RING_DRAW_WAIT_MS} from "./FiveFeetLeafHelpers"

const ITEMS = ["Item_Firewood", "Item_Mulch", "Item_Fence", "Item_Plant"]

@component
export class FiveFeetFooterAllCardsScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(RING_DRAW_WAIT_MS)
    const interactor = new DefaultLeafInteractor()
    const readings: CardReading[] = []
    for (const item of ITEMS) {
      readings.push(await pinchAndRead(interactor, item))
      await sleep(300)
    }
    for (const r of readings) {
      expect(r.showing, `card showing for ${r.item}`).toBe(true)
      expect(r.footerText.includes(FOOTER_EXPECTED_SUBSTRING), `footer for ${r.item}: "${r.footerText}"`).toBe(true)
    }
  }
}
