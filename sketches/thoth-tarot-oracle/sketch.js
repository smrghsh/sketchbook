import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ─── Card Data ──────────────────────────────────────────────────────────────

const CARDS = [
  // ── MAJOR ARCANA ──
  {
    id: "00-the-fool",
    name: "The Fool",
    arcana: "major",
    number: 0,
    sub: "Aleph · Air",
    upright:
      'The Fool is pure spirit before the fall into matter — boundless potential, zero fear. Crowley calls it "the Green Man" reborn: the folly of the wise, who acts without calculation because calculation cannot contain the infinite. Where others see recklessness, the initiate sees faith enacted. Step boldly into the next threshold you\'ve been circling; the net appears only after the leap.',
    reversed:
      "Reversed, the Fool's energy scatters — inspiration without grounding, novelty as avoidance. You may be leaping to escape rather than to explore. Audit which 'new beginning' is actually unfinished business in disguise, and complete one cycle before opening another.",
  },
  {
    id: "01-the-magus",
    name: "The Magus",
    arcana: "major",
    number: 1,
    sub: "Beth · Mercury",
    upright:
      "The Magus is will made word — Mercury as the bridge between the infinite and the finite. DuQuette emphasizes that the Magus is not a trickster but a sacred intermediary: every tool on the table is a faculty of consciousness. Your communication right now is your magic. Clarify your intention into a single sentence, speak it clearly, and watch the field reorganize around it.",
    reversed:
      "Reversed, the Magus becomes the liar, the con-man, the one who uses language to obscure rather than illuminate. Check for places where you're telling yourself a story that serves comfort over truth. The lie you most need to retire is probably one you believe.",
  },
  {
    id: "02-the-priestess",
    name: "The Priestess",
    arcana: "major",
    number: 2,
    sub: "Gimel · Moon",
    upright:
      "The Priestess guards the veil between the conscious and the unmanifest. She is the pure, cool intelligence of the Moon — she does not act, she reflects. Crowley places her at the highest path on the Tree of Life: the path Gimel connecting Tiphareth to Kether. Stop pushing and let your unconscious process. The answer is already forming; rest, dream, and notice what surfaces at the edges of awareness.",
    reversed:
      "Reversed, the Priestess signals that intuition is being overridden by noise — too much input, too much social stimulus. Withdraw deliberately for even one hour of true silence. What you need to know cannot be found by searching; it comes in stillness.",
  },
  {
    id: "03-the-empress",
    name: "The Empress",
    arcana: "major",
    number: 3,
    sub: "Daleth · Venus",
    upright:
      "The Empress is Venus in full force — not just love but the life-force that drives all creation. In the Thoth deck she holds the shield of the pelican (self-sacrifice as creative act) and the lotus (the flowering of desire into form). Nourish the project, relationship, or practice that is still in its germinal stage. Creative abundance demands patience and tending, not forcing.",
    reversed:
      "Reversed, the Empress warns of creative blockage rooted in self-neglect. The body is the first creative instrument. Restore your physical vitality — sleep, real food, sensory pleasure — before trying to solve the creative problem intellectually.",
  },
  {
    id: "04-the-emperor",
    name: "The Emperor",
    arcana: "major",
    number: 4,
    sub: "Tzaddi · Aries",
    upright:
      "The Emperor is the sovereignty of the self, Aries as pure will-to-be. In Thoth he faces forward: nothing is hidden, nothing deferred. Crowley ties him to Heh and the formula of the Tetragrammaton — the masculine principle that structures and protects what the Empress nurtures. Build your container: the schedule, the budget, the boundaries, the framework. Great work requires structure as much as inspiration.",
    reversed:
      "Reversed, the Emperor shows tyranny turned inward — rigid self-discipline that has become self-punishment, or authority exercised from fear rather than strength. Examine one rule you enforce on yourself. Is it protective or punitive? Release what is merely habitual control masquerading as discipline.",
  },
  {
    id: "05-the-hierophant",
    name: "The Hierophant",
    arcana: "major",
    number: 5,
    sub: "Vav · Taurus",
    upright:
      "The Hierophant in the Thoth deck is Osiris as teacher, the inner voice of tradition speaking into you. DuQuette notes he is the revealer of secret things — not dogma but the living transmission of wisdom. Seek a teacher, a lineage, a practice with roots. There is something you can learn right now that cannot be gathered from YouTube; find the person who has actually walked the path you are on.",
    reversed:
      "Reversed, the Hierophant signals stale authority — rules followed without understanding, tradition without transmission. Question the doctrine. Which belief system are you operating inside without ever having consciously chosen it? Name it and decide deliberately whether it serves your growth.",
  },
  {
    id: "06-the-lovers",
    name: "The Lovers",
    arcana: "major",
    number: 6,
    sub: "Zayin · Gemini",
    upright:
      "The Lovers in the Thoth deck is not primarily about romance — it's about the Great Work of unification: the marriage of opposites within. Crowley places the Hermetic androgyne at the center and the Royal Marriage above. You are at a genuine crossroads requiring true discrimination (the sword of Zayin). Make the choice that integrates your two most apparent opposing values rather than sacrificing one for the other.",
    reversed:
      "Reversed, the Lovers shows a failure of discrimination — choosing by default, by inertia, or to please others. The sacred union requires you to know yourself clearly. Identify the internal split you've been avoiding and give each side a voice before deciding anything important.",
  },
  {
    id: "07-the-chariot",
    name: "The Chariot",
    arcana: "major",
    number: 7,
    sub: "Cheth · Cancer",
    upright:
      "The Chariot is triumph through containment — Cancer's shell is not weakness but the armor that allows total commitment. The warrior in the Thoth Chariot holds no reins; he controls opposing forces by integration rather than suppression. Your strength right now comes not from conquering resistance but from fully inhabiting your own nature. Do the hard thing from the inside of your shell of values, and the opposing forces resolve.",
    reversed:
      "Reversed, the Chariot signals that speed has outrun direction. Victory is being pursued without clarity about destination. Slow down enough to confirm you are moving toward something you actually want, not simply away from something you fear.",
  },
  {
    id: "08-adjustment",
    name: "Adjustment",
    arcana: "major",
    number: 8,
    sub: "Lamed · Libra",
    upright:
      "Adjustment (Thoth's name for Justice) is the sword of cosmic law — Ma'at weighing the heart. Crowley emphasizes that this card is utterly impersonal: the universe adjusts itself with absolute precision. What you put out returns with perfect fidelity. There is no point resisting what is being balanced in your life right now. Cooperate with the correction; it is a gift, not a punishment.",
    reversed:
      "Reversed, Adjustment warns of an imbalance you are actively resisting seeing. Something in your life is off-scale and you know it. Stop waiting for external circumstances to correct themselves; make the internal adjustment first and watch the outer world respond.",
  },
  {
    id: "09-the-hermit",
    name: "The Hermit",
    arcana: "major",
    number: 9,
    sub: "Yod · Virgo",
    upright:
      "The Hermit carries the lantern of Yod — the Hand of God, the seed of all manifestation. He is solitude as a creative act. DuQuette writes that the Hermit's lamp is Tiphareth (the Higher Self) shining down into matter. You don't need more information, more feedback, or more validation. You need a period of deliberate solitude to integrate what you already know. Let the lantern of your own inner knowing illuminate the next step.",
    reversed:
      "Reversed, the Hermit has become the recluse — isolation in service of avoidance. Solitude without purpose is just hiding. Identify what contact, community, or collaboration you have been refusing, and step toward it with your wisdom intact.",
  },
  {
    id: "10-fortune",
    name: "Fortune",
    arcana: "major",
    number: 10,
    sub: "Kaph · Jupiter",
    upright:
      "Fortune is the Wheel of Jupiter — the engine of manifestation, the great cycle turning. In the Thoth deck it shows the three alchemical principles (Sulphur, Salt, Mercury) in perpetual motion around the hub. Crowley teaches that the wise person does not fight the wheel but learns to ride it. You are in a cycle of change. Rather than seeking stability, develop the flexibility to move with what is turning.",
    reversed:
      "Reversed, Fortune signals you are clinging to a position on the wheel that has already turned past. The cycle has moved; the opportunity window you are protecting has closed. Release it consciously and you will rise on the next spoke rather than being dragged.",
  },
  {
    id: "11-lust",
    name: "Lust",
    arcana: "major",
    number: 11,
    sub: "Teth · Leo",
    upright:
      "Lust (Thoth's Strength) is the ecstasy of the will fully engaged with life — Babalon riding the Beast, the union of consciousness with the full force of nature. Crowley says this is the card of the adept who has integrated the animal: not tamed it, but partnered with it. The vital, instinctive energy in you is not the enemy of spiritual progress — it is the fuel. Stop apologizing for your fire and let it serve your purpose.",
    reversed:
      "Reversed, Lust shows force without direction — passion consuming itself, willpower cycling as anxiety, intensity without an object. Channel what is burning in you into a single creative or physical output right now. The body needs to express what the mind is churning.",
  },
  {
    id: "12-the-hanged-man",
    name: "The Hanged Man",
    arcana: "major",
    number: 12,
    sub: "Mem · Water",
    upright:
      "The Hanged Man is suspension as illumination — the voluntary sacrifice of the ego's trajectory for a higher vantage. In Thoth, the figure is serene, not tortured; this is the mystic who chose to stop, who finds in stillness an intelligence unavailable to the moving. Something in your current situation calls for deliberate pause. What appears as delay is initiation. Let the inversion happen; the new perspective will be worth the disorientation.",
    reversed:
      "Reversed, the Hanged Man is forced suspension — life making you pause because you wouldn't do it voluntarily. Resistance to the pause is adding suffering without insight. Instead of fighting the enforced stillness, mine it. What is the upside-down view trying to show you?",
  },
  {
    id: "13-death",
    name: "Death",
    arcana: "major",
    number: 13,
    sub: "Nun · Scorpio",
    upright:
      "Death in the Thoth deck is Scorpio at maximum power — the sickle sweeping through the field not as tragedy but as harvest. Crowley is explicit: this is transformation through dissolution. Something that has served its purpose must end. The energy it was holding can then become available for the next form. Identify what is already over in your life but has not yet been released. Conduct the ending with dignity and the transformation will be clean.",
    reversed:
      "Reversed, Death shows change refused — a form being kept alive past its natural span through fear, habit, or attachment. The cost of this refusal is stagnation bleeding into adjacent areas of your life. Name the one thing that is over, and choose to close it.",
  },
  {
    id: "14-art",
    name: "Art",
    arcana: "major",
    number: 14,
    sub: "Samekh · Sagittarius",
    upright:
      "Art (Thoth's Temperance) is the alchemical process itself — the mixing of opposites into gold. Crowley places the rainbow-robed figure combining fire and water, lion and eagle. DuQuette calls this the card of the Great Work in progress. You are in the middle of an integration that requires patience with the mess of transformation. The 'solve et coagula' — dissolve and coagulate — is not a linear process. Trust that the seemingly incompatible elements are combining into something new.",
    reversed:
      "Reversed, Art shows an alchemical process interrupted by impatience — the work destroyed before it could complete. You may be applying heat too fast or abandoning the vessel too soon. Recommit to the slow work of integration rather than seeking a premature result.",
  },
  {
    id: "15-the-devil",
    name: "The Devil",
    arcana: "major",
    number: 15,
    sub: "Ayin · Capricorn",
    upright:
      "The Devil in the Thoth deck is Pan — not evil but the ecstatic force of matter itself, Capricorn as the gateway to manifestation. The goat-god with the eye of the abyss says: the material world is not the enemy of spirit, it is its fullest expression. Engage with the physical and material dimensions of your goal. Money, body, concrete action in the world — these are how the Great Work gets done. Stop treating embodiment as a problem.",
    reversed:
      "Reversed, the Devil shows bondage to the very appetites that were supposed to liberate. Pleasure without purpose, comfort as avoidance, material engagement as a substitute for meaning. Identify the addiction — food, scroll, validation, fantasy — and interrupt the loop with a single hour of intentional action.",
  },
  {
    id: "16-the-tower",
    name: "The Tower",
    arcana: "major",
    number: 16,
    sub: "Peh · Mars",
    upright:
      "The Tower is the lightning-stroke of Peh — the mouth of God that speaks the word that destroys false structures. In the Thoth deck, the eye above the blasted tower sees everything. Crowley says this is not disaster but liberation: the falling battlements are the ego's fortifications. What structure in your life is built on an unexamined premise? The Tower will find it eventually. Cooperating with the necessary destruction is always less costly than defending the indefensible.",
    reversed:
      "Reversed, the Tower is the catastrophe avoided but the lesson not taken. The warning came and was dismissed, the structure wobbled but held — temporarily. Now is the time to voluntarily dismantle what you know is wrong before it collapses under its own weight.",
  },
  {
    id: "17-the-star",
    name: "The Star",
    arcana: "major",
    number: 17,
    sub: "Heh · Aquarius",
    upright:
      "The Star in the Thoth deck is the daughter of the firmament — Nuit, the infinite space and the stars therein. After the Tower, this is the card of revelation: suddenly the sky is clear and your true nature is visible. Aquarius pours from two cups simultaneously, giving freely to earth and sea alike. This is a card of genuine hope — not wishful thinking but the clear sight of what you actually are. You are more gifted than your current story of yourself allows. Update the story.",
    reversed:
      "Reversed, the Star is hope deferred into cynicism — the clear sky covered again, the authentic self-knowledge buried under performance. Locate one place where you are acting less capable or less luminous than you actually are. Stop underselling yourself in that domain.",
  },
  {
    id: "18-the-moon",
    name: "The Moon",
    arcana: "major",
    number: 18,
    sub: "Qoph · Pisces",
    upright:
      "The Moon is Qoph — the back of the head, the dreaming mind, the path through illusion. Crowley's Moon is the most menacing card in the Thoth deck: the crayfish of the deep unconscious, the dog and wolf at the threshold of the abyss. This is not a gentle card. There is something in the unconscious that is shaping your behavior from below. Dream journal, active imagination, somatic work — go into the dark deliberately before it comes for you.",
    reversed:
      "Reversed, the Moon shows the dreaming mind running day-consciousness. Projection, fantasy, fear-loops, and emotional weather from old memory are driving decisions. Name the fear that is actually operating and ask: is this now, or is this then? Reality-test before acting.",
  },
  {
    id: "19-the-sun",
    name: "The Sun",
    arcana: "major",
    number: 19,
    sub: "Resh · Sol",
    upright:
      "The Sun in the Thoth deck is Ra-Hoor-Khuit — the solar principle triumphant, the hawk-headed lord of the new Aeon. This is the card of solar consciousness: clear, warm, generous, fully visible. You don't need to hide what you're doing. Share the work in progress, let people see you building, let the light in. Visibility is not vanity when what you're showing is genuine. Shine, and you will attract the collaborators and circumstances you've been seeking.",
    reversed:
      "Reversed, the Sun is dimmed by self-consciousness — the light present but covered. You are playing smaller than the vision calls for. Identify one act of public commitment to your work or path, and do it today. The light grows by being shared.",
  },
  {
    id: "20-the-aeon",
    name: "The Aeon",
    arcana: "major",
    number: 20,
    sub: "Shin · Fire",
    upright:
      "The Aeon replaces the old Judgement card in the Thoth deck — it is the new dispensation, the Aeon of Horus, the cosmic dawn that makes the old hierarchies obsolete. Nuit, Hadit, and Ra-Hoor-Khuit together represent a new operating system. Something in your life has crossed a threshold that cannot be uncrossed. Acknowledge that you are in a genuinely new chapter, not a continuation of the old. The rules have changed; use the new ones.",
    reversed:
      "Reversed, the Aeon is the refusal of initiation — standing at the threshold of a new self but retreating into familiar identity. The old dispensation is over; the old you cannot navigate the new terrain. Name the identity you are clinging to and ask what it is protecting you from becoming.",
  },
  {
    id: "21-the-universe",
    name: "The Universe",
    arcana: "major",
    number: 21,
    sub: "Tau · Saturn",
    upright:
      "The Universe is the final Trump — Saturn, the Great Work completed, the dancing woman in the oval of space and time. Crowley says this is the attainment of the Magus: to have moved through every experience the Tree contains and to arrive at the center, dancing. You are completing a genuine cycle. Celebrate it before beginning the next. The integration happening now is foundational — everything you build next will be built on this achieved ground.",
    reversed:
      "Reversed, the Universe shows completion refused — the work done but not owned, the cycle ended but not honored. You are already further along than you allow yourself to believe. Stop seeking the next challenge as a way of avoiding acknowledging how much you have become. Receive what is already complete.",
  },

  // ── WANDS ──
  {
    id: "ace-of-wands",
    name: "Ace of Wands",
    arcana: "minor",
    suit: "wands",
    number: 1,
    sub: "Root of Fire",
    upright:
      "The Ace of Wands is pure Yod — the root of the fire element, the first flash of will before it takes form. This is the card of the Big Idea, the creative ignition, the permission slip from the universe to begin. Do not wait for the plan to solidify before taking the first action. The fire does not know its shape until it meets fuel; apply your inspiration to something concrete today.",
    reversed:
      "Reversed, the Ace of Wands shows creative energy bottled — inspiration present but unexpressed, will coiling inward as frustration. The block is not external. Stop waiting for permission, perfection, or the right moment. Light the match.",
  },
  {
    id: "two-of-wands",
    name: "Two of Wands",
    arcana: "minor",
    suit: "wands",
    number: 2,
    sub: "Dominion · Mars in Aries",
    upright:
      "Dominion is Mars in Aries — the will in its first full assertion of power. The two crossed wands form the Dorje: lightning in balance. DuQuette notes this is the Lord of Dominion at his most direct and fearless. Claim authority over your own domain. Stop qualifying your expertise to others. The person who needs to believe in your competence most urgently is you.",
    reversed:
      "Reversed, Dominion becomes domineering or abdicated — either bullying or deferring where you should lead. Find the middle path: confident ownership of your lane without needing to control adjacent territories.",
  },
  {
    id: "three-of-wands",
    name: "Three of Wands",
    arcana: "minor",
    suit: "wands",
    number: 3,
    sub: "Virtue · Sun in Aries",
    upright:
      "Virtue is the Sun in Aries — established strength, virtue in the classical sense of inherent power. The three lotus wands radiate from a common center. Your foundation is solid. Build on it. This is the moment to expand from the established base rather than starting over. The power you have cultivated through discipline and consistency is available to deploy in a new direction.",
    reversed:
      "Reversed, Virtue warns of squandering built-up capital — energetic, social, or creative. You are spending from a reserve that needs tending. Reinvest in the practices that built your strength before making new demands on it.",
  },
  {
    id: "four-of-wands",
    name: "Four of Wands",
    arcana: "minor",
    suit: "wands",
    number: 4,
    sub: "Completion · Venus in Aries",
    upright:
      "Completion is Venus in Aries — the beauty of perfect rest between efforts. Crowley's four wands form a stable platform: the fire has built something and paused to appreciate it. Acknowledge and celebrate a recent completion before moving to the next thing. The failure to pause and appreciate what you've built is itself a form of waste. Rest is part of the cycle, not a gap in it.",
    reversed:
      "Reversed, Completion shows an inability to rest — the drive to move forward preventing the consolidation of what has been built. You are starting the next project before the last one has landed. Let one thing fully close.",
  },
  {
    id: "five-of-wands",
    name: "Five of Wands",
    arcana: "minor",
    suit: "wands",
    number: 5,
    sub: "Strife · Saturn in Leo",
    upright:
      "Strife is Saturn in Leo — the contraction that tests the fire's resolve. The five lotus wands clash because Saturn enters Leo's domain and demands proof of worth. Competition, friction, and creative tension are the forge. This is not a bad card; it is the resistance that makes the work stronger. Lean into the difficulty rather than seeking the path of least resistance.",
    reversed:
      "Reversed, Strife has become exhaustion — fighting battles that do not refine you but merely drain. Audit which conflicts are sharpening you and which are just noise. Withdraw from the draining ones without guilt.",
  },
  {
    id: "six-of-wands",
    name: "Six of Wands",
    arcana: "minor",
    suit: "wands",
    number: 6,
    sub: "Victory · Jupiter in Leo",
    upright:
      "Victory is Jupiter in Leo — the natural authority of generous power. The six wands form a perfect hexagram, fire in its most balanced and radiant expression. You have earned a genuine win. Receive it without minimizing. Let yourself be seen in your success and let that visibility attract the next collaboration. Success shared multiplies; success hidden stagnates.",
    reversed:
      "Reversed, Victory has become vanity — needing recognition rather than being energized by it. Check whether the pursuit is for genuine achievement or for the audience's approval. Reorient toward the work itself and the recognition will follow authentically.",
  },
  {
    id: "seven-of-wands",
    name: "Seven of Wands",
    arcana: "minor",
    suit: "wands",
    number: 7,
    sub: "Valour · Mars in Leo",
    upright:
      "Valour is Mars in Leo — courage when outnumbered. One wand stands above six opponents. The Lord of Valour holds the high ground through sheer force of character. You are more capable than the opposition suggests. Hold your position. The person who refuses to be moved by pressure without good reason commands the field by virtue of that refusal. Stand your ground on what actually matters.",
    reversed:
      "Reversed, Valour shows unnecessary pugnacity — fighting everything, unable to discriminate between battles worth having and those worth surrendering. Choose: which two or three things are genuinely worth defending? Lay down the rest.",
  },
  {
    id: "eight-of-wands",
    name: "Eight of Wands",
    arcana: "minor",
    suit: "wands",
    number: 8,
    sub: "Swiftness · Mercury in Sagittarius",
    upright:
      "Swiftness is Mercury in Sagittarius — thought at the speed of fire, the arrow already mid-flight. Eight wands converge to a point with perfect coherence. This is the best possible card for execution: all energies aligned, all vectors pointing the same direction. Move now. Send the email, publish the work, make the call. The window of maximum alignment is open; don't let analysis paralysis close it.",
    reversed:
      "Reversed, Swiftness becomes haste — movement without aim, speed that overshoots the target. Pause for five minutes to aim before releasing. A precise, slower action will reach the mark that a frantic burst misses.",
  },
  {
    id: "nine-of-wands",
    name: "Nine of Wands",
    arcana: "minor",
    suit: "wands",
    number: 9,
    sub: "Strength · Moon in Sagittarius",
    upright:
      "Strength is Moon in Sagittarius — the resilience of fire tested by deep water. The nine wands stand as arrows about to be loosed: reserves built up through discipline, ready to deploy. You have more endurance than you currently believe. The practice, the training, the long investment — they have built something substantial. Trust the accumulated capacity and take the shot you've been preparing.",
    reversed:
      "Reversed, Strength has become defensive rigidity — holding position out of exhaustion rather than commitment. Rest before proceeding. The reserves need replenishment, not another draw. Schedule genuine recovery time.",
  },
  {
    id: "ten-of-wands",
    name: "Ten of Wands",
    arcana: "minor",
    suit: "wands",
    number: 10,
    sub: "Oppression · Saturn in Sagittarius",
    upright:
      "Oppression is Saturn in Sagittarius — the point where fire has become its own burden, will pressed back into itself by the weight of accumulated commitments. Crowley notes that this is the inevitable result of fire without direction: it burns everything including itself. Do an honest audit of your commitments and release at least two that are consuming fire without producing light. Simplification is not failure; it is the wisdom of Saturn.",
    reversed:
      "Reversed, Oppression shows the burden being lifted but resistance to letting it go. You are ready to be released from what has been heavy, but habit and identity are holding the weight in place. Put it down.",
  },
  {
    id: "princess-of-wands",
    name: "Princess of Wands",
    arcana: "minor",
    suit: "wands",
    number: "princess",
    sub: "Earth of Fire",
    upright:
      "The Princess of Wands is the most fearless card in the deck — Earth of Fire, the material manifestation of pure creative will. She is young, brazen, and does not know the word no. She leaps before looking and usually lands exactly right. Let her energy move through you: start the thing you are afraid to start. Burn the ship. The audacity IS the plan.",
    reversed:
      "Reversed, her fire turns to destruction — burn it all down energy that serves frustration rather than liberation. Check whether the impulse to upend everything is creative or reactive. Transform one specific outdated structure rather than torching the whole field.",
  },
  {
    id: "prince-of-wands",
    name: "Prince of Wands",
    arcana: "minor",
    suit: "wands",
    number: "prince",
    sub: "Air of Fire",
    upright:
      "The Prince of Wands is Air of Fire — swift, brilliant, persuasive, and unstoppable when moving. He is the creative visionary in full momentum. Harness his energy: pitch the idea with maximum conviction, lead the project with charismatic certainty, let enthusiasm be the credibility. People follow energy as much as expertise. Bring both.",
    reversed:
      "Reversed, the Prince of Wands is all flash and no follow-through — starting brilliantly and abandoning when the glamour wears off. This project needs your sustained engagement, not just your ignition. Commit to seeing this one through to completion before beginning the next.",
  },
  {
    id: "queen-of-wands",
    name: "Queen of Wands",
    arcana: "minor",
    suit: "wands",
    number: "queen",
    sub: "Water of Fire",
    upright:
      "The Queen of Wands is Water of Fire — passionate intensity made habitual, fire sustained by the rhythms of water. She is the woman who burns without burning out because she knows how to bank the coals. Her creative power is self-renewing. Build sustainable practices around your creative fire: the daily rhythm, the small ritual, the protected morning. The flame that is tended outlasts the bonfire.",
    reversed:
      "Reversed, her fire becomes consuming jealousy or possessiveness — the Queen who cannot let others shine. Check for places where admiration has curdled into resentment. Someone else's success does not diminish yours; the fire is not a finite resource.",
  },
  {
    id: "knight-of-wands",
    name: "Knight of Wands",
    arcana: "minor",
    suit: "wands",
    number: "knight",
    sub: "Fire of Fire",
    upright:
      "The Knight of Wands is Fire of Fire — pure, undiluted, consuming. He is the most energetic figure in the Thoth deck, riding full gallop with his club trailing flame. He goes all in. Whatever you are undertaking, bring his total commitment: no hedged bets, no partial investment, no exit strategy. The universe responds to undivided will with undivided support.",
    reversed:
      "Reversed, Fire of Fire becomes destructive haste — burning everything in the path including alliances and infrastructure you will need later. Intensity does not require recklessness. Harness the power without scorching the ground.",
  },

  // ── CUPS ──
  {
    id: "ace-of-cups",
    name: "Ace of Cups",
    arcana: "minor",
    suit: "cups",
    number: 1,
    sub: "Root of Water",
    upright:
      "The Ace of Cups is the Grail itself — the holy vessel overflowing with Binah's waters, the pure feminine principle of consciousness. Love is available at the root, right now, unconditionally. Open to emotional receptivity. Let something move you. The capacity for depth, for genuine feeling, for creative receptivity — this is the capital the Ace of Cups is asking you to invest in.",
    reversed:
      "Reversed, the Grail is inverted — the gifts poured out but nothing received. Examine where you are giving love, creative energy, or emotional presence without allowing yourself to receive. Sustainable generosity requires the vessel to be refilled.",
  },
  {
    id: "two-of-cups",
    name: "Two of Cups",
    arcana: "minor",
    suit: "cups",
    number: 2,
    sub: "Love · Venus in Cancer",
    upright:
      "Love is Venus in Cancer — the most tender and reciprocal of all the twos. The lotus cups overflow into one another in perfect balance. This card speaks of genuine mutuality: the relationship or collaboration where both parties are genuinely nourished. Don't let it pass unnamed. Say the thing. Accept the invitation. Initiate with warmth. Love this clean doesn't wait forever; it asks to be met.",
    reversed:
      "Reversed, Love becomes conditional — the cups tilting, the flow uneven. One person giving more than they receive is depleting the relationship. Name the imbalance honestly and address it before it becomes resentment.",
  },
  {
    id: "three-of-cups",
    name: "Three of Cups",
    arcana: "minor",
    suit: "cups",
    number: 3,
    sub: "Abundance · Mercury in Cancer",
    upright:
      "Abundance is Mercury in Cancer — the joy of community, the celebration of creative overflow. Three cups raised together. Your network, your tribe, your creative community is a resource. This card calls you to engage it: share a success, ask for help, celebrate someone else's win. Emotional abundance multiplies through expression, not hoarding.",
    reversed:
      "Reversed, Abundance decays into excess — celebrating past the point of meaning, using social warmth to avoid depth or commitment. The party has run long. Return to the solitary work that the community exists to support.",
  },
  {
    id: "four-of-cups",
    name: "Four of Cups",
    arcana: "minor",
    suit: "cups",
    number: 4,
    sub: "Luxury · Moon in Cancer",
    upright:
      "Luxury is Moon in Cancer — water in its most stable form, but stability here has a shadow: the comfort of the familiar can deaden sensitivity to what is genuinely available. Three cups are established; a fourth appears offered from the unseen. Something new is being offered that blends too well with the background to be noticed. Practice radical noticing today: what has been there all along that you haven't named?",
    reversed:
      "Reversed, Luxury has become apathy — comfort as narcosis. The sweetness of the known has become the reason not to grow. Deliberately introduce a small friction into your routine. Comfort is not the enemy; unconscious comfort is.",
  },
  {
    id: "five-of-cups",
    name: "Five of Cups",
    arcana: "minor",
    suit: "cups",
    number: 5,
    sub: "Disappointment · Mars in Scorpio",
    upright:
      "Disappointment is Mars in Scorpio — the wound that cuts deep because it cut hope. The lotus cups close. Something expected did not materialize. This is one of the harder cards in the deck, and Crowley does not soften it. Allow the feeling fully rather than bypassing it. The disappointment carries information: about what you actually care about, about where your expectations outran reality. Both are worth knowing.",
    reversed:
      "Reversed, Disappointment has calcified into chronic low-grade depression — grief no longer fresh but worn as armor. The event is over; the mourning continues beyond its useful span. Choose one forward action, however small, as an act of recommitment to life.",
  },
  {
    id: "six-of-cups",
    name: "Six of Cups",
    arcana: "minor",
    suit: "cups",
    number: 6,
    sub: "Pleasure · Sun in Scorpio",
    upright:
      "Pleasure is Sun in Scorpio — the light breaking through deep water. Six cups radiate in perfect symmetry, Tiphareth in the emotional world. This is genuine, uncomplicated joy: the present moment experienced fully, without agenda. You are permitted to enjoy what is here. The practice of genuine appreciation — not gratitude-journaling as discipline but actual felt delight — is a spiritual practice as demanding as any other. Practice it today.",
    reversed:
      "Reversed, Pleasure is nostalgia weaponized — living in the memory of a past that prevents full engagement with the present. The good time you are remembering was made by your presence, not by the circumstances. Your presence is available right now.",
  },
  {
    id: "seven-of-cups",
    name: "Seven of Cups",
    arcana: "minor",
    suit: "cups",
    number: 7,
    sub: "Debauch · Venus in Scorpio",
    upright:
      "Debauch is Venus in Scorpio — beauty corrupted, desire without discrimination. The seven cups overflow but the lotuses have rotted. Crowley is unsparing: this is the card of overindulgence that destroys the very thing it was seeking. Identify the place where an appetite — for validation, for content, for sensation — has crossed from nourishment into numbing. One deliberate act of restraint today will recover more clarity than a week of discipline later.",
    reversed:
      "Reversed, Debauch signals that the pattern has been seen but not yet changed. Insight is present; will is lagging. The first step is not willpower but environment design. Remove the easiest path to the indulgence.",
  },
  {
    id: "eight-of-cups",
    name: "Eight of Cups",
    arcana: "minor",
    suit: "cups",
    number: 8,
    sub: "Indolence · Saturn in Pisces",
    upright:
      "Indolence is Saturn in Pisces — the dreams that calcify into procrastination. Eight cups are arranged but the energy is stagnant, beautiful but inert. This card is the gap between intention and action, between knowing and doing. The block is not circumstantial but emotional: a vague dread of engagement. Small, committed action is the cure. Not the full project — one email, one rep, one paragraph. Movement breaks the spell.",
    reversed:
      "Reversed, Indolence has become a kind of peace — the resigned acceptance of not-moving as a permanent state. There is grief here, possibly unexpressed. Before pushing on the action, acknowledge what has been given up. Grief moved makes space; grief suppressed fills it.",
  },
  {
    id: "nine-of-cups",
    name: "Nine of Cups",
    arcana: "minor",
    suit: "cups",
    number: 9,
    sub: "Happiness · Jupiter in Pisces",
    upright:
      "Happiness is Jupiter in Pisces — the expansive, oceanic contentment of wishes fulfilled. Nine cups arranged perfectly, overflowing. This is the card of genuine wellbeing. Notice, receive, and amplify what is actually going well right now. Not as a spiritual bypass of real problems but as a recognition that nourishment is genuinely available. The foundation you are building your next efforts upon is more solid than you are currently acknowledging.",
    reversed:
      "Reversed, Happiness becomes smug self-satisfaction — comfort mistaken for completion, contentment deployed as a reason not to grow. You are further from your full potential than the pleasant surface suggests. The invitation is not to abandon wellbeing but to grow it.",
  },
  {
    id: "ten-of-cups",
    name: "Ten of Cups",
    arcana: "minor",
    suit: "cups",
    number: 10,
    sub: "Satiety · Mars in Pisces",
    upright:
      "Satiety is Mars in Pisces — the strange melancholy of having had enough. The cups overflow but there is a bitterness to the fullness: the appetite has been satisfied and the drive it sustained has gone with it. This is a liminal card. Something has run its course in the emotional world. Rather than seeking more of what has reached its natural end, locate what new desire is beginning to stir. That is the Ace finding its way back.",
    reversed:
      "Reversed, Satiety is bitterness — the full cups experienced as too much rather than complete. Disillusionment is information about misaligned expectations, not about the inadequacy of life. Reset the frame: what would genuine fulfillment look like from here?",
  },
  {
    id: "princess-of-cups",
    name: "Princess of Cups",
    arcana: "minor",
    suit: "cups",
    number: "princess",
    sub: "Earth of Water",
    upright:
      "The Princess of Cups is Earth of Water — imagination fully embodied, the dreamer who makes dreams real. She carries the lotus and the shell; the unconscious speaks through her in forms of beauty. Let the intuitive, poetic, imagistic part of you have the floor today. Write the vision down. Sketch it. Speak it aloud to someone who will receive it with wonder rather than skepticism. The image precedes the plan.",
    reversed:
      "Reversed, her dreaminess becomes delusion — beauty used to avoid reality, the vivid inner world a substitute for the outer one. Test your intuitions against evidence. One reality check applied gently does not destroy magic; it grounds it.",
  },
  {
    id: "prince-of-cups",
    name: "Prince of Cups",
    arcana: "minor",
    suit: "cups",
    number: "prince",
    sub: "Air of Water",
    upright:
      "The Prince of Cups is Air of Water — the artist-magician, seductive, intelligent, emotionally brilliant. He navigates the depths with the poise of thought over feeling. His eagle-headed symbol speaks of the higher Scorpio: transformation chosen rather than suffered. Bring intellectual rigor to an emotional question. Analyze the feeling rather than being consumed by it. Understanding the current is not the same as damming the river.",
    reversed:
      "Reversed, the Prince of Cups becomes the manipulator — using emotional intelligence to control rather than connect. Examine whether your emotional acuity is in service of depth or of being seen as deep. Authenticity and performance look similar from the outside but feel very different.",
  },
  {
    id: "queen-of-cups",
    name: "Queen of Cups",
    arcana: "minor",
    suit: "cups",
    number: "queen",
    sub: "Water of Water",
    upright:
      "The Queen of Cups is Water of Water — pure receptivity, the still surface that reflects everything, the throne of unconscious wisdom. She knows without knowing how she knows. Trust what you are feeling beneath the feeling. There is something in the depths of your current situation that your analytical mind cannot access. Go quiet enough to hear it. The body carries information the brain hasn't filed yet.",
    reversed:
      "Reversed, her receptivity becomes over-porous — absorbing others' emotional states and mistaking them for her own. Boundary work: whose feelings are you currently carrying that are not yours to carry? Return them with compassion and reclaim your own baseline.",
  },
  {
    id: "knight-of-cups",
    name: "Knight of Cups",
    arcana: "minor",
    suit: "cups",
    number: "knight",
    sub: "Fire of Water",
    upright:
      "The Knight of Cups is Fire of Water — the poet on horseback, driven to expression by feeling. He is the force that produces art from emotional truth. This is the card of creative courage: making work that comes from the genuine interior, not from market calculation or approval-seeking. Make the thing that is actually alive for you right now, regardless of whether it fits your usual mode. The Knight follows the water wherever it flows.",
    reversed:
      "Reversed, Fire of Water becomes emotional grandiosity — suffering performed rather than felt, sensitivity used as identity rather than information. Ground the feeling in concrete creative or physical action. Emotions metabolized through the body become fuel; emotions narrated become theater.",
  },

  // ── SWORDS ──
  {
    id: "ace-of-swords",
    name: "Ace of Swords",
    arcana: "minor",
    suit: "swords",
    number: 1,
    sub: "Root of Air",
    upright:
      "The Ace of Swords is the Root of the Air element — the sword of double edge, the crown of light and darkness together. Crowley's Ace is one of the most powerful cards in the deck: the mind at full crystalline clarity, cutting through everything false. Use this energy to make a decision that has been sitting in ambiguity. The Ace of Swords does not hesitate. Name what is true, speak what is real, decide.",
    reversed:
      "Reversed, the Ace of Swords becomes cruelty without purpose — the mind as weapon rather than tool. Examine where your intellect is being applied in service of destruction rather than clarity. The sword is for cutting away illusion, not for cutting people.",
  },
  {
    id: "two-of-swords",
    name: "Two of Swords",
    arcana: "minor",
    suit: "swords",
    number: 2,
    sub: "Peace · Moon in Libra",
    upright:
      "Peace is Moon in Libra — a truce between two equally matched forces of mind. The two swords cross but don't yet cut; Chokhmah holds the tension without resolving it. This is deliberate, temporary stillness — the breath before the decision. The equilibrium here is not passive: it is the gathered state before precise action. Use the pause. Gather information. The peace will break when the time is right.",
    reversed:
      "Reversed, Peace becomes stalemate — the crossed swords frozen in permanent avoidance of decision. The temporary truce has become a way of life. Name the decision that has been sitting in 'I'll decide later' and set a date.",
  },
  {
    id: "three-of-swords",
    name: "Three of Swords",
    arcana: "minor",
    suit: "swords",
    number: 3,
    sub: "Sorrow · Saturn in Libra",
    upright:
      "Sorrow is Saturn in Libra — grief given its proper weight and acknowledged with full honesty. Three swords pierce the rose of beauty. This is not self-pity; this is the clear-eyed recognition that something is genuinely sad. Crowley does not prescribe spiritual bypass. Feel the sorrow cleanly, without story, without narrative. Grief felt fully moves through faster than grief managed. One honest cry beats ten sessions of intellectualizing.",
    reversed:
      "Reversed, Sorrow is grief weaponized — turned against the self as self-punishment or against others as guilt. The feeling is real; the story around it is distorted. Separate the emotion from the interpretation and address each on its own terms.",
  },
  {
    id: "four-of-swords",
    name: "Four of Swords",
    arcana: "minor",
    suit: "swords",
    number: 4,
    sub: "Truce · Jupiter in Libra",
    upright:
      "Truce is Jupiter in Libra — the generous pause, the strategic ceasefire. The four swords are at rest in perfect geometry; even the mind needs its Sabbath. This is the card of deliberate mental rest: not because you have finished but because rest is itself part of the work. Schedule a genuine Sabbath from the problem. Sleep. Walk. Let the unconscious process what the conscious mind has been chewing on. The insight will arrive in the space.",
    reversed:
      "Reversed, Truce shows the inability to rest — the mind grinding past its own exhaustion, strategy replacing sleep. Rest is not laziness; it is cognitive infrastructure. Sleep longer tonight. The problem will look different in the morning.",
  },
  {
    id: "five-of-swords",
    name: "Five of Swords",
    arcana: "minor",
    suit: "swords",
    number: 5,
    sub: "Defeat · Venus in Aquarius",
    upright:
      "Defeat is Venus in Aquarius — the failure of beauty, the idealized plan cut down by reality. Five swords scattered, the rose fully destroyed. Crowley does not pretend this is a good card, but DuQuette notes: the Thoth Defeat is different from total destruction. Something is lost; not everything. Name specifically what has been lost and what remains. Build from what remains. The inventory of what is still standing is the beginning of the next plan.",
    reversed:
      "Reversed, Defeat is denial — refusing to acknowledge that the original strategy has failed, doubling down on a losing position. The defeat already happened. The only question is how long you will continue to pay for a war that is over.",
  },
  {
    id: "six-of-swords",
    name: "Six of Swords",
    arcana: "minor",
    suit: "swords",
    number: 6,
    sub: "Science · Mercury in Aquarius",
    upright:
      "Science is Mercury in Aquarius — the mind at its most elegant, understanding as a form of beauty. Six swords converge to the central rose in perfect symmetry. Crowley calls this the Tiphareth of Air: the place where the intellect finds harmony rather than war. This is the card of the breakthrough: the insight that organizes chaos into comprehensible order. The problem you have been circling is yielding to the right angle of approach. Think systemically.",
    reversed:
      "Reversed, Science becomes cold rationalism — the right answer delivered without wisdom about context, intelligence deployed without heart. The solution is technically correct but practically useless because it doesn't account for the human dimension. Add warmth to the precision.",
  },
  {
    id: "seven-of-swords",
    name: "Seven of Swords",
    arcana: "minor",
    suit: "swords",
    number: 7,
    sub: "Futility · Moon in Aquarius",
    upright:
      "Futility is Moon in Aquarius — the intellect at its most unstable, brilliant ideas that undermine themselves. The seven swords fracture the central rose. Crowley writes of the intellectual who cannot commit to a single position, who sees too many angles and therefore moves in none. The brilliant analysis that prevents action is not intelligence — it is anxiety in a clever disguise. Make the decision with the information available.",
    reversed:
      "Reversed, Futility becomes deception — the brilliant mind consciously deployed to mislead. Examine where you are using your intelligence to construct a story that serves comfort over truth, for yourself or others. The lie you construct most elegantly is the one that will cost you most.",
  },
  {
    id: "eight-of-swords",
    name: "Eight of Swords",
    arcana: "minor",
    suit: "swords",
    number: 8,
    sub: "Interference · Jupiter in Gemini",
    upright:
      "Interference is Jupiter in Gemini — too much of a good thing in the realm of the mind. The expansive enthusiasm of Jupiter fractures the Gemini intellect into too many competing ideas. The swords cross each other in confusion. Scope creep, idea proliferation, the inability to choose a single path — this is the card. Do a ruthless prioritization: one main project, two supporting tasks, and let everything else wait. Constraint is creative freedom.",
    reversed:
      "Reversed, Interference is external obstruction — the bureaucracy, the other people, the systems conspiring to block progress. Not everything that blocks you is about you. Identify what is genuinely immovable and route around it with elegant efficiency.",
  },
  {
    id: "nine-of-swords",
    name: "Nine of Swords",
    arcana: "minor",
    suit: "swords",
    number: 9,
    sub: "Cruelty · Mars in Gemini",
    upright:
      "Cruelty is Mars in Gemini — the mind turned weapon against itself, the thought loops that wound. Nine swords drip poison. This is the 3am card: the catastrophizing, the shame spirals, the inner critic sharpened to a point. Crowley does not spare the reader: this is a real experience and it causes real harm. Name the most damaging lie your inner critic tells you. Then find one piece of specific evidence that contradicts it. Do this every time the loop starts.",
    reversed:
      "Reversed, Cruelty is the aftermath — the 3am storm passed, but residue still coating everything. The catastrophe didn't happen. You are still here. What the crisis revealed about your actual values and actual resilience is more valuable data than whatever triggered the spiral. Extract it.",
  },
  {
    id: "ten-of-swords",
    name: "Ten of Swords",
    arcana: "minor",
    suit: "swords",
    number: 10,
    sub: "Ruin · Sol in Gemini",
    upright:
      "Ruin is the Sun in Gemini — the intellect at its fullest expression of its own destructive potential. Ten swords in the heart of the rose. Crowley says this is the end of the mind's domination: everything the intellect built has reached its logical terminus. This card is about total surrender — not passive defeat but the active choice to release what the mind alone cannot save. What are you trying to think your way through that needs to be felt or surrendered instead?",
    reversed:
      "Reversed, Ruin is survived — the sword in the heart and still breathing. You are more durable than the devastation suggests. The fact of your continued presence is itself data: you have not been destroyed by what was supposed to destroy you. Build from that.",
  },
  {
    id: "princess-of-swords",
    name: "Princess of Swords",
    arcana: "minor",
    suit: "swords",
    number: "princess",
    sub: "Earth of Air",
    upright:
      "The Princess of Swords is Earth of Air — the embodied thinker, the one who acts on analysis with immediate precision. She stands in the swirling clouds, sword raised, utterly unafraid of the storm she is creating. Intellectual audacity is called for. Take the idea that everyone in the room is afraid to say and say it. The discomfort it causes is the discomfort of a map being updated.",
    reversed:
      "Reversed, her clarity becomes destruction — cutting with words carelessly, using precision to wound rather than illuminate. Accuracy without compassion is cruelty with better aim. Add the dimension of care before delivering the precise truth.",
  },
  {
    id: "prince-of-swords",
    name: "Prince of Swords",
    arcana: "minor",
    suit: "swords",
    number: "prince",
    sub: "Air of Air",
    upright:
      "The Prince of Swords is Air of Air — the purest intellect, the mind freed from every emotional and material consideration. He rides through the storm he is generating. DuQuette notes he is dangerously brilliant and nearly impossible to live with because he will not maintain any position longer than the argument requires. Bring this energy to a single intellectual problem: attack it from every angle, destroy every assumption, arrive at what is actually true.",
    reversed:
      "Reversed, Air of Air becomes the sophist — arguing for its own sake, the intellect cut loose from any commitment to truth or consequence. The brilliant analysis is serving something other than clarity. Ask: what is this argument protecting?",
  },
  {
    id: "queen-of-swords",
    name: "Queen of Swords",
    arcana: "minor",
    suit: "swords",
    number: "queen",
    sub: "Water of Air",
    upright:
      "The Queen of Swords is Water of Air — the intelligence of depth, the mind that cuts because it has felt the cut. She has lost something and the loss made her precise. Her sword is not cruel; it is surgical. This is the energy for delivering difficult truths with love: clear, compassionate, unsparing of illusion. The honest conversation you've been deferring is an act of care, not cruelty. Have it.",
    reversed:
      "Reversed, grief has made the Queen of Swords bitter — the sword that once cut illusion now slashes at people. The pain that sharpened her has turned into weaponized cynicism. Address the unprocessed grief directly rather than through the blade.",
  },
  {
    id: "knight-of-swords",
    name: "Knight of Swords",
    arcana: "minor",
    suit: "swords",
    number: "knight",
    sub: "Fire of Air",
    upright:
      "The Knight of Swords is Fire of Air — the most violent force in the Thoth deck, a tornado with a sword. He does not stop for terrain; he is the hurricane that clears. Where there is false structure, dead wood, or comfortable delusion in your environment, his energy is what is needed. Do the radical edit. Make the hard cut. The destruction is the point — space must be cleared before the new can emerge.",
    reversed:
      "Reversed, Fire of Air is uncontrolled devastation — the hurricane without any eye, no center of calm, just destruction. Remove yourself from the field before the collateral damage compounds. Force without aim is the most expensive force there is.",
  },

  // ── DISKS ──
  {
    id: "ace-of-disks",
    name: "Ace of Disks",
    arcana: "minor",
    suit: "disks",
    number: 1,
    sub: "Root of Earth",
    upright:
      "The Ace of Disks is the Root of Earth — the great gold disk, the seed of all material manifestation. Crowley's Ace of Disks bears the Unicursal Hexagram and the winged sphere: spirit fully anchored in matter. An opportunity for material manifestation is available right now. The idea needs a form, the vision needs a prototype, the intention needs a first physical action. Begin with the smallest possible material step.",
    reversed:
      "Reversed, the Ace of Disks is the material gift refused — the practical opportunity not taken because of fear, perfectionism, or spiritual bypassing of the physical. The divine works through matter. The seed returns to nothing if not planted.",
  },
  {
    id: "two-of-disks",
    name: "Two of Disks",
    arcana: "minor",
    suit: "disks",
    number: 2,
    sub: "Change · Jupiter in Capricorn",
    upright:
      "Change is Jupiter in Capricorn — the great serpent of time devouring its own tail, the yin-yang of material cycles. The two disks rotate in the figure-eight of infinite change. Nothing in the material world is fixed; everything oscillates. Rather than resisting the current shift in circumstances, learn to surf the rhythm. The person who masters the fluctuation while others resist it builds real advantage.",
    reversed:
      "Reversed, Change is disruption without rhythm — the cycle out of phase, too much of one swing. Identify whether you are currently over-extended or under-extended in your material affairs and make one corrective adjustment.",
  },
  {
    id: "three-of-disks",
    name: "Three of Disks",
    arcana: "minor",
    suit: "disks",
    number: 3,
    sub: "Works · Mars in Capricorn",
    upright:
      "Works is Mars in Capricorn — the builder at maximum productive capacity. The three wheels interlock like gears: every element of the project engaged, the machine running. This is the card of skilled collaboration in service of something real. Bring expertise, bring rigor, bring the willingness to do the actual work. The thing that will distinguish your current project is not the idea but the quality of the execution. Raise the standard.",
    reversed:
      "Reversed, Works shows effort without collaboration — trying to build everything alone, refusing to trust the expertise of others. The structure requires multiple loadbearing elements; let others carry their part.",
  },
  {
    id: "four-of-disks",
    name: "Four of Disks",
    arcana: "minor",
    suit: "disks",
    number: 4,
    sub: "Power · Sol in Capricorn",
    upright:
      "Power is the Sun in Capricorn — the material world at its most stable, the fortress of earned security. Four disks form an impenetrable square; Chesed holds what has been built. You have built something real and durable. Protect it. Not through hoarding but through stewardship: maintain the infrastructure, invest in the foundation, keep the systems in good repair. Power is sustainable when it is maintained.",
    reversed:
      "Reversed, Power has become miserliness — security as an end in itself rather than as a foundation for growth. The fortress has become a prison. Release some of what is held in reserve into circulation. Money, time, knowledge, attention — that which moves generates more of itself; that which hoards loses value.",
  },
  {
    id: "five-of-disks",
    name: "Five of Disks",
    arcana: "minor",
    suit: "disks",
    number: 5,
    sub: "Worry · Mercury in Taurus",
    upright:
      "Worry is Mercury in Taurus — the mind trapped in the body's fear, material anxiety amplified by the nervous system. Five disks in the geomantic figure of Pentacles: the geometry is almost right but something is off. Fear about material security is real but the mental amplification of that fear is not useful. Separate the actual practical problem from the story about the problem. Address the former with a plan; release the latter through physical movement.",
    reversed:
      "Reversed, Worry has solidified into paralysis — analysis so chronic it has prevented any action. One small financial or practical action today will do more than any amount of further planning. Do the one thing.",
  },
  {
    id: "six-of-disks",
    name: "Six of Disks",
    arcana: "minor",
    suit: "disks",
    number: 6,
    sub: "Success · Moon in Taurus",
    upright:
      "Success is Moon in Taurus — material wellbeing in its most beautiful expression, the harvest of good practice. Six disks in the hexagram of Tiphareth: beauty in the material world. This is genuine, earned success. Receive it fully. Share it generously. The generous disposition of earned resources — time, money, expertise, attention — is not charity but the natural behavior of a person who understands that abundance is a flow, not a container.",
    reversed:
      "Reversed, Success is being held too tightly — the worry that it will disappear preventing its full enjoyment or deployment. You cannot protect success by clinging; you protect it by continuing to do the work that produced it.",
  },
  {
    id: "seven-of-disks",
    name: "Seven of Disks",
    arcana: "minor",
    suit: "disks",
    number: 7,
    sub: "Failure · Saturn in Taurus",
    upright:
      "Failure is Saturn in Taurus — the patience required when material effort has stalled, the leaden weight of Saturn on the most stubborn earth sign. Seven disks arranged as a fallow field. The effort has been made; the results have not arrived. This card is about the hardest practice: continuing to work when there is no feedback. The investment is real even when it is invisible. Trust the process enough to continue for one more cycle.",
    reversed:
      "Reversed, Failure is the refusal to pivot — stubbornly maintaining a strategy that has clearly run its course, hoping that more of the same will eventually produce different results. Einstein's definition of insanity applies. Change the approach.",
  },
  {
    id: "eight-of-disks",
    name: "Eight of Disks",
    arcana: "minor",
    suit: "disks",
    number: 8,
    sub: "Prudence · Sun in Virgo",
    upright:
      "Prudence is the Sun in Virgo — the master craftsperson at work, skill expressed through meticulous attention to each detail. Eight disks flower from the central stem like fruit from a well-tended tree. The quality of attention you bring to the smallest unit of work is the quality of the final product. Stop rushing. This phase of the work rewards slowness and precision. Do one thing with full presence rather than three things with divided attention.",
    reversed:
      "Reversed, Prudence becomes obsessive perfectionism — the Virgo attention turned into paralysis by standard. Good work delivered is worth more than perfect work withheld. Ship the thing at 90% rather than hold it at 95% indefinitely.",
  },
  {
    id: "nine-of-disks",
    name: "Nine of Disks",
    arcana: "minor",
    suit: "disks",
    number: 9,
    sub: "Gain · Venus in Virgo",
    upright:
      "Gain is Venus in Virgo — the beauty of practical accumulation, material wellbeing through careful, loving attention to the real. The nine disks flower in perfect symmetry. Something you have been carefully tending is beginning to yield. The gain may not be large but it is real and it compounds. Reinvest it. The momentum of a compounding practice — financial, physical, creative — is the most powerful force available to you right now.",
    reversed:
      "Reversed, Gain becomes petty calculation — counting every resource, weighing every relationship by its material return. The Venus principle has been squeezed out by the Mercury of accounting. Add generosity back into the equation.",
  },
  {
    id: "ten-of-disks",
    name: "Ten of Disks",
    arcana: "minor",
    suit: "disks",
    number: 10,
    sub: "Wealth · Mercury in Virgo",
    upright:
      "Wealth is Mercury in Virgo — the accumulated wealth of a life well-organized, the Tree of Life in full material expression. Ten disks form the Sephiroth itself: the Great Work in its most earthly completion. This is inheritance — not just financial but cultural, spiritual, intellectual. The work of those who came before you is available. Claim it. Build on what exists rather than starting from scratch; standing on shoulders is not weakness but good architecture.",
    reversed:
      "Reversed, Wealth is legacy without purpose — an inheritance without a vision for its use, abundance that has become the goal rather than the resource. Define what the wealth (of any kind) is for. Resources organized around meaning grow; resources hoarded for security alone decay.",
  },
  {
    id: "princess-of-disks",
    name: "Princess of Disks",
    arcana: "minor",
    suit: "disks",
    number: "princess",
    sub: "Earth of Earth",
    upright:
      "The Princess of Disks is Earth of Earth — the most grounded figure in the Thoth deck, the bearer of the orb, pregnant with potential. She stands in the grove: the seed of all material manifestation. She is pure capacity, the raw potential of the physical world. Begin the most grounded, practical, unsexy part of the work: the infrastructure, the filing system, the health protocol, the foundation. Everything built above requires this below.",
    reversed:
      "Reversed, the Princess of Disks is too deeply buried — inertia masquerading as groundedness, solidity become stagnation. You are not too grounded; you are stuck. The difference is movement. Take one physical action that has been deferred for over a week.",
  },
  {
    id: "prince-of-disks",
    name: "Prince of Disks",
    arcana: "minor",
    suit: "disks",
    number: "prince",
    sub: "Air of Earth",
    upright:
      "The Prince of Disks is Air of Earth — the methodical executor, the person who applies systematic intelligence to material problems and actually builds things. His orb and scepter are tools of measured progress. He is not glamorous but he is formidable. This is the card for the long project, the unglamorous execution, the slow compound interest of daily practice. Show up today for the unglamorous task. This is where the real work is done.",
    reversed:
      "Reversed, the Prince of Disks is dull routine without purpose — going through the motions of productivity without real engagement. You are technically doing the work but not actually present for it. Locate the meaning in what you are doing today. If you cannot find any, that is important information.",
  },
  {
    id: "queen-of-disks",
    name: "Queen of Disks",
    arcana: "minor",
    suit: "disks",
    number: "queen",
    sub: "Water of Earth",
    upright:
      "The Queen of Disks is Water of Earth — the great nourisher, the mountain that flows, the practical mystic who tends both the soil and the spirit. She holds the orb of manifestation and the staff of authority. Her domain is the body and the home: the physical environment and the physical self. Tend to the basics with love. Sleep, food, environment, the body — these are not logistics but sacred practice. The physical container shapes everything that happens inside it.",
    reversed:
      "Reversed, the Queen of Disks is neglecting the body or the home while attending to everything else. You cannot sustain high performance from an under-maintained physical base. Address the most neglected physical dimension of your life today.",
  },
  {
    id: "knight-of-disks",
    name: "Knight of Disks",
    arcana: "minor",
    suit: "disks",
    number: "knight",
    sub: "Fire of Earth",
    upright:
      "The Knight of Disks is Fire of Earth — the most patient and persistent force in the Thoth deck. He does not gallop; his horse is barely moving, but the plow is going deep. He holds the wheat and the disk. This is the card of long-game mastery: the person who does not flash, who shows up every day, who makes incremental progress and watches it compound over years. You already know what the long game is. Stay in it.",
    reversed:
      "Reversed, the Knight of Disks has become inert — the patient persistence tipped into stubborn refusal to change. The long game you've been playing may have run its natural course. Distinguish between patient persistence and attached stubbornness. One serves the goal; the other serves the identity.",
  },
];

