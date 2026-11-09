import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {FiveFeetFooterAllCardsScenario} from "./FiveFeetFooterAllCardsScenario"
import {FiveFeetPinchFenceScenario} from "./FiveFeetPinchFenceScenario"
import {FiveFeetPinchFirewoodScenario} from "./FiveFeetPinchFirewoodScenario"
import {FiveFeetPinchMulchScenario} from "./FiveFeetPinchMulchScenario"
import {FiveFeetPinchPlantScenario} from "./FiveFeetPinchPlantScenario"
import {FiveFeetRingDistanceScenario} from "./FiveFeetRingDistanceScenario"
import {FiveFeetOpenerTimingScenario} from "./FiveFeetOpenerTimingScenario"
import {FiveFeetEmberGlowScenario} from "./FiveFeetEmberGlowScenario"
import {FiveFeetDistanceBadgeScenario} from "./FiveFeetDistanceBadgeScenario"
import {FiveFeetCardScaleScenario} from "./FiveFeetCardScaleScenario"
import {FiveFeetActionLinesScenario} from "./FiveFeetActionLinesScenario"
import {FiveFeetDoneFirewoodScenario} from "./FiveFeetDoneFirewoodScenario"
import {FiveFeetZoneClearScenario} from "./FiveFeetZoneClearScenario"

@component
export class FiveFeetLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-ring-distance", typename: FiveFeetRingDistanceScenario.getTypeName()},
    {id: "c2-pinch-firewood", typename: FiveFeetPinchFirewoodScenario.getTypeName()},
    {id: "c3-pinch-mulch", typename: FiveFeetPinchMulchScenario.getTypeName()},
    {id: "c4-pinch-fence", typename: FiveFeetPinchFenceScenario.getTypeName()},
    {id: "c5-pinch-plant", typename: FiveFeetPinchPlantScenario.getTypeName()},
    {id: "c6-footer-all-cards", typename: FiveFeetFooterAllCardsScenario.getTypeName()},
    {id: "c7-opener-timing", typename: FiveFeetOpenerTimingScenario.getTypeName()},
    {id: "c8-ember-glow", typename: FiveFeetEmberGlowScenario.getTypeName()},
    {id: "c9-distance-badge", typename: FiveFeetDistanceBadgeScenario.getTypeName()},
    {id: "c10-card-scale", typename: FiveFeetCardScaleScenario.getTypeName()},
    {id: "c11-action-lines", typename: FiveFeetActionLinesScenario.getTypeName()},
    {id: "c12-done-firewood", typename: FiveFeetDoneFirewoodScenario.getTypeName()},
    {id: "c13-zone-clear", typename: FiveFeetZoneClearScenario.getTypeName()}
  ]
}
