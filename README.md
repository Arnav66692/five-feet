# Five Feet

A Spectacles Lens that shows the first 5 ft around a house, called Zone 0, and what to clear from it before a wildfire. Built for Devpost Learn AR with SPECS.

Demo video: see the Devpost page for Five Feet.

## What it does
- Embers fall on the yard and make the firewood, mulch and fence glow where they land.
- A line draws itself on the ground 5 ft out from the wall. That's Zone 0.
- From far away each item shows a status badge: Move now, Phase-in, Needs 5 ft gap or OK.
- Walk up and pinch an item. A card names the fire threat (embers, flames and heat), says what California's Zone 0 rule says and what to do. Every card says "State rule. Check your local fire agency."
- The firewood, mulch and plant cards also give a short flood, tornado or earthquake tip.
- Pinch Done to see the fix. The firewood moves out, the mulch turns to gravel and the end of the fence turns to metal. At 3 of 3 the line turns green and a card says "Zone 0 clear".
- The Lens reads each card out loud. For blind users it also says each item, its distance and side as you walk up. Every card is shown as text, so it works without sound for deaf users.

## Limits
The items are stand-ins and a pinch stands in for recognizing them, since the preview can't recognize real objects. The flood, tornado and earthquake lines are short tips, not full checks like the fire one.

## How it was built
- Planned with the Devpost Learn skill pack. The design brief is in `devpost/design-brief.md`.
- Built with CLAD in Lens Studio 5.23.2, using Spectacles Interaction Kit and UI Kit.
- 13 LEAF tests in `Assets/Tests`, one per done criterion. One measures the line at 152.00 cm from the wall, and 5 ft is 152.4 cm.

## Run it
Open the project in Lens Studio 5.23.2 and start the Preview. `Packages/` should hold only Leaf, SpectaclesInteractionKit and SpectaclesUIKit.

## Sources
- NFPA, Preparing homes for wildfire: https://www.nfpa.org/education-and-research/wildfire/preparing-homes-for-wildfire
- IBHS, via Insurance Journal, Jul 15, 2020: https://insurancejournal.com/news/west/2020/07/15/575345.htm
- Times of San Diego, Aug 19, 2026: https://timesofsandiego.com/california-fires/2026/08/19/wildfire-requirements-zone-0/
- BB&K legal alert, Sep 9, 2026: https://bbklaw.com/resources/la090926-california-board-of-forestry-adopts-emergency-zone-0-regulations-under-ab-3074