// ─── Build lookup map ────────────────────────────────────────────────────────
const CARD_MAP = {};
CARDS.forEach((c) => {
  CARD_MAP[c.id] = c;
});

// ─── Canvas Texture Generator ────────────────────────────────────────────────
function generateCardTexture(card) {
  const W = 420,
    H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background gradient
  const suits = {
    wands: "#1a0a00",
    cups: "#000a1a",
    swords: "#050008",
    disks: "#000a05",
  };
  const bg =
    card.arcana === "major"
      ? ctx.createLinearGradient(0, 0, W, H)
      : ctx.createLinearGradient(0, 0, W, H);

  if (card.arcana === "major") {
    bg.addColorStop(0, "#0d0018");
    bg.addColorStop(0.5, "#120020");
    bg.addColorStop(1, "#08000f");
  } else {
    const suitBg = suits[card.suit] || "#0a0a0a";
    bg.addColorStop(0, suitBg);
    bg.addColorStop(1, "#050505");
  }
  // Rounded rect clip
  const r = 32;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.arcTo(W, 0, W, r, r);
  ctx.lineTo(W, H - r);
  ctx.arcTo(W, H, W - r, H, r);
  ctx.lineTo(r, H);
  ctx.arcTo(0, H, 0, H - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Outer gold border (rounded)
  ctx.strokeStyle = "rgba(200,160,80,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const b = 8;
  ctx.moveTo(r + b, b);
  ctx.lineTo(W - r - b, b);
  ctx.arcTo(W - b, b, W - b, r + b, r - b);
  ctx.lineTo(W - b, H - r - b);
  ctx.arcTo(W - b, H - b, W - r - b, H - b, r - b);
  ctx.lineTo(r + b, H - b);
  ctx.arcTo(b, H - b, b, H - r - b, r - b);
  ctx.lineTo(b, r + b);
  ctx.arcTo(b, b, r + b, b, r - b);
  ctx.closePath();
  ctx.stroke();

  // Inner border
  ctx.strokeStyle = "rgba(200,160,80,0.3)";
  ctx.lineWidth = 1;
  const b2 = 18;
  ctx.beginPath();
  ctx.moveTo(r + b2, b2);
  ctx.lineTo(W - r - b2, b2);
  ctx.arcTo(W - b2, b2, W - b2, r + b2, r - b2);
  ctx.lineTo(W - b2, H - r - b2);
  ctx.arcTo(W - b2, H - b2, W - r - b2, H - b2, r - b2);
  ctx.lineTo(r + b2, H - b2);
  ctx.arcTo(b2, H - b2, b2, H - r - b2, r - b2);
  ctx.lineTo(b2, r + b2);
  ctx.arcTo(b2, b2, r + b2, b2, r - b2);
  ctx.closePath();
  ctx.stroke();

  // Corner ornaments
  const corners = [
    [30, 30],
    [W - 30, 30],
    [30, H - 30],
    [W - 30, H - 30],
  ];
  corners.forEach(([x, y]) => {
    ctx.fillStyle = "rgba(200,160,80,0.8)";
    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✦", x, y);
  });

  // Central sigil / glyph area
  const suitSymbols = {
    wands: "🔥",
    cups: "🌊",
    swords: "⚔",
    disks: "☯",
  };
  const majorRomans = [
    "0",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
    "XVII",
    "XVIII",
    "XIX",
    "XX",
    "XXI",
  ];

  // Central symbol
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (card.arcana === "major") {
    ctx.font = "bold 80px Georgia, serif";
    ctx.fillStyle = "rgba(200,160,80,0.12)";
    ctx.fillText(majorRomans[card.number], W / 2, H / 2);
    ctx.fillStyle = "rgba(200,160,80,0.85)";
    ctx.font = "bold 56px Georgia, serif";
    ctx.fillText(majorRomans[card.number], W / 2, H / 2);
  } else {
    // Suit symbol
    const numStr =
      typeof card.number === "number"
        ? card.number.toString()
        : card.number;
    ctx.font = "80px serif";
    ctx.fillStyle = "rgba(200,160,80,0.15)";
    ctx.fillText(numStr, W / 2, H / 2);
    ctx.fillStyle = "rgba(200,160,80,0.85)";
    ctx.font = "bold 52px Georgia, serif";
    ctx.fillText(numStr.toUpperCase(), W / 2, H / 2);
  }

  // Top label: arcana / suit
  const topLabel =
    card.arcana === "major" ? "MAJOR ARCANA" : card.suit.toUpperCase();
  ctx.font = '300 11px "Nunito Sans", sans-serif';
  ctx.fillStyle = "rgba(200,160,80,0.55)";
  ctx.letterSpacing = "0.2em";
  ctx.fillText(topLabel, W / 2, 50);

  // Card name — multi-line if needed
  ctx.fillStyle = "rgba(235,215,175,0.95)";
  ctx.font = '300 28px "Nunito Sans", sans-serif';
  const name = card.name;
  const words = name.split(" ");

  if (words.length <= 2 || name.length <= 16) {
    ctx.fillText(name, W / 2, H - 100);
  } else {
    // Two lines
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(" ");
    const line2 = words.slice(mid).join(" ");
    ctx.fillText(line1, W / 2, H - 115);
    ctx.fillText(line2, W / 2, H - 82);
  }

  // Sub-label
  if (card.sub) {
    ctx.font = '300 11px "Nunito Sans", sans-serif';
    ctx.fillStyle = "rgba(200,160,80,0.5)";
    ctx.fillText(card.sub, W / 2, H - 50);
  }

  // Horizontal decorative lines
  ctx.strokeStyle = "rgba(200,160,80,0.25)";
  ctx.lineWidth = 0.75;
  [65, H - 65].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(W - 40, y);
    ctx.stroke();
  });

  return canvas;
}

