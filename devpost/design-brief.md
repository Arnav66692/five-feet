---
status: approved
---

# Design brief: Five Feet

<!-- Filled in from Arnav's decisions made Nov 8, 2026 (idea pick, verdict table, pilot bar). Claude wrote the answers at his request, and he approved the brief. -->

## The one spatial moment
I stand at the back wall of my house and look down. A ring draws itself on the ground 5 ft out from the wall, which marks California's new Zone 0 ember zone. I pinch the firewood stack inside the ring and a card above it says "Move now".

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: the 5 ft line is drawn on the actual ground where the rule applies, so you see which things sit inside it. Your hands stay free to move the firewood or pull the mulch while the line stays in view. On a phone you hold the screen up and can't do the work at the same time.

## Product or overlay
- Type: overlay. It responds to real things around the house.
- What the real version would sense: the house wall and the items near it (firewood, mulch, fences, plants).
- Stand-in for the preview: a virtual house wall and ground at real size, plus 4 placed stand-in items, each tagged with what it is: a firewood stack, a wood mulch bed, an attached wood fence and a small potted plant. Pinching an item stands in for recognizing it.

## Where things live
- Where the user is looking during the main task: down and ahead at the ground along the wall, 1 to 2 m away.
- House wall: a flat wall 4 m wide and 2.5 m tall (default), about 2.5 m in front of the user at start, standing on the ground, so the 5 ft line sits about 1 m ahead of the user's feet and in view when looking down.
- Zone 0 ring: a band on the ground that runs 1.52 m (5 ft) out from the wall along its full width, drawn as a light orange line 5 cm wide (default) on the ground. It draws itself from one end to the other in about 2 s when the Lens starts (default).
- Firewood stack: inside the ring, about 0.5 m from the wall, 60 cm wide (default).
- Wood mulch bed: inside the ring, along the wall, 1 m by 0.5 m (default).
- Attached wood fence: a short fence section that touches the wall and runs out across the ring, 1 m tall (default).
- Small potted plant: inside the ring, about 30 cm tall (default).
- Verdict card: floats about 30 cm above the item that was pinched, faces the user, 25 cm wide (default), light text on a dark panel.

