/**
 * Criterion 13: after Done on the firewood, the mulch and the fence, the progress panel reads
 * "Zone 0: 3 of 3 fixed", the line material is green, and the "Zone 0 clear" card shows.
 * Done is pressed through the card's UI Kit button for each item in turn.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FiveFeetClearCardUI} from "../Scripts/FiveFeetClearCardUI"
import {FiveFeetItem} from "../Scripts/FiveFeetItem"
import {FiveFeetProgressUI} from "../Scripts/FiveFeetProgressUI"
import {pinchAndRead, pressDone, requireComponent, RING_DRAW_WAIT_MS, waitFor} from "./FiveFeetLeafHelpers"

const TO_FIX = ["Item_Firewood", "Item_Mulch", "Item_Fence"]
const EXPECTED_PROGRESS = "Zone 0: 3 of 3 fixed"
const EXPECTED_TITLE = "Zone 0 clear"
const FOOTER_SUBSTRING = "State rule"
const FIX_WAIT_MS = 3000
const CLEAR_WAIT_MS = 3000
const GREEN_MIN = 0.8
const GREEN_MARGIN = 0.2

function lineColor(): vec4 {
  const line = findSceneObjectByName("RingOuterLine")
  if (!line) throw new Error(`"RingOuterLine" not found`)
  const rmv = line.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  return rmv.mainMaterial.mainPass.baseColor
}

function isGreen(c: vec4): boolean {
  return c.y >= GREEN_MIN && c.y - c.x >= GREEN_MARGIN && c.y - c.z >= GREEN_MARGIN
}

@component
export class FiveFeetZoneClearScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(RING_DRAW_WAIT_MS)
    const interactor = new DefaultLeafInteractor()
    const progress = requireComponent<FiveFeetProgressUI>("ProgressPanel", FiveFeetProgressUI.getTypeName())
    const clear = requireComponent<FiveFeetClearCardUI>("ClearCard", FiveFeetClearCardUI.getTypeName())
    const startText = progress.getText()
    const startColor = lineColor()

    for (const name of TO_FIX) {
      const item = requireComponent<FiveFeetItem>(name, FiveFeetItem.getTypeName())
      await pinchAndRead(interactor, name)
      await pressDone(interactor)
      const fixed = await waitFor(() => item.isFixed(), FIX_WAIT_MS)
      print(`[FiveFeetLEAF] c13 Done on ${name}: fixed=${fixed} progress="${progress.getText()}"`)
      expect(fixed, `${name} fixed after Done`).toBe(true)
    }
    await waitFor(() => clear.isShowing(), CLEAR_WAIT_MS)

    const c = lineColor()
    const f = (v: number) => v.toFixed(2)
    print(
      `[FiveFeetLEAF] c13 zone: progressStart="${startText}" progressEnd="${progress.getText()}" ` +
        `lineStart=(${f(startColor.x)},${f(startColor.y)},${f(startColor.z)}) lineEnd=(${f(c.x)},${f(c.y)},${f(c.z)}) ` +
        `clearShowing=${clear.isShowing()} title="${clear.getTitle()}" footer="${clear.getFooter()}"`
    )
    expect(isGreen(startColor), "line not green before the fixes").toBe(false)
    expect(progress.getText(), "progress panel").toBe(EXPECTED_PROGRESS)
    expect(isGreen(c), `line material green (${f(c.x)},${f(c.y)},${f(c.z)})`).toBe(true)
    expect(clear.isShowing(), "Zone 0 clear card showing").toBe(true)
    expect(clear.getTitle(), "clear card title").toBe(EXPECTED_TITLE)
    expect(clear.getFooter().includes(FOOTER_SUBSTRING), "clear card footer").toBe(true)
  }
}