function generateBackTexture() {
  const W = 420,
    H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Dark bg
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d000f");
  bg.addColorStop(0.5, "#06000a");
  bg.addColorStop(1, "#0a0008");
  // Rounded clip
  const r2 = 32;
  ctx.beginPath();
  ctx.moveTo(r2, 0);
  ctx.lineTo(W - r2, 0);
  ctx.arcTo(W, 0, W, r2, r2);
  ctx.lineTo(W, H - r2);
  ctx.arcTo(W, H, W - r2, H, r2);
  ctx.lineTo(r2, H);
  ctx.arcTo(0, H, 0, H - r2, r2);
  ctx.lineTo(0, r2);
  ctx.arcTo(0, 0, r2, 0, r2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Gold border
  ctx.strokeStyle = "rgba(180,140,70,0.7)";
  ctx.lineWidth = 4;
  const bb = 8;
  ctx.beginPath();
  ctx.moveTo(r2 + bb, bb);
  ctx.lineTo(W - r2 - bb, bb);
  ctx.arcTo(W - bb, bb, W - bb, r2 + bb, r2 - bb);
  ctx.lineTo(W - bb, H - r2 - bb);
  ctx.arcTo(W - bb, H - bb, W - r2 - bb, H - bb, r2 - bb);
  ctx.lineTo(r2 + bb, H - bb);
  ctx.arcTo(bb, H - bb, bb, H - r2 - bb, r2 - bb);
  ctx.lineTo(bb, r2 + bb);
  ctx.arcTo(bb, bb, r2 + bb, bb, r2 - bb);
  ctx.closePath();
  ctx.stroke();

  // Pattern of small ✦ symbols
  ctx.fillStyle = "rgba(180,140,70,0.15)";
  ctx.font = "14px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = 50; y < H - 30; y += 40) {
    for (let x = 35; x < W - 20; x += 40) {
      const offset = (Math.floor(y / 40) % 2) * 20;
      ctx.fillText("✦", x + offset, y);
    }
  }

  // Center sigil
  ctx.fillStyle = "rgba(180,140,70,0.45)";
  ctx.font = "80px Georgia, serif";
  ctx.fillText("☽", W / 2 - 30, H / 2);
  ctx.fillText("☉", W / 2 + 30, H / 2);

  // Center text
  ctx.fillStyle = "rgba(180,140,70,0.6)";
  ctx.font = '300 14px "Nunito Sans", sans-serif';
  ctx.fillText("✦ THOTH ORACLE ✦", W / 2, H / 2 + 55);

  return canvas;
}

