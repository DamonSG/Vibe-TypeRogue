Agentic Development Prompt / V1 Development Plan
Project Title

TypeRogue · Typing Roguelike · 2.5D Light-Gun Shooter

Core Pitch

Build a web-based prototype of:

Slay the Spire meets The Typing of the Dead in a haunted 2.5D arcade shooter.

The game is a typing-first roguelike light-gun shooter built in ThreeJS, designed for web and deployed through GitHub Pages.

The player moves through a haunted castle hallway using a fixed-view 2.5D parallax presentation. Enemies appear in the scene with words, phrases, or punctuation-based typing prompts attached to them. The player types those prompts to damage enemies, survive waves, collect upgrades, build a run strategy, and defeat a Cursed Knight boss.

The V1 goal is not a huge game.
The V1 goal is a solid, polished base that proves:

Typing combat feels satisfying.
Enemy health creates meaningful combat.
The 2.5D parallax hallway feels cinematic.
Roguelike upgrades create different typing builds.
The boss gives the run a memorable climax.
The game can be served cleanly through GitHub Pages.
Build Target
Platform
Web
Desktop-first
Keyboard required
GitHub Pages deployment
Tech Requirements

Use:

ThreeJS
HTML/CSS/JavaScript or TypeScript
Vite recommended
No backend
No external paid services
Must run fully client-side
Must support GitHub Pages deployment

Recommended stack:

Vite + TypeScript + ThreeJS

The game should be able to run locally with:

npm install
npm run dev

And build with:

npm run build

The final build should be deployable to GitHub Pages using the /dist output.

Core Game Description

The player is fixed in a first-person/light-gun style viewpoint inside a haunted castle hallway.

The game uses 2.5D parallax, not full 3D movement.

The player does not walk manually. Instead:

Scene starts with a fixed player view.
Background parallax subtly moves.
Enemies appear in the hallway.
Player types enemy words to damage and kill them.
Player clears waves.
Camera/background moves deeper into the hallway.
New wave begins.
Player earns upgrade choices.
Run continues until the Cursed Knight boss.
Player wins or dies.
End screen shows stats and rank.
V1 Scope
Must Include
One haunted castle hallway biome
ThreeJS 2.5D/parallax scene
Fixed player viewpoint
Keyboard typing combat
Enemy word labels
Enemy health
Player HP
Mistake feedback
Combo system
5–6 enemy types
15–20 upgrades
3 upgrade choices after encounters
Simple run progression
Cursed Knight boss
End screen with stats
Replay button
GitHub Pages-ready build
Must Avoid
Full 3D player movement
Complex inventory
Heavy story system
Multiplayer
Mobile controls for V1
Gacha systems
Permanent stat grinding
Overly complex maps
Unreadable word clutter
Too many control inputs
Core Controls
Main Combat

The player only types.

Typing is the main weapon.

Optional Future Controls

Number keys 1–0 may later be used for spells or bonus abilities, but for V1 they are optional and should not be required.

For V1, prioritize making typing combat feel excellent.

Typing Combat System
Enemy Prompt System

Each enemy has a visible prompt.

Prompts can be:

Single words
Longer words
Short phrases
Punctuation phrases

Examples:

bone
mist
fang
castle
shadow
broken blade
don't blink
rise, again
the king's guard
Targeting Rules

Targeting should be automatic.

When the player starts typing, the game should search active enemies for prompts matching the typed input.

Example:

Enemies:

Breeze
Brain

Player types:

BR

Both may still match.

If the player continues:

BREEZE

The game resolves the target as:

Breeze

Damage should be applied to the resolved matching enemy.

Important:

The system should support ambiguous starts.
The game should resolve the intended target once the input becomes specific.
If no prompt matches, trigger mistake feedback.
Active typed letters should visually highlight on the word card.
Incorrect input should flash red and break combo.
Enemy Health System

Enemies must have health.

Do not make every enemy die instantly after one word unless their health is low enough.

Typing should feel like attacking an enemy, not simply deleting a word from the screen.

Recommended behavior:

Correct letters create small feedback.
Completing a word deals a larger damage hit.
Enemy HP decreases.
If enemy HP remains, it receives a new word or keeps the same word depending on enemy type.
If enemy HP reaches 0, enemy dies with strong feedback.

This allows upgrades and typing speed to matter.

Combat Feedback Requirements

Typing must feel satisfying.

Correct Letter Feedback

Each correct letter should trigger:

Letter highlight
Small audio tick
Small particle or spark
Minor enemy flinch or word card pulse
Combo continuation
Mistake Feedback

A mistake should trigger:

Red flash on input/word card
Error sound
Combo break
Small screen/UI shake

Mistakes should not directly damage the player in V1.

Completed Word Feedback

