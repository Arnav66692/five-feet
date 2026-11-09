/**
 * Criterion 8: at least one combustible item (firewood, mulch, fence) glows during the ember
 * opener, and the plant never glows. Watches every item's glow state through the whole opener,
 * and checks an ember really landed on the plant so "never glows" is not trivially true.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetEmberOpener} from "../Scripts/FiveFeetEmberOpener"
import {FiveFeetItem} from "../Scripts/FiveFeetItem"
import {requireComponent} from "./FiveFeetLeafHelpers"

const COMBUSTIBLES = ["Item_Firewood", "Item_Mulch", "Item_Fence"]
const PLANT = "Item_Plant"
const POLL_MS = 33
const WATCH_LIMIT_MS = 9000
const AFTER_LAST_LANDING_MS = 1800 // longer than the 1.5 s glow

@component
export class FiveFeetEmberGlowScenario extends Scenario {
  async run(): Promise<void> {
    const opener = requireComponent<FiveFeetEmberOpener>("EmberOpener", FiveFeetEmberOpener.getTypeName())
    const combustibles = COMBUSTIBLES.map((n) => requireComponent<FiveFeetItem>(n, FiveFeetItem.getTypeName()))
    const plant = requireComponent<FiveFeetItem>(PLANT, FiveFeetItem.getTypeName())

    const seenGlowing: Record<string, boolean> = {}
    let plantSeenGlowing = false
    let watched = 0
    let afterLanding = 0
    while (watched < WATCH_LIMIT_MS && afterLanding < AFTER_LAST_LANDING_MS) {
      for (const it of combustibles) if (it.isGlowing()) seenGlowing[it.sceneObject.name] = true
      if (plant.isGlowing()) plantSeenGlowing = true
      await sleep(POLL_MS)
      watched += POLL_MS
      if (opener.isComplete()) afterLanding += POLL_MS
    }

    const hits = opener.getHitCounts()
    const counts = combustibles.map((it) => `${it.sceneObject.name}=${it.getGlowCount()}`).join(" ")
    print(
      `[FiveFeetLEAF] c8 glow: seenGlowing=[${Object.keys(seenGlowing).join(",")}] glowCounts: ${counts} ` +
        `plantGlowCount=${plant.getGlowCount()} plantSeenGlowing=${plantSeenGlowing} ` +
        `plantEmberHits=${hits[PLANT] || 0} openerComplete=${opener.isComplete()}`
    )
    expect(opener.isComplete(), "ember opener finished").toBe(true)
    expect(Object.keys(seenGlowing).length >= 1, "at least one combustible item was seen glowing").toBe(true)
    expect((hits[PLANT] || 0) >= 1, "an ember landed on the plant").toBe(true)
    expect(plantSeenGlowing, "plant was seen glowing").toBe(false)
    expect(plant.getGlowCount(), "plant glow count").toBe(0)
  }
}