// ─── Three.js Scene ──────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0a0a0f");
scene.fog = new THREE.FogExp2("#0a0a0f", 0.035);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 4.5, 11);
camera.lookAt(0, 1.2, 0); // slight upward bias — altar lower third, galaxy above

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI / 2.1;
controls.target.set(0, 1.2, 0);

// ─ Lighting ─
// (intensities compensate for physically-correct point-light decay in
// modern three — matches the original's intended brightness, where the
// altar and cards read clearly against the night)
const ambient = new THREE.AmbientLight("#1a1030", 3.0);
scene.add(ambient);

const keyLight = new THREE.PointLight("#c8a0ff", 60, 30);
keyLight.position.set(0, 8, 0);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.PointLight("#4040a0", 24, 20);
fillLight.position.set(-5, 3, 5);
scene.add(fillLight);

// ─ Altar Plane ─
const altarGeo = new THREE.BoxGeometry(8, 0.12, 5);
const altarMat = new THREE.MeshStandardMaterial({
  color: "#0e0820",
  metalness: 0.4,
  roughness: 0.6,
});
const altar = new THREE.Mesh(altarGeo, altarMat);
altar.position.y = -0.8;
altar.receiveShadow = true;
altar.renderOrder = 0;
scene.add(altar);

// Altar glow edge
const edgeGeo = new THREE.BoxGeometry(8.05, 0.13, 5.05);
const edgeMat = new THREE.MeshBasicMaterial({
  color: "#3a1a6a",
  transparent: true,
  opacity: 0.3,
});
const edge = new THREE.Mesh(edgeGeo, edgeMat);
edge.position.y = -0.8;
scene.add(edge);