Completing a word should trigger:

Stronger hit effect
Projectile/spell impact
Enemy damage number or HP reduction feedback
Satisfying sound
Kill Feedback

Enemy death should trigger:

Particle burst
Word card shatter/fade
Satisfying kill sound
Score pop-up
Combo increase feedback
Optional small screen shake
Player Health and Failure

The player has HP.

The player takes damage when:

Enemy attack timer completes
Enemy reaches the player
Boss attack lands
Projectile/threat is not cleared in time

The player loses when HP reaches 0.

When HP reaches 0:

Stop combat
Show defeat end screen
Show stats
Offer replay
Enemy Types for V1

Create 5–6 enemy types.

1. Skeleton Grunt

Purpose: basic tutorial enemy.

Behavior:

Medium speed
Simple words
Low health
Basic attack timer

Example prompts:

bone
rust
skull
grave
2. Crawling Ghoul

Purpose: pressure enemy.

Behavior:

Fast approach
Low health
Short words
Forces quick reaction

Example prompts:

bite
crawl
fang
rot
3. Shielded Guard

Purpose: teaches enemy health.

Behavior:

Higher HP
Slower approach
May require multiple completed words
Clear shield/armor visual

Example prompts:

guard
shield
iron
broken shield
4. Ghost

Purpose: focus/disruption enemy.

Behavior:

Flickers visually
Medium health
Slightly harder words
Can appear at different depths

Example prompts:

vanish
whisper
shadow
silent
5. Cursed Caster

Purpose: target-priority enemy.

Behavior:

Stays further back
Uses punctuation or phrases
Attack timer creates pressure

Example prompts:

don't blink
rise, again
curse you
dark spell
6. Elite Knight

Purpose: pre-boss threat.

Behavior:

High health
Longer words
Strong attack if ignored
Used in elite encounters

Example prompts:

black armor
rusted blade
kneel, mortal
castle guard
Boss: The Cursed Knight

The V1 boss is The Cursed Knight.

The boss should appear at the end of the castle hallway run.

It should feel like the climax of the prototype.

Boss Requirements
Large readable sprite/card in the scene
Boss HP bar
Multiple phases
Clear attack warnings
Uses longer prompts and punctuation
Can summon smaller enemies
Has strong phase-change feedback
Suggested Boss Phases
Phase 1: Armored Advance

The boss slowly advances.

Player types armor-related words to damage the boss.

Example prompts:

iron
shield
rusted blade
Phase 2: Summon Guards

Boss summons skeletons/ghosts.

Player must choose between:

Clearing minions
Damaging boss
Surviving pressure
Phase 3: Curse Phrases

Boss uses harder phrases.

Example prompts:

kneel, mortal
the blade remembers
don't look away
Phase 4: Final Rush

Boss attacks faster.

Pressure increases.

Music/effects intensify.

Player must finish the boss before taking fatal damage.

Run Structure

V1 should have a short roguelike run structure.

Target run length:

5–8 minutes
Suggested Run Flow
Start Run
↓
Combat Encounter 1
↓
Upgrade Choice
↓
Combat Encounter 2
↓
Upgrade Choice
↓
Elite Encounter
↓
Upgrade Choice
↓
Combat Encounter 3
↓
Upgrade Choice
↓
Cursed Knight Boss
↓
Victory / Defeat End Screen

This can be linear for the first prototype.

A simple node choice system can be added if time allows, but the priority is the core combat loop.

Upgrade System

After encounters, show 3 upgrade cards.

The player chooses 1.

Upgrades should create typing builds.

Do not make upgrades only flat stat boosts. Some flat boosts are fine, but the best upgrades should change how typing feels.

Upgrade Pool Target

Create 15–20 upgrades for V1.

Upgrade Categories
Short Word Build

Rewards quick typing.

Example:

Quick Draw
Words with 5 or fewer letters deal +30% damage.
Long Word Build

Rewards harder prompts.

Example:

Longshot
Words with 7+ characters deal bonus damage and pierce to another enemy.
Accuracy Build

Rewards clean typing.

Example:

Perfect Rhythm
Completing a word with no mistakes grants a small shield.
Combo Build

Rewards flow.

Example:

Chain Focus
Every 5-word combo deals bonus damage to the nearest enemy.
Defensive Build

Helps survival.

Example:

Ward Sigil
Perfect words restore a small amount of barrier.
Chain Damage Build

Creates satisfying clears.

Example:

Arc Letter
Killing an enemy shocks the nearest enemy.
Risk/Reward Build

Creates tension.

Example:

Cursed Ink
Deal +40% damage while below 30% HP.
Suggested V1 Upgrade List

Implement a simple version of these:

