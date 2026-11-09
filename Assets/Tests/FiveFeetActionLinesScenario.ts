/**
 * Criterion 11: each non-OK card shows its action line from the brief, and the plant card shows
 * "Nothing to do." Also checks the Done button is on the cards with an action and not on the plant.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getCard, pinchAndRead, RING_DRAW_WAIT_MS} from "./FiveFeetLeafHelpers"

const EXPECTED: {item: string; action: string; done: boolean}[] = [
  {item: "Item_Firewood", action: "Move it out of the 5 ft zone.", done: true},
  {item: "Item_Mulch", action: "Swap it for gravel, pavers or bare soil.", done: true},
  {item: "Item_Fence", action: "Make the part touching the house metal or masonry.", done: true},
  {item: "Item_Plant", action: "Nothing to do.", done: false}
]

@component
export class FiveFeetActionLinesScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(RING_DRAW_WAIT_MS)
    const interactor = new DefaultLeafInteractor()
    const card = getCard()
    for (const e of EXPECTED) {
      const r = await pinchAndRead(interactor, e.item)
      const action = card.getActionText()
      const done = card.isDoneShowing()
      print(`[FiveFeetLEAF] c11 ${e.item}: verdict="${r.verdictText}" action="${action}" doneButton=${done}`)
      expect(r.showing, `card showing for ${e.item}`).toBe(true)
      expect(action, `action line for ${e.item}`).toBe(e.action)
      expect(done, `Done button for ${e.item}`).toBe(e.done)
      await sleep(300)
    }
  }
}