// ─ Galactic Starfield ─
let galaxyGroup = null;
function buildGalaxy(densityMult) {
  if (galaxyGroup) {
    galaxyGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    scene.remove(galaxyGroup);
  }
  galaxyGroup = new THREE.Group();
  scene.add(galaxyGroup);

  // Color palette: mostly white/blue-white, few warm gold
  function starColor() {
    const r = Math.random();
    if (r < 0.7) return new THREE.Color(0xe8eeff); // white/blue-white
    if (r < 0.9) return new THREE.Color(0xc0d0ff); // cool blue
    return new THREE.Color(0xffd890); // warm gold
  }

  // ── Spiral arms (2000 stars at 1×) ──
  const spiralCount = Math.round(2000 * densityMult);
  const sPos = new Float32Array(spiralCount * 3);
  const sCol = new Float32Array(spiralCount * 3);
  for (let i = 0; i < spiralCount; i++) {
    const arm = Math.floor(Math.random() * 3);
    const t = Math.random();
    const angle = arm * ((Math.PI * 2) / 3) + t * Math.PI * 4;
    const radius = 20 + t * 180 + (Math.random() - 0.5) * 30;
    const spread = (1 - t) * 8 + 2;
    sPos[i * 3] =
      Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
    sPos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.3 + 8;
    sPos[i * 3 + 2] =
      Math.sin(angle) * radius + (Math.random() - 0.5) * spread;
    const c = starColor();
    sCol[i * 3] = c.r;
    sCol[i * 3 + 1] = c.g;
    sCol[i * 3 + 2] = c.b;
  }
  const spiralGeo = new THREE.BufferGeometry();
  spiralGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  spiralGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
  const spiralMat = new THREE.PointsMaterial({
    size: 0.55, // large enough to survive size attenuation at gallery scale
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    fog: false, // stars are sky — scene fog would erase them entirely
  });
  galaxyGroup.add(new THREE.Points(spiralGeo, spiralMat));

  // ── Halo stars (random sphere, outer depth) ──
  const haloCount = Math.round(600 * densityMult);
  const hPos = new Float32Array(haloCount * 3);
  const hCol = new Float32Array(haloCount * 3);
  for (let i = 0; i < haloCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 130 + Math.random() * 80;
    hPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    hPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.4 + 8;
    hPos[i * 3 + 2] = r * Math.cos(phi);
    const c = starColor();
    hCol[i * 3] = c.r;
    hCol[i * 3 + 1] = c.g;
    hCol[i * 3 + 2] = c.b;
  }
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(hPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(hCol, 3));
  const haloMat = new THREE.PointsMaterial({
    size: 0.75, // halo stars sit 130–210 units out; needs size to read
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    sizeAttenuation: true,
    fog: false,
  });
  galaxyGroup.add(new THREE.Points(haloGeo, haloMat));

  // ── Nebula glow sphere (large, back-side, semi-transparent) ──
  const nebulaGeo = new THREE.SphereGeometry(170, 24, 24);
  const nebulaMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x0d0525),
    transparent: true,
    opacity: 0.22,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
  nebula.position.y = 8;
  galaxyGroup.add(nebula);

}
buildGalaxy(1);