## Hands and input
- See a verdict: pinch an item.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Ring: draws itself when the Lens starts, then stays.
- Verdict card: shows when an item is pinched, hides when another item is pinched (that item's card shows instead) or after 8 s (default).
- If something needs attention out of view: none. Everything sits in front of the user along one wall.

## Verdicts (state rule)
Each card shows the verdict in large text, one short reason below it, and the line "State rule. Check your local fire agency."

| Item | Verdict | Reason |
|---|---|---|
| Firewood stack | Move now | Already required before Zone 0. |
| Wood mulch bed | Phase-in | Existing homes get 3 to 5 years. |
| Attached wood fence | Needs 5 ft gap | The first 5 ft from the house must be noncombustible. |
| Small potted plant | OK | Small, maintained nonwoody plants are allowed. |

Any item without a verdict shows "Not sure. Ask your fire agency" (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. The ring's outer edge is 1.52 m (plus or minus 0.05 m) from the wall along the wall's full width.
2. Pinching the firewood stack shows "Move now".
3. Pinching the wood mulch bed shows "Phase-in".
4. Pinching the attached wood fence shows "Needs 5 ft gap".
5. Pinching the small potted plant shows "OK".
6. Every verdict card includes "State rule".

## Out of scope
- Recognizing real objects or finding the real house wall.
- Roof, gutter and branch checks (they need looking up, not down).
- Sheds, decks and the property line case.
- Saving a checklist between sessions.

## Risks and open questions
- The Zone 0 rules were approved Aug 19, 2026 and sent to OAL Aug 28, 2026. They may not be in effect yet, so the cards say "state rule" and send people to their local fire agency.
- Only real glasses could show whether the ring is readable on real ground in daylight.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

---

# Version 2 (Nov 9, 2026)

Written after judging v1 against the judges' stated tastes. v1 showed the line and a verdict, then stopped. v2 shows why the 5 ft matters, tells you what to do, and lets you clear the zone. Every v1 done criterion still applies.

## The one spatial moment, v2
Embers drift down onto the yard. The ones that land inside the 5 ft of the house hit the firewood, the mulch and the fence and make them glow. Then the 5 ft line draws itself. I pinch the firewood, the card says "Move now" and "Move it out of the 5 ft zone", and I pinch "Done". The firewood slides out past the line and gets a green check. When every item that needed work is fixed, the line turns from orange to green and a card says "Zone 0 clear".

## What changes
- **Ember opener (first 6 s).** About 20 small glowing embers fall from above the roof over 3 s. Embers that land inside the zone on a combustible item (firewood, mulch, fence) make that item glow orange for about 1.5 s. Embers that land on the ground fade out. Then the line draws, as in v1. This is the demo hook, and it explains the rule without words.
- **Cards that adapt to distance.** From farther than 2.5 m, each item shows only a small colored badge with its one-word status (Move now, Phase-in, Needs gap, OK). Within 2.5 m, pinching shows the full card. The full card scales with distance so the verdict text stays the same apparent size to the user, about 3 cm tall at 1 m, and is easy to read at 0.7 m to 3 m.
- **What to do.** Each card has one action line below the reason:
  - Firewood: "Move it out of the 5 ft zone."
  - Wood mulch: "Swap it for gravel, pavers or bare soil."
  - Wood fence: "Make the part touching the house metal or masonry."
  - Small potted plant: no action. The card says "Nothing to do."
- **Done button.** Cards with an action show one big "Done" button (UI Kit, at least 8 cm wide). Pinching it shows the fix:
  - Firewood slides out to about 2.2 m from the wall over 1 s.
  - The mulch bed changes to gray gravel.
  - The first 1 m of fence next to the wall changes to dark gray metal.
  - The item gets a green check badge and its card hides.
- **Progress.** A small panel on the wall, above the items, reads "Zone 0: 0 of 3 fixed" and counts up. When all 3 are fixed, the line animates from orange to green over 1 s, and a card at the center of the wall says "Zone 0 clear" with the footer "State rule. Check your local fire agency."
- **Voice.** When a card shows, the Lens reads out the verdict and the action with text to speech. If text to speech is not available, it logs a warning and the card still works.
- **It looks like a real back yard.** The wall gets horizontal lap siding lines, a window, a back door, a roof eave with a gutter along the top, and a light warm color. The ground in front of the wall is dirt and patio inside the zone, with grass from 3 m out. Everything stays at real size and keeps the same positions as v1.

## Done criteria, v2
7. Within 6 s of start, at least 15 embers have spawned and the line has finished drawing.
8. At least one combustible item glows during the ember opener, and the plant never glows.
9. With the camera 3 m from an item, the item shows its badge and no full card is showing. With the camera 1.5 m away, pinching it shows the full card.
10. The full card's world scale at 3 m is 2 to 2.4 times its scale at 1.5 m (text keeps the same apparent size).
11. Each non-OK card shows its action line from the table above, and the plant card shows "Nothing to do."
12. Pinching Done on the firewood moves it so its center is more than 1.8 m from the wall, and its check badge shows.
13. After Done on firewood, mulch and fence, the progress panel reads "Zone 0: 3 of 3 fixed", the line material is green, and the "Zone 0 clear" card shows.
14. All 6 v1 LEAF scenarios still pass.

Not testable in preview (feel unproven): whether the voice is clear, and whether embers read as embers on real glasses.

## Build notes for v2
- Keep every v1 name, position and test working. Add new LEAF scenarios for criteria 7 to 13.
- Keep the display additive: green and orange must stay light enough to read.
- Use Spectacles Interaction Kit and UI Kit for the Done button so LEAF and the mouse can press it.
- Do not install packages other than ones already in Packages/. If text to speech needs a module asset, create it from Lens Studio's built-in asset types, not a package.
