import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {FiveFeetFooterAllCardsScenario} from "./FiveFeetFooterAllCardsScenario"
import {FiveFeetPinchFenceScenario} from "./FiveFeetPinchFenceScenario"
import {FiveFeetPinchFirewoodScenario} from "./FiveFeetPinchFirewoodScenario"
import {FiveFeetPinchMulchScenario} from "./FiveFeetPinchMulchScenario"
import {FiveFeetPinchPlantScenario} from "./FiveFeetPinchPlantScenario"
import {FiveFeetRingDistanceScenario} from "./FiveFeetRingDistanceScenario"

@component
export class FiveFeetLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-ring-distance", typename: FiveFeetRingDistanceScenario.getTypeName()},
    {id: "c2-pinch-firewood", typename: FiveFeetPinchFirewoodScenario.getTypeName()},
    {id: "c3-pinch-mulch", typename: FiveFeetPinchMulchScenario.getTypeName()},
    {id: "c4-pinch-fence", typename: FiveFeetPinchFenceScenario.getTypeName()},
    {id: "c5-pinch-plant", typename: FiveFeetPinchPlantScenario.getTypeName()},
    {id: "c6-footer-all-cards", typename: FiveFeetFooterAllCardsScenario.getTypeName()}
  ]
}