// ─ Texture cache ─
const texCache = {};

// Card image IDs that have real photos downloaded to cards/
const REAL_CARD_IMAGES = new Set([
  // Major Arcana
  "00-the-fool",
  "01-the-magus",
  "02-the-priestess",
  "03-the-empress",
  "04-the-emperor",
  "05-the-hierophant",
  "06-the-lovers",
  "07-the-chariot",
  "08-adjustment",
  "09-the-hermit",
  "10-fortune",
  "11-lust",
  "12-the-hanged-man",
  "13-death",
  "14-art",
  "15-the-devil",
  "16-the-tower",
  "17-the-star",
  "18-the-moon",
  "19-the-sun",
  "20-the-aeon",
  "21-the-universe",
  // Wands
  "ace-of-wands",
  "two-of-wands",
  "three-of-wands",
  "four-of-wands",
  "five-of-wands",
  "six-of-wands",
  "seven-of-wands",
  "eight-of-wands",
  "nine-of-wands",
  "ten-of-wands",
  "princess-of-wands",
  "prince-of-wands",
  "queen-of-wands",
  "knight-of-wands",
  // Cups
  "ace-of-cups",
  "two-of-cups",
  "three-of-cups",
  "four-of-cups",
  "five-of-cups",
  "six-of-cups",
  "seven-of-cups",
  "eight-of-cups",
  "nine-of-cups",
  "ten-of-cups",
  "princess-of-cups",
  "prince-of-cups",
  "queen-of-cups",
  "knight-of-cups",
  // Swords
  "ace-of-swords",
  "two-of-swords",
  "three-of-swords",
  "four-of-swords",
  "five-of-swords",
  "six-of-swords",
  "seven-of-swords",
  "eight-of-swords",
  "nine-of-swords",
  "ten-of-swords",
  "princess-of-swords",
  "prince-of-swords",
  "queen-of-swords",
  "knight-of-swords",
  // Disks
  "ace-of-disks",
  "two-of-disks",
  "three-of-disks",
  "four-of-disks",
  "five-of-disks",
  "six-of-disks",
  "seven-of-disks",
  "eight-of-disks",
  "nine-of-disks",
  "ten-of-disks",
  "princess-of-disks",
  "prince-of-disks",
  "queen-of-disks",
  "knight-of-disks",
]);

