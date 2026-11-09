/**
 * FiveFeetSceneContracts — stable scene names and rule values for Five Feet.
 *
 * Owns: the names tests and future agents use to find things, and the brief's rule values.
 * Must NOT: hold runtime state. Change a name here only together with the scene.
 */
export const FIVE_FEET_NAMES = {
  root: "FiveFeet",
  ground: "Ground",
  houseWall: "HouseWall",
  zoneRing: "Zone0Ring",
  ringOuterLine: "RingOuterLine",
  ringSideLeft: "RingSideLeft",
  ringSideRight: "RingSideRight",
  ringFill: "RingFill",
  items: "Items",
  firewood: "Item_Firewood",
  mulch: "Item_Mulch",
  fence: "Item_Fence",
  plant: "Item_Plant",
  verdictCard: "VerdictCard",
  cardPanel: "CardPanel",
  verdictText: "VerdictText",
  reasonText: "ReasonText",
  footerText: "FooterText",
  // v2
  emberOpener: "EmberOpener",
  actionText: "ActionText",
  doneButton: "DoneButton",
  badgePrefix: "Badge_",
  checkPrefix: "Check_",
  fixPrefix: "Fix_",
  progressPanel: "ProgressPanel",
  clearCard: "ClearCard",
  voice: "Voice",
  yardGround: "YardGround"
}

/** Zone 0 is the first 5 ft (152 cm) from the house wall. Tolerance from the brief: plus or minus 5 cm. */
export const ZONE0_OUTER_EDGE_CM = 152
export const ZONE0_TOLERANCE_CM = 5