Quick Draw — Short words deal bonus damage.
Longshot — Long words deal bonus damage.
Perfect Rhythm — Perfect words grant shield.
Arc Letter — Kills shock nearby enemies.
Chain Focus — Every 5 combo triggers bonus damage.
Steady Hands — Mistake penalty reduced.
Panic Cast — Deal more damage at low HP.
Clean Cut — Perfect word kills add extra combo.
Heavy Ink — Completed words deal more damage but combo builds slower.
Glass Quill — Higher damage, lower max HP.
Soul Refund — Killing an enemy has a chance to heal 1 HP.
Echo Type — Repeating the same first letter chain gives bonus damage.
Boss Breaker — Deal bonus damage to elites and bosses.
Shield Script — Every 3 perfect words grants barrier.
Rapid Scribe — Faster word completion increases damage.
Curse Splitter — Punctuation phrases deal bonus damage.
Last Letter — Final letter of every word deals extra impact damage.
Overtype — Combo above 10 increases all damage.
Safe Start — Begin each encounter with temporary shield.
Execution Mark — Low-health enemies take bonus finishing damage.
Visual Direction

The game should look like:

Painted 2D fantasy backgrounds with stylized enemies and polished mobile-game effects.

Environment
Haunted castle hallway
Stone walls
Tall arches
Candles
Fog
Banners
Chains
Cracked floor
Distant glowing doorway
Foreground debris for parallax
2.5D Setup

Use layered planes/sprites in ThreeJS.

Suggested layers:

Far background
Mid hallway architecture
Enemy layer
Fog layer
Foreground pillars/debris
UI layer

The player view should feel like a 2D illustration with depth.

UI Requirements

UI should feel polished and readable, not generic.

Required UI
Player HP
Current combo
Current typed input
Enemy word cards
Enemy health indicators
Enemy attack/danger indicators
Upgrade cards
Boss health bar
End screen stats
Replay button
Word Card Requirements

Each enemy word card should have:

Strong contrast
Clear font
Current typed letters highlighted
Active target highlight
Mistake flash
Health/damage state
Danger/attack timer

Readability is more important than visual flair.

End Screen

The end screen must feel screenshot-shareable.

Show:

Victory or Defeat
Accuracy %
Words typed
Mistakes
Highest combo
Enemies defeated
Damage taken
Boss defeated or boss HP remaining
Build title
Rank/title
Replay button
Example Rank Titles
Nervous Apprentice
Panic Typist
Bone Typist
Castle Menace
Combo Exorcist
Cursed Keyboard
Knightbreaker
Perfect Scribe
Example Share Moments
I beat the Cursed Knight with 94% accuracy.
I died typing “don’t blink” at 1 HP.
I cleared the hallway with a 37-word combo.
I made a long-word piercing build and melted the boss.
Audio Requirements

Audio is important.

Implement simple placeholder sounds if final sounds are not available.

Required sound events:

Correct letter
Mistake
Word completed
Enemy hit
Enemy killed
Combo increase
Upgrade selected
Enemy warning
Player damaged
Boss phase change
Victory
Defeat

The goal:

Every letter feels like a small shot.
Every word feels like an attack.
Every kill feels like a reward.
Data-Driven Architecture

Please structure the game to be easy to alter.

Use data files/config objects for:

Enemy definitions
Word pools
Upgrade definitions
Encounter definitions
Boss phases
Tuning values

Avoid hardcoding everything directly into scene logic.

Recommended structure:

/src
  /main.ts
  /game
    Game.ts
    GameState.ts
    InputManager.ts
    TypingSystem.ts
    CombatSystem.ts
    EncounterManager.ts
    UpgradeSystem.ts
    BossSystem.ts
  /render
    SceneRenderer.ts
    ParallaxScene.ts
    EnemyView.ts
    Effects.ts
    UI.ts
  /data
    enemies.ts
    words.ts
    upgrades.ts
    encounters.ts
    boss.ts
  /styles
    main.css
Important Implementation Notes
Typing Input

The typing system should:

Listen to keyboard input.
Build a current input string.
Match against active enemy prompts.
Highlight matching letters.
Resolve target when possible.
Apply mistake feedback when no match exists.
Reset input after word completion.
Support spaces and punctuation.
Ignore modifier keys like Shift, Ctrl, Alt, Meta.
Support Backspace if needed.
Word Matching

Must support:

Case-insensitive matching
Spaces
Apostrophes
Commas
Exclamation marks
Hyphens
Ambiguous starts
Multiple active enemies
Enemy Prompt Refresh

When an enemy survives a completed word:

Option A:

Give it a new prompt.

Option B:

Keep the same prompt and reset typing.

For V1, recommended:

Basic enemies die after 1 completed word if damage is enough.
Tankier enemies receive a new prompt after each completed word.
Difficulty Tuning