function getCardTexture(card, onLoad) {
  if (!texCache[card.id]) {
    if (REAL_CARD_IMAGES.has(card.id)) {
      const loader = new THREE.TextureLoader();
      const fallback = new THREE.CanvasTexture(generateCardTexture(card));
      texCache[card.id] = fallback;
      loader.load(
        `cards/${card.id}.jpg`,
        (tex) => {
          texCache[card.id] = tex;
          if (onLoad) onLoad(tex);
        },
        undefined,
        () => {
          /* keep fallback */
        },
      );
    } else {
      texCache[card.id] = new THREE.CanvasTexture(
        generateCardTexture(card),
      );
    }
  }
  return texCache[card.id];
}
let backTexture;
function getBackTexture() {
  if (!backTexture) {
    backTexture = new THREE.CanvasTexture(generateBackTexture());
  }
  return backTexture;
}
// Pre-cache back
getBackTexture();

// ─ Card Mesh ─
const CARD_W = 1.4,
  CARD_H = 2.4;
let cardMesh = null;
let isAnimating = false;

function createCardMesh(card) {
  const front = new THREE.MeshBasicMaterial({ color: 0x888888 }); // grey until texture loads
  const back = new THREE.MeshBasicMaterial({ map: getBackTexture() });

  // Get canvas fallback immediately, swap in real image when loaded
  const initialTex = new THREE.CanvasTexture(generateCardTexture(card));
  front.map = initialTex;
  front.needsUpdate = true;

  // Also kick off real image load
  if (REAL_CARD_IMAGES.has(card.id)) {
    const loader = new THREE.TextureLoader();
    loader.load(`cards/${card.id}.jpg`, (tex) => {
      front.map = tex;
      front.needsUpdate = true;
    });
  }

  const group = new THREE.Group();

  front.polygonOffset = true;
  front.polygonOffsetFactor = -1;
  front.polygonOffsetUnits = -1;
  back.polygonOffset = true;
  back.polygonOffsetFactor = -1;
  back.polygonOffsetUnits = -1;

  const frontMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W, CARD_H),
    front,
  );
  frontMesh.position.z = 0.009;
  frontMesh.renderOrder = 2;
  group.add(frontMesh);

  const backMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W, CARD_H),
    back,
  );
  backMesh.rotation.y = Math.PI;
  backMesh.position.z = -0.009;
  backMesh.renderOrder = 2;
  group.add(backMesh);

  const edgeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CARD_W + 0.01, CARD_H + 0.01, 0.016),
    new THREE.MeshBasicMaterial({ color: "#3a1a6a" }),
  );
  edgeMesh.renderOrder = 1;
  group.add(edgeMesh);

  return group;
}

