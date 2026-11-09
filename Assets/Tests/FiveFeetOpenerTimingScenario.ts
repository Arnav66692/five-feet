/**
 * Criterion 7: within 6 s of Lens start, at least 15 embers have spawned and the Zone 0 line has
 * finished drawing. Times are the Lens clock (getTime(), seconds since Lens start) recorded by the
 * opener at each spawn and by the ring when its draw completed.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {FiveFeetEmberOpener} from "../Scripts/FiveFeetEmberOpener"
import {FiveFeetZoneRing} from "../Scripts/FiveFeetZoneRing"
import {requireComponent, waitFor} from "./FiveFeetLeafHelpers"

const DEADLINE_S = 6
const MIN_EMBERS = 15
const WAIT_MS = 9000

@component
export class FiveFeetOpenerTimingScenario extends Scenario {
  async run(): Promise<void> {
    const opener = requireComponent<FiveFeetEmberOpener>("EmberOpener", FiveFeetEmberOpener.getTypeName())
    const ring = requireComponent<FiveFeetZoneRing>("Zone0Ring", FiveFeetZoneRing.getTypeName())
    await waitFor(() => ring.isDrawComplete(), WAIT_MS)

    const spawnTimes = opener.getSpawnTimes()
    const spawnedByDeadline = spawnTimes.filter((t) => t <= DEADLINE_S).length
    const ringDoneAt = ring.getDrawCompleteTime()
    print(
      `[FiveFeetLEAF] c7 opener: spawned=${spawnTimes.length} spawnedBy6s=${spawnedByDeadline} ` +
        `firstSpawn=${spawnTimes.length ? spawnTimes[0].toFixed(2) : "none"}s ` +
        `lastSpawn=${spawnTimes.length ? spawnTimes[spawnTimes.length - 1].toFixed(2) : "none"}s ` +
        `ringDrawnAt=${ringDoneAt.toFixed(2)}s`
    )
    expect(spawnedByDeadline >= MIN_EMBERS, `embers spawned by ${DEADLINE_S}s: ${spawnedByDeadline}`).toBe(true)
    expect(ring.isDrawComplete(), "Zone 0 line finished drawing").toBe(true)
    expect(ringDoneAt >= 0 && ringDoneAt <= DEADLINE_S, `line drawn at ${ringDoneAt.toFixed(2)}s`).toBe(true)
  }
}