Start easy.

Increase pressure through:

More enemies
Faster timers
Longer words
Punctuation phrases
Tankier enemies
Boss summons

Avoid making V1 unfair through unreadable clutter.

Milestone Plan
Milestone 1 — Project Setup

Goal: build the technical foundation.

Tasks:

Create Vite + ThreeJS project.
Create GitHub Pages-compatible build.
Create main game loop.
Create basic scene.
Add keyboard input system.
Add placeholder UI layer.

Acceptance criteria:

Project runs locally.
Project builds successfully.
Blank/basic ThreeJS scene appears.
Keyboard input can be read.
GitHub Pages deployment path is considered.
Milestone 2 — Typing Combat Prototype

Goal: prove the core interaction.

Tasks:

Spawn one enemy.
Attach word card.
Type letters to match word.
Highlight typed letters.
Detect completed word.
Damage enemy.
Kill enemy.
Add correct/mistake feedback.

Acceptance criteria:

Player can type a word to damage an enemy.
Correct letters feel responsive.
Mistakes are clear.
Enemy health is visible.
Enemy death feels satisfying, even with placeholder art.
Milestone 3 — Multiple Enemies and Targeting

Goal: make combat work under pressure.

Tasks:

Spawn multiple enemies.
Implement auto-targeting.
Handle ambiguous starting letters.
Resolve target based on completed input.
Add enemy attack timers.
Add player HP.
Add game over.

Acceptance criteria:

Multiple enemies can be active.
Player can type matching prompts naturally.
Ambiguous words do not break the system.
Enemies damage player if ignored.
Player can lose.
Milestone 4 — 2.5D Parallax Hallway

Goal: prove the visual identity.

Tasks:

Build haunted castle hallway scene.
Add layered parallax background.
Add foreground layers.
Add fog/atmosphere.
Place enemies at depth positions.
Add movement deeper into hallway after wave clear.

Acceptance criteria:

Scene feels like a 2D image with depth.
The camera/background movement feels like progressing through a hallway.
Enemies remain readable.
Word cards remain readable.
Milestone 5 — Encounters and Run Flow

Goal: create a playable short run.

Tasks:

Add encounter sequence.
Add wave clear detection.
Add transition between encounters.
Add basic scoring.
Add combo tracking.
Add simple run state.

Acceptance criteria:

Player can start a run.
Player clears multiple encounters.
Game transitions deeper into hallway.
Run can progress toward boss.
Milestone 6 — Upgrade System

Goal: add roguelike replayability.

Tasks:

Add upgrade choice screen after encounters.
Show 3 upgrade cards.
Implement 15–20 upgrades.
Apply upgrades to combat.
Track build identity.

Acceptance criteria:

Player chooses upgrades between fights.
Upgrades affect gameplay.
Different upgrade choices create different typing feel.
Upgrade system is data-driven.
Milestone 7 — Cursed Knight Boss

Goal: create the run climax.

Tasks:

Add boss scene.
Add boss HP.
Add phases.
Add boss prompts.
Add summon behavior.
Add phrase/punctuation attacks.
Add victory state.

Acceptance criteria:

Boss fight is playable.
Boss has multiple readable phases.
Boss pressures the player.
Player can win or lose.
Milestone 8 — End Screen and Polish Pass

Goal: make V1 feel complete.

Tasks:

Add victory/defeat end screen.
Show stats.
Show rank/title.
Add replay button.
Add sound effects.
Add particles.
Add screen shake.
Add UI polish.
Add balancing pass.

Acceptance criteria:

Game feels like a complete prototype.
Player can replay immediately.
End screen is screenshot-shareable.
Typing, hits, and kills feel satisfying.
V1 Acceptance Criteria

The V1 prototype is successful when:

The game runs in browser.
The game can be deployed to GitHub Pages.
Player can complete a full short run.
Player can die and restart.
Typing combat is responsive and satisfying.
Enemies have health and clear threat states.
The hallway has convincing 2.5D parallax depth.
Upgrade choices affect gameplay.
The Cursed Knight boss is playable.
End screen shows useful stats.
The codebase is easy to extend.
Final Instruction to Development Team

Prioritize game feel over content quantity.

The first playable version does not need perfect final art. Placeholder art is acceptable if the structure supports replacing it later.

However, the prototype should not feel like a dry tech demo. It needs basic juice:

responsive typing
strong hit feedback
readable enemy prompts
satisfying kill effects
clear player damage
upgrade choices
a boss climax
replay flow

The goal is to create a solid strong base that we can later improve visually, mechanically, and structurally.

Build the game so we can easily tune:

enemy HP
enemy speed
attack timers
word difficulty
upgrade effects
encounter length
boss phases
run length