// ─ Animation state ─
let animState = null;

function drawCard() {
  if (isAnimating) return;

  // dear allison, coders often hide little easter eggs in their code
  // to speak of fate, to speak of play
  // to speak of charm, to speak of magic
  // this spark is so obviously a flourish made for you
  const FIRST_DRAW_KEY = "thoth_first_draw_done";
  let card;
  const firstDrawDone =
    typeof localStorage !== "undefined" &&
    localStorage.getItem(FIRST_DRAW_KEY);
  if (!firstDrawDone) {
    card =
      CARDS.find((c) => c.id === "two-of-cups") ||
      CARDS[Math.floor(Math.random() * CARDS.length)];
    try {
      localStorage.setItem(FIRST_DRAW_KEY, "1");
    } catch (e) {
      /* ignore storage errors */
    }
  } else {
    // Pick random card
    card = CARDS[Math.floor(Math.random() * CARDS.length)];
  }
  const isReversed = false;

  // Remove old card
  if (cardMesh) {
    scene.remove(cardMesh);
    cardMesh = null;
  }
  // Hide panel
  document.getElementById("reading-panel").classList.remove("visible");

  // Create new card mesh
  cardMesh = createCardMesh(card);
  cardMesh.castShadow = true;
  cardMesh.traverse((obj) => {
    if (obj.isMesh) obj.renderOrder = 1;
  });

  // Start off-screen
  cardMesh.position.set(-14, 6, 0);
  cardMesh.rotation.y = Math.PI; // Show back first
  cardMesh.rotation.z = 0.3;
  scene.add(cardMesh);

  isAnimating = true;
  document.getElementById("draw-btn").classList.add("animating");

  const startTime = performance.now();
  const DURATION = 1400;
  const FLIP_START = 0.55;
  const FLIP_END = 0.8;

  const targetY = altar.position.y + 0.06 + 0.02; // sits just above altar top surface
  const targetX = 0;
  const targetZ = 0;
  const finalRotY = 0;

  animState = {
    card,
    isReversed,
    startTime,
    DURATION,
    FLIP_START,
    FLIP_END,
    targetX,
    targetY,
    targetZ,
    finalRotY,
    startX: -14,
    startY: 6,
    startZ: -2,
    done: false,
  };
}

// ─ Render loop ─
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  const t = performance.now();

  controls.update();

  // Subtle key light pulse
  keyLight.intensity = 54 + Math.sin(elapsed * 0.8) * 9;

  // Galaxy slow rotation
  if (galaxyGroup) galaxyGroup.rotation.y += 0.00005;

  // Card animation
  if (animState && !animState.done) {
    const {
      startTime,
      DURATION,
      FLIP_START,
      FLIP_END,
      startX,
      startY,
      startZ,
      targetX,
      targetY,
      targetZ,
      finalRotY,
      isReversed,
    } = animState;
    const p = Math.min((t - startTime) / DURATION, 1.0);
    const ease = easeOutExpo(p);

    // Phase 1 (0→FLIP_END): card flies in upright, flips to reveal front
    // Phase 2 (FLIP_END→1): card lays flat onto altar
    const layFlatStart = FLIP_END;
    const layP =
      p < layFlatStart ? 0 : (p - layFlatStart) / (1 - layFlatStart);
    const layEase = easeInOutCubic(Math.min(layP, 1));

    // Position
    cardMesh.position.x = startX + (targetX - startX) * ease;
    cardMesh.position.z = startZ + (targetZ - startZ) * ease;
    // Dynamic Y: prevent card clipping through altar during lay-flat
    const altarTopY = altar.position.y + 0.06;
    const rotXNow = (-Math.PI / 2) * layEase;
    const dynamicY =
      altarTopY + 0.025 + Math.abs(Math.cos(rotXNow)) * (CARD_H / 2);
    cardMesh.position.y =
      p < layFlatStart ? startY + (dynamicY - startY) * ease : dynamicY;

    // Keep upright during flip, lay flat after
    cardMesh.rotation.x = (-Math.PI / 2) * layEase;

    // Z tilt during flight, settle to reversed angle after
    cardMesh.rotation.z = 0.3 * (1 - ease);

    // Y flip: back→front during FLIP_START→FLIP_END
    if (p >= FLIP_START && p <= FLIP_END) {
      const fp = (p - FLIP_START) / (FLIP_END - FLIP_START);
      const fe = easeInOutCubic(fp);
      cardMesh.rotation.y = Math.PI * (1 - fe) + finalRotY * fe;
    } else if (p < FLIP_START) {
      cardMesh.rotation.y = Math.PI;
    } else {
      cardMesh.rotation.y = finalRotY;
    }

    if (p >= 1.0) {
      animState.done = true;
      isAnimating = false;
      document.getElementById("draw-btn").classList.remove("animating");
      showPanel(animState.card, animState.isReversed);
    }
  }

  // Idle card float
  if (cardMesh && animState && animState.done) {
    cardMesh.position.y =
      animState.targetY + Math.sin(elapsed * 1.1) * 0.015;
    cardMesh.rotation.x = -Math.PI / 2;
  }

  renderer.render(scene, camera);
}
animate();

// ─ Easing ─
function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// ─ Panel ─
function showPanel(card, isReversed) {
  document.getElementById("panel-name").textContent = card.name;
  document.getElementById("panel-orientation").textContent = "";
  document.getElementById("panel-subtitle").textContent = card.sub || "";
  const textEl = document.getElementById("panel-text");
  textEl.textContent = card.upright;
  textEl.className = "interpretation";

  setTimeout(() => {
    document.getElementById("reading-panel").classList.add("visible");
  }, 300);
}

// ─ Events ─
document.getElementById("draw-btn").addEventListener("click", drawCard);

document.getElementById("reset-btn").addEventListener("click", () => {
  if (cardMesh) {
    scene.remove(cardMesh);
    cardMesh = null;
  }
  animState = null;
  isAnimating = false;
  document.getElementById("draw-btn").classList.remove("animating");
  document.getElementById("reading-panel").classList.remove("visible");
});

document.getElementById("rotate-btn").addEventListener("click", (e) => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 0.6;
  e.currentTarget.classList.toggle("active", controls.autoRotate);
});

// ─ the-standard params ─
const params = {};
const paramsEl = document.getElementById("params");

Standard.param(paramsEl, params, {
  id: "fog", label: "fog density",
  min: 0, max: 0.1, step: 0.002, value: 0.035,
  fmt: (v) => v.toFixed(3),
  apply: (v) => { scene.fog.density = v; },
});

Standard.param(paramsEl, params, {
  id: "galaxy", label: "galaxy density",
  min: 0.25, max: 3, step: 0.25, value: 1,
  fmt: (v) => v.toFixed(2) + "×",
  apply: (v) => buildGalaxy(v),
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
