import ActiveEffect5e from "../../active-effect.js";
import ActorArmorConfig from "../../apps/actor-armor.js";
import ActorSheetFlags from "../../apps/actor-flags.js";
import ActorTypeConfig from "../../apps/actor-type.js";
import ActorHitDiceConfig from "../../apps/hit-dice-config.js";
import ActorMovementConfig from "../../apps/movement-config.js";
import ProficiencySelector from "../../apps/proficiency-selector.js";
import PropertyAttribution from "../../apps/property-attribution.js";
import ActorSensesConfig from "../../apps/senses-config.js";
import TraitSelector from "../../apps/trait-selector.js";
import { TRPG } from "../../config.js";
import Item5e from "../../item/entity.js";
import Actor5e from "../entity.js";

/**
 * Extend the basic ActorSheet class to suppose system-specific logic and functionality.
 * This sheet is an Abstract layer which is not used.
 * @extends {ActorSheet}
 */
export default class ActorSheet5e extends ActorSheet {
	constructor(...args) {
		super(...args);

		/**
		 * Track the set of item filters which are applied
		 * @type {Set}
		 */
		this._filters = {
			inventory: new Set(),
			spellbook: new Set(),
			features: new Set(),
			effects: new Set(),
		};
	}

	/* -------------------------------------------- */

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			scrollY: [".inventory .inventory-list", ".features .inventory-list", ".spellbook .inventory-list", ".effects .inventory-list"],
			tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description" }],
		});
	}

	/* -------------------------------------------- */

	/**
	 * A set of item types that should be prevented from being dropped on this type of actor sheet.
	 * @type {Set<string>}
	 */
	static unsupportedItemTypes = new Set();

	/* -------------------------------------------- */

	/** @override */
	get template() {
		if (!game.user.isGM && this.actor.limited) return "systems/trpg/templates/actors/limited-sheet.html";
		return `systems/trpg/templates/actors/${this.actor.type}-sheet.html`;
	}

	/* -------------------------------------------- */

	/** @override */
	async getData(options) {
		// Basic data
		let isOwner = this.actor.isOwner;
		const rollData = this.actor.getRollData.bind(this.actor);
		const data = {
			owner: isOwner,
			limited: this.actor.limited,
			options: this.options,
			editable: this.isEditable,
			cssClass: isOwner ? "editable" : "locked",
			isCharacter: this.actor.type === "character",
			isNPC: this.actor.type === "npc",
			isVehicle: this.actor.type === "vehicle",
			config: CONFIG.TRPG,
			rollData: this.actor.getRollData.bind(this.actor),
		};
		const labels = (data.labels = this.actor.labels || {});

		// The Actor's data
		const source = this.actor.toObject();
		const actorData = this.actor.toObject(false);
		data.actor = actorData;
		data.system = actorData.system;

		// Owned Items
		data.items = actorData.items;
		for (let i of data.items) {
			const item = this.actor.items.get(i._id);
			i.labels = item.labels;
		}
		data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));

		// Labels and filters
		data.filters = this._filters;

		// Currency Labels
		labels.currencies = Object.entries(CONFIG.TRPG.currencies).reduce((obj, [k, c]) => {
			obj[k] = c.label;
			return obj;
		}, {});

		// Ability Scores
		for (let [a, abl] of Object.entries(actorData.system.abilities)) {
			abl.icon = this._getProficiencyIcon(abl.proficient);
			abl.hover = CONFIG.TRPG.proficiencyLevels[abl.proficient];
			abl.label = CONFIG.TRPG.abilities[a];
			abl.baseProf = source.system.abilities[a].proficient;
		}

		// Saving Throws
		for (let [a, save] of Object.entries(actorData.system.saves)) {
			save.icon = this._getProficiencyIcon(save.proficient);
			save.hover = CONFIG.TRPG.proficiencyLevels[save.proficient];
			save.label = CONFIG.TRPG.abilities[a];
			save.baseProf = source.system.saves[a].proficient;
		}

		// Skills
		if (actorData.system.skills) {
			for (let [s, skl] of Object.entries(actorData.system.skills)) {
				skl.ability = CONFIG.TRPG.abilityAbbreviations[skl.ability];
				skl.icon = this._getProficiencyIcon(skl.value);
				skl.hover = CONFIG.TRPG.proficiencyLevels[skl.value];
				skl.label = CONFIG.TRPG.skills[s];
				skl.baseValue = source.system.skills[s].value;
			}
		}

		// Movement speeds
		data.movement = this._getMovementSpeed(actorData);

		// Senses
		data.senses = this._getSenses(actorData);

		// Update traits
		this._prepareTraits(actorData.system.traits);

		// Prepare owned items
		this._prepareItems(data);

		// Prepare active effects
		data.effects = ActiveEffect5e.prepareActiveEffectCategories(this.actor.effects);

		// Biography HTML enrichment
		data.biographyHTML = await TextEditor.enrichHTML(data.system.details.biography.value, {
			secrets: this.actor.isOwner,
			rollData,
			async: true,
		});

		// Prepare warnings
		data.warnings = this.actor._preparationWarnings;

		// Return data to the sheet
		return data;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare the display of movement speed data for the Actor*
	 * @param {object} actorData                The Actor data being prepared.
	 * @param {boolean} [largestPrimary=false]  Show the largest movement speed as "primary", otherwise show "walk"
	 * @returns {{primary: string, special: string}}
	 * @private
	 */
	_getMovementSpeed(actorData, largestPrimary = false) {
		const movement = actorData.system.attributes.movement || {};

		// Prepare an array of available movement speeds
		let speeds = [
			[movement.burrow, `${game.i18n.localize("TRPG.MovementBurrow")} ${movement.burrow}`],
			[movement.climb, `${game.i18n.localize("TRPG.MovementClimb")} ${movement.climb}`],
			[movement.fly, `${game.i18n.localize("TRPG.MovementFly")} ${movement.fly}` + (movement.hover ? ` (${game.i18n.localize("TRPG.MovementHover")})` : "")],
			[movement.swim, `${game.i18n.localize("TRPG.MovementSwim")} ${movement.swim}`],
		];
		if (largestPrimary) {
			speeds.push([movement.walk, `${game.i18n.localize("TRPG.MovementWalk")} ${movement.walk}`]);
		}

		// Filter and sort speeds on their values
		speeds = speeds.filter((s) => !!s[0]).sort((a, b) => b[0] - a[0]);

		// Case 1: Largest as primary
		if (largestPrimary) {
			let primary = speeds.shift();
			return {
				primary: `${primary ? primary[1] : "0"} ${movement.units}`,
				special: speeds.map((s) => s[1]).join(", "),
			};
		}

		// Case 2: Walk as primary
		else {
			return {
				primary: `${movement.walk || 0} ${movement.units}`,
				special: speeds.length ? speeds.map((s) => s[1]).join(", ") : "",
			};
		}
	}

	/* -------------------------------------------- */

	_getSenses(actorData) {
		const senses = actorData.system.attributes.senses || {};
		const tags = {};
		for (let [k, label] of Object.entries(CONFIG.TRPG.senses)) {
			const v = senses[k] ?? 0;
			if (v === 0) continue;
			tags[k] = `${game.i18n.localize(label)} ${v} ${senses.units}`;
		}
		if (!!senses.special) tags["special"] = senses.special;
		return tags;
	}

	/* --------------------------------------------- */

	/**
	 * Break down all of the Active Effects affecting a given target property.
	 * @param {string} target  The data property being targeted.
	 * @return {AttributionDescription[]}
	 * @protected
	 */
	_prepareActiveEffectAttributions(target) {
		return this.actor.effects.reduce((arr, e) => {
			let source = e.sourceName;
			if (e.data.origin === this.actor.uuid) source = e.data.label;
			if (!source) return arr;
			const value = e.data.changes.reduce((n, change) => {
				if (change.key !== target || !Number.isNumeric(change.value)) return n;
				if (change.mode !== CONST.ACTIVE_EFFECT_MODES.ADD) return n;
				return n + Number(change.value);
			}, 0);
			if (!value) return arr;
			arr.push({ value, label: source, mode: CONST.ACTIVE_EFFECT_MODES.ADD });
			return arr;
		}, []);
	}

	/* -------------------------------------------- */

	/**
	 * Produce a list of armor class attribution objects.
	 * @param {object} data                Actor data to determine the attributions from.
	 * @return {AttributionDescription[]}  List of attribution descriptions.
	 */
	_prepareArmorClassAttribution(data) {
		const ac = data.attributes.ac;
		const cfg = CONFIG.TRPG.armorClasses[ac.calc];
		const attribution = [];

		// Base AC Attribution
		switch (ac.calc) {
			// Flat AC
			case "flat":
				return [
					{
						label: game.i18n.localize("TRPG.ArmorClassFlat"),
						mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
						value: ac.flat,
					},
				];

			// Natural armor
			case "natural":
				attribution.push({
					label: game.i18n.localize("TRPG.ArmorClassNatural"),
					mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
					value: ac.flat,
				});
				break;

			// Equipment-based AC
			case "default":
				const halfLevel = Math.floor(this.actor.system.details.level / 2);
				if (halfLevel) {
					attribution.push({
						label: game.i18n.localize("TRPG.ArmorClassHalfLevel"),
						mode: CONST.ACTIVE_EFFECT_MODES.ADD,
						value: halfLevel,
					});
				}
				const hasArmor = !!this.actor.armor;
				attribution.push({
					label: hasArmor ? this.actor.armor.name : game.i18n.localize("TRPG.ArmorClassUnarmored"),
					mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
					value: hasArmor ? this.actor.system.armor.value : 10,
				});
				if (ac.dex !== 0) {
					attribution.push({
						label: game.i18n.localize("TRPG.AbilityDex"),
						mode: CONST.ACTIVE_EFFECT_MODES.ADD,
						value: ac.dex,
					});
				}
				break;

			// Other AC formula
			default:
				const formula = ac.calc === "custom" ? ac.formula : cfg.formula;
				let base = ac.base;
				const dataRgx = new RegExp(/@([a-z.0-9_\-]+)/gi);
				for (const [match, term] of formula.matchAll(dataRgx)) {
					const value = foundry.utils.getProperty(data, term);
					if (term === "attributes.ac.base" || value === 0) continue;
					if (Number.isNumeric(value)) base -= Number(value);
					attribution.push({
						label: match,
						mode: CONST.ACTIVE_EFFECT_MODES.ADD,
						value: foundry.utils.getProperty(data, term),
					});
				}
				attribution.unshift({
					label: game.i18n.localize("TRPG.PropertyBase"),
					mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
					value: base,
				});
				break;
		}

		// Shield
		if (ac.shield !== 0)
			attribution.push({
				label: this.actor.shield?.name ?? game.i18n.localize("TRPG.EquipmentShield"),
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: ac.shield,
			});

		// Bonus
		if (ac.bonus !== 0) attribution.push(...this._prepareActiveEffectAttributions("data.attributes.ac.bonus"));

		// Cover
		if (ac.cover !== 0)
			attribution.push({
				label: game.i18n.localize("TRPG.Cover"),
				mode: CONST.ACTIVE_EFFECT_MODES.ADD,
				value: ac.cover,
			});
		return attribution;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare the data structure for traits data like languages, resistances & vulnerabilities, and proficiencies
	 * @param {object} traits   The raw traits data object from the actor data
	 * @private
	 */
	_prepareTraits(traits) {
		const map = {
			dr: CONFIG.TRPG.damageResistanceTypes,
			di: CONFIG.TRPG.damageResistanceTypes,
			dv: CONFIG.TRPG.damageResistanceTypes,
			ci: CONFIG.TRPG.conditionTypes,
			languages: CONFIG.TRPG.languages, //,
			// "armorProf": CONFIG.TRPG.armorProficiencies,
			// "weaponProf": CONFIG.TRPG.weaponProficiencies,
			// "toolProf": CONFIG.TRPG.toolProficiencies
		};
		for (let [t, choices] of Object.entries(map)) {
			const trait = traits[t];
			if (!trait) continue;
			let values = [];
			if (trait.value) {
				values = trait.value instanceof Array ? trait.value : [trait.value];
			}
			trait.selected = values.reduce((obj, t) => {
				obj[t] = choices[t];
				return obj;
			}, {});

			// Add custom entry
			if (trait.custom) {
				trait.custom.split(";").forEach((c, i) => (trait.selected[`custom${i + 1}`] = c.trim()));
			}
			trait.cssClass = !isEmpty(trait.selected) ? "" : "inactive";
		}

		// Populate and localize proficiencies
		for (const t of ["armor", "weapon", "tool"]) {
			const trait = traits[`${t}Prof`];
			if (!trait) continue;
			Actor5e.prepareProficiencies(trait, t);
			trait.cssClass = !isEmpty(trait.selected) ? "" : "inactive";
		}
	}

	/* -------------------------------------------- */

	/**
	 * Insert a spell into the spellbook object when rendering the character sheet
	 * @param {Object} data     The Actor data being prepared
	 * @param {Array} spells    The spell data being prepared
	 * @private
	 */
	_prepareSpellbook(data, spells) {
		const owner = this.actor.isOwner;
		const levels = data.system.spells;
		const spellbook = {};

		// Define some mappings
		const sections = {
			atwill: -20,
			innate: -10,
		};

		// Label spell slot uses headers
		const useLabels = {
			"-20": "-",
			"-10": "-",
			0: "&infin;",
		};

		// Format a spellbook entry for a certain indexed level
		const registerSection = (sl, i, label, { prepMode = "prepared", value, max, override } = {}) => {
			spellbook[i] = {
				order: i,
				label: label,
				usesSlots: i > 0,
				canCreate: owner,
				canPrepare: data.actor.type === "character" && i >= 1,
				spells: [],
				uses: useLabels[i] || value || 0,
				slots: useLabels[i] || max || 0,
				override: override || 0,
				dataset: { type: "spell", level: prepMode in sections ? 1 : i, "preparation.mode": prepMode },
				prop: sl,
			};
		};

		// Determine the maximum spell level which has a slot
		const maxLevel = Array.fromRange(10).reduce((max, i) => {
			if (i === 0) return max;
			const level = levels[`spell${i}`];
			if ((level.max || level.override) && i > max) max = i;
			return max;
		}, 0);

		// Level-based spellcasters have cantrips and leveled slots
		if (maxLevel > 0) {
			registerSection("spell0", 0, CONFIG.TRPG.spellLevels[0]);
			for (let lvl = 1; lvl <= maxLevel; lvl++) {
				const sl = `spell${lvl}`;
				registerSection(sl, lvl, CONFIG.TRPG.spellLevels[lvl], levels[sl]);
			}
		}

		// Iterate over every spell item, adding spells to the spellbook by section
		spells.forEach((spell) => {
			const mode = spell.data.preparation.mode || "prepared";
			let s = spell.data.level || 0;
			const sl = `spell${s}`;

			// Specialized spellcasting modes (if they exist)
			if (mode in sections) {
				s = sections[mode];
				if (!spellbook[s]) {
					const l = levels[mode] || {};
					const config = CONFIG.TRPG.spellPreparationModes[mode];
					registerSection(mode, s, config, {
						prepMode: mode,
						value: l.value,
						max: l.max,
						override: l.override,
					});
				}
			}

			// Sections for higher-level spells which the caster "should not" have, but spell items exist for
			else if (!spellbook[s]) {
				registerSection(sl, s, CONFIG.TRPG.spellLevels[s], { levels: levels[sl] });
			}

			// Add the spell to the relevant heading
			spellbook[s].spells.push(spell);
		});

		// Sort the spellbook by section level
		const sorted = Object.values(spellbook);
		sorted.sort((a, b) => a.order - b.order);
		return sorted;
	}

	/* -------------------------------------------- */

	/**
	 * Determine whether an Owned Item will be shown based on the current set of filters
	 * @return {boolean}
	 * @private
	 */
	_filterItems(items, filters) {
		return items.filter((item) => {
			const data = item.system;

			// Action usage
			for (let f of ["full", "action", "bonus", "reaction"]) {
				if (filters.has(f)) {
					if (data.activation && data.activation.type !== f) return false;
				}
			}

			// Spell-specific filters
			if (filters.has("ritual")) {
				if (data.components.ritual !== true) return false;
			}
			if (filters.has("concentration")) {
				if (data.components.concentration !== true) return false;
			}
			if (filters.has("prepared")) {
				if (data.level === 0 || ["innate", "always"].includes(data.preparation.mode)) return true;
				if (this.actor.type === "npc") return true;
				return data.preparation.prepared;
			}

			// Equipment-specific filters
			if (filters.has("equipped")) {
				if (data.equipped !== true) return false;
			}
			return true;
		});
	}

	/* -------------------------------------------- */

	/**
	 * Get the font-awesome icon used to display a certain level of skill proficiency
	 * @private
	 */
	_getProficiencyIcon(level) {
		const icons = {
			0: '<i class="far fa-circle"></i>',
			0.5: '<i class="fas fa-adjust"></i>',
			1: '<i class="fas fa-check"></i>',
			2: '<i class="fas fa-check-double"></i>',
		};
		return icons[level] || icons[0];
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers
  /* -------------------------------------------- */

	/** @inheritdoc */
	activateListeners(html) {
		// Activate Item Filters
		const filterLists = html.find(".filter-list");
		filterLists.each(this._initializeFilterItemList.bind(this));
		filterLists.on("click", ".filter-item", this._onToggleFilter.bind(this));

		// Item summaries
		html.find(".item .item-name.rollable h4").click((event) => this._onItemSummary(event));

		// View Item Sheets
		html.find(".item-edit").click(this._onItemEdit.bind(this));

		// Property attributions
		html.find(".attributable").mouseover(this._onPropertyAttribution.bind(this));

		// Editable Only Listeners
		if (this.isEditable) {
			// Input focus and update
			const inputs = html.find("input");
			inputs.focus((ev) => ev.currentTarget.select());
			inputs.addBack().find('[data-dtype="Number"]').change(this._onChangeInputDelta.bind(this));

			// Saving Throw Proficiency
			html.find(".save-proficiency").click(this._onToggleSaveProficiency.bind(this));

			// Toggle Skill Proficiency
			html.find(".skill-proficiency").on("click contextmenu", this._onCycleSkillProficiency.bind(this));

			// Trait Selector
			html.find(".proficiency-selector").click(this._onProficiencySelector.bind(this));
			html.find(".trait-selector").click(this._onTraitSelector.bind(this));

			// Configure Special Flags
			html.find(".config-button").click(this._onConfigMenu.bind(this));

			// Owned Item management
			html.find(".item-create").click(this._onItemCreate.bind(this));
			html.find(".item-delete").click(this._onItemDelete.bind(this));
			html.find(".item-uses input")
				.click((ev) => ev.target.select())
				.change(this._onUsesChange.bind(this));
			html.find(".slot-max-override").click(this._onSpellSlotOverride.bind(this));

			// Active Effect management
			html.find(".effect-control").click((ev) => ActiveEffect5e.onManageActiveEffect(ev, this.actor));
		}

		// Owner Only Listeners
		if (this.actor.isOwner) {
			// Ability Checks
			html.find(".ability-name").click(this._onRollAbilityTest.bind(this));

			//Saving Throw
			html.find(".save-name").click(this._onRollSaveTest.bind(this));

			// Roll Skill Checks
			html.find(".skill-name").click(this._onRollSkillCheck.bind(this));

			// Item Rolling
			html.find(".item .item-image").click((event) => this._onItemRoll(event));
			html.find(".item .item-recharge").click((event) => this._onItemRecharge(event));
		}

		// Otherwise remove rollable classes
		else {
			html.find(".rollable").each((i, el) => el.classList.remove("rollable"));
		}

		// Handle default listeners last so system listeners are triggered first
		super.activateListeners(html);
	}

	/* -------------------------------------------- */

	/**
	 * Initialize Item list filters by activating the set of filters which are currently applied
	 * @private
	 */
	_initializeFilterItemList(i, ul) {
		const set = this._filters[ul.dataset.filter];
		const filters = ul.querySelectorAll(".filter-item");
		for (let li of filters) {
			if (set.has(li.dataset.filter)) li.classList.add("active");
		}
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers                */
	/* -------------------------------------------- */

	/**
	 * Handle input changes to numeric form fields, allowing them to accept delta-typed inputs
	 * @param event
	 * @private
	 */
	_onChangeInputDelta(event) {
		const input = event.target;
		const value = input.value;
		if (["+", "-"].includes(value[0])) {
			let delta = parseFloat(value);
			input.value = getProperty(this.actor.data, input.name) + delta;
		} else if (value[0] === "=") {
			input.value = value.slice(1);
		}
	}

	/* -------------------------------------------- */

	/**
	 * Handle spawning the TraitSelector application which allows a checkbox of multiple trait options
	 * @param {Event} event   The click event which originated the selection
	 * @private
	 */
	_onConfigMenu(event) {
		event.preventDefault();
		const button = event.currentTarget;
		let app;
		switch (button.dataset.action) {
			case "armor":
				app = new ActorArmorConfig(this.object);
				break;
			case "hit-dice":
				app = new ActorHitDiceConfig(this.object);
				break;
			case "movement":
				app = new ActorMovementConfig(this.object);
				break;
			case "flags":
				app = new ActorSheetFlags(this.object);
				break;
			case "senses":
				app = new ActorSensesConfig(this.object);
				break;
			case "type":
				app = new ActorTypeConfig(this.object);
				break;
		}
		app?.render(true);
	}

	/* -------------------------------------------- */

	/**
	 * Handle cycling proficiency in a Skill
	 * @param {Event} event   A click or contextmenu event which triggered the handler
	 * @private
	 */
	_onCycleSkillProficiency(event) {
		event.preventDefault();
		const field = event.currentTarget.previousElementSibling;
		const skillName = field.parentElement.dataset.skill;
		const source = this.actor._source.system.skills[skillName];
		if (!source) return;

		// Cycle to the next or previous skill level
		const levels = [0, 1];
		let idx = levels.indexOf(source.value);
		const next = idx ? 0 : 1;
		field.value = levels[next];

		// Update the field value and save the form
		return this._onSubmit(event);
	}

	/* -------------------------------------------- */

	/** @override */
	async _onDropActor(event, data) {
		const canPolymorph = game.user.isGM || (this.actor.isOwner && game.settings.get("trpg", "allowPolymorphing"));
		if (!canPolymorph) return false;

		// Get the target actor
		let sourceActor = null;
		if (data.pack) {
			const pack = game.packs.find((p) => p.collection === data.pack);
			sourceActor = await pack.getEntity(data.id);
		} else {
			sourceActor = game.actors.get(data.id);
		}
		if (!sourceActor) return;

		// Define a function to record polymorph settings for future use
		const rememberOptions = (html) => {
			const options = {};
			html.find("input").each((i, el) => {
				options[el.name] = el.checked;
			});
			const settings = mergeObject(game.settings.get("trpg", "polymorphSettings") || {}, options);
			game.settings.set("trpg", "polymorphSettings", settings);
			return settings;
		};

		// Create and render the Dialog
		return new Dialog(
			{
				title: game.i18n.localize("TRPG.PolymorphPromptTitle"),
				content: {
					options: game.settings.get("trpg", "polymorphSettings"),
					i18n: TRPG.polymorphSettings,
					isToken: this.actor.isToken,
				},
				default: "accept",
				buttons: {
					accept: {
						icon: '<i class="fas fa-check"></i>',
						label: game.i18n.localize("TRPG.PolymorphAcceptSettings"),
						callback: (html) => this.actor.transformInto(sourceActor, rememberOptions(html)),
					},
					wildshape: {
						icon: '<i class="fas fa-paw"></i>',
						label: game.i18n.localize("TRPG.PolymorphWildShape"),
						callback: (html) =>
							this.actor.transformInto(sourceActor, {
								keepBio: true,
								keepClass: true,
								keepMental: true,
								mergeSaves: true,
								mergeSkills: true,
								transformTokens: rememberOptions(html).transformTokens,
							}),
					},
					polymorph: {
						icon: '<i class="fas fa-pastafarianism"></i>',
						label: game.i18n.localize("TRPG.Polymorph"),
						callback: (html) =>
							this.actor.transformInto(sourceActor, {
								transformTokens: rememberOptions(html).transformTokens,
							}),
					},
					cancel: {
						icon: '<i class="fas fa-times"></i>',
						label: game.i18n.localize("Cancel"),
					},
				},
			},
			{
				classes: ["dialog", "dnd5e"],
				width: 600,
				template: "systems/trpg/templates/apps/polymorph-prompt.html",
			}
		).render(true);
	}

	/* -------------------------------------------- */

	/** @override */
	async _onDropItemCreate(itemData) {
		// Check to make sure items of this type are allowed on this actor
		if (this.constructor.unsupportedItemTypes.has(itemData.type)) {
			return ui.notifications.warn(
				game.i18n.format("TRPG.ActorWarningInvalidItem", {
					itemType: game.i18n.localize(CONFIG.Item.typeLabels[itemData.type]),
					actorType: game.i18n.localize(CONFIG.Actor.typeLabels[this.actor.type]),
				})
			);
		}

		// Create a Consumable spell scroll on the Inventory tab
		if (itemData.type === "spell" && this._tabs[0].active === "inventory") {
			const scroll = await Item5e.createScrollFromSpell(itemData);
			itemData = scroll.data;
		}

		if (itemData.data) {
			// Ignore certain statuses
			["equipped", "proficient", "prepared"].forEach((k) => delete itemData.data[k]);

			// Downgrade ATTUNED to REQUIRED
			itemData.data.attunement = Math.min(itemData.data.attunement, CONFIG.TRPG.attunementTypes.REQUIRED);
		}

		// Stack identical consumables
		if (itemData.type === "consumable" && itemData.flags.core?.sourceId) {
			const similarItem = this.actor.items.find((i) => {
				const sourceId = i.getFlag("core", "sourceId");
				return sourceId && sourceId === itemData.flags.core?.sourceId && i.type === "consumable" && i.name === itemData.name;
			});
			if (similarItem) {
				return similarItem.update({
					"data.quantity": similarItem.system.quantity + Math.max(itemData.data.quantity, 1),
				});
			}
		}

		// Create the owned item as normal
		return super._onDropItemCreate(itemData);
	}

	/* -------------------------------------------- */

	/**
	 * Handle enabling editing for a spell slot override value
	 * @param {MouseEvent} event    The originating click event
	 * @private
	 */
	async _onSpellSlotOverride(event) {
		const span = event.currentTarget.parentElement;
		const level = span.dataset.level;
		const override = this.actor.system.spells[level].override || span.dataset.slots;
		const input = document.createElement("INPUT");
		input.type = "text";
		input.name = `data.spells.${level}.override`;
		input.value = override;
		input.placeholder = span.dataset.slots;
		input.dataset.dtype = "Number";

		// Replace the HTML
		const parent = span.parentElement;
		parent.removeChild(span);
		parent.appendChild(input);
	}

	/* -------------------------------------------- */

	/**
	 * Change the uses amount of an Owned Item within the Actor
	 * @param {Event} event   The triggering click event
	 * @private
	 */
	async _onUsesChange(event) {
		event.preventDefault();
		const itemId = event.currentTarget.closest(".item").dataset.itemId;
		const item = this.actor.items.get(itemId);
		const uses = Math.clamped(0, parseInt(event.target.value), item.system.uses.max);
		event.target.value = uses;
		return item.update({ "data.uses.value": uses });
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
	 * @private
	 */
	_onItemRoll(event) {
		event.preventDefault();
		const itemId = event.currentTarget.closest(".item").dataset.itemId;
		const item = this.actor.items.get(itemId);
		return item.roll();
	}

	/* -------------------------------------------- */

	/**
	 * Handle attempting to recharge an item usage by rolling a recharge check
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onItemRecharge(event) {
		event.preventDefault();
		const itemId = event.currentTarget.closest(".item").dataset.itemId;
		const item = this.actor.items.get(itemId);
		return item.rollRecharge();
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling of an item from the Actor sheet, obtaining the Item instance and dispatching to it's roll method
	 * @private
	 */
	_onItemSummary(event) {
		event.preventDefault();
		let li = $(event.currentTarget).parents(".item"),
			item = this.actor.items.get(li.data("item-id")),
			chatData = item.getChatData({ secrets: this.actor.isOwner });

		// Toggle summary
		if (li.hasClass("expanded")) {
			let summary = li.children(".item-summary");
			summary.slideUp(200, () => summary.remove());
		} else {
			let div = $(`<div class="item-summary">${chatData.description.value}</div>`);
			let props = $(`<div class="item-properties"></div>`);
			chatData.properties.forEach((p) => props.append(`<span class="tag">${p}</span>`));
			div.append(props);
			li.append(div.hide());
			div.slideDown(200);
		}
		li.toggleClass("expanded");
	}

	/* -------------------------------------------- */

	/**
	 * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onItemCreate(event) {
		event.preventDefault();
		const header = event.currentTarget;
		const type = header.dataset.type;
		const itemData = {
			name: game.i18n.format("TRPG.ItemNew", { type: game.i18n.localize("ITEM.Type" + header.dataset.type.capitalize()) }),
			type: type,
			data: foundry.utils.deepClone(header.dataset),
		};
		delete itemData.data["type"];
		return this.actor.createEmbeddedDocuments("Item", [itemData]);
	}

	/* -------------------------------------------- */

	/**
	 * Handle editing an existing Owned Item for the Actor
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onItemEdit(event) {
		event.preventDefault();
		const li = event.currentTarget.closest(".item");
		const item = this.actor.items.get(li.dataset.itemId);
		return item.sheet.render(true);
	}

	/* -------------------------------------------- */

	/**
	 * Handle deleting an existing Owned Item for the Actor
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onItemDelete(event) {
		event.preventDefault();
		const li = event.currentTarget.closest(".item");
		const item = this.actor.items.get(li.dataset.itemId);
		if (item) return item.delete();
	}

	/* -------------------------------------------- */

	/**
	 * Handle displaying the property attribution tooltip when a property is hovered over.
	 * @param {Event} event   The originating mouse event.
	 * @private
	 */
	async _onPropertyAttribution(event) {
		const existingTooltip = event.currentTarget.querySelector("div.tooltip");
		const property = event.currentTarget.dataset.property;
		if (existingTooltip || !property) return;
		const data = this.actor.system;
		let attributions;
		switch (property) {
			case "attributes.ac":
				attributions = this._prepareArmorClassAttribution(data);
				break;
		}
		if (!attributions) return;
		const html = await new PropertyAttribution(this.actor, attributions, property).renderTooltip();
		event.currentTarget.insertAdjacentElement("beforeend", html[0]);
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling an Ability check, either a test or a saving throw
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onRollAbilityTest(event) {
		event.preventDefault();
		let ability = event.currentTarget.parentElement.dataset.ability;
		return this.actor.rollAbility(ability, { event: event });
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling an Ability check, either a test or a saving throw
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onRollSaveTest(event) {
		event.preventDefault();
		let save = event.currentTarget.parentElement.dataset.save;
		return this.actor.rollAbilitySave(save, { event: event });
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling a Skill check
	 * @param {Event} event   The originating click event
	 * @private
	 */
	_onRollSkillCheck(event) {
		event.preventDefault();
		const skill = event.currentTarget.parentElement.dataset.skill;
		return this.actor.rollSkill(skill, { event: event });
	}

	/* -------------------------------------------- */

	/**
	 * Handle toggling Saving Throw proficiency level
	 * @param {Event} event     The originating click event
	 * @private
	 */
	_onToggleSaveProficiency(event) {
		event.preventDefault();
		const field = event.currentTarget.previousElementSibling;
		return this.actor.update({ [field.name]: 1 - parseInt(field.value) });
	}

	/* -------------------------------------------- */

	/**
	 * Handle toggling of filters to display a different set of owned items
	 * @param {Event} event     The click event which triggered the toggle
	 * @private
	 */
	_onToggleFilter(event) {
		event.preventDefault();
		const li = event.currentTarget;
		const set = this._filters[li.parentElement.dataset.filter];
		const filter = li.dataset.filter;
		if (set.has(filter)) set.delete(filter);
		else set.add(filter);
		return this.render();
	}

	/* -------------------------------------------- */

	/**
	 * Handle spawning the ProficiencySelector application to configure armor, weapon, and tool proficiencies.
	 * @param {Event} event  The click event which originated the selection
	 * @private
	 */
	_onProficiencySelector(event) {
		event.preventDefault();
		const a = event.currentTarget;
		const label = a.parentElement.querySelector("label");
		const options = { name: a.dataset.target, title: label.innerText, type: a.dataset.type };
		if (options.type === "tool") options.sortCategories = true;
		return new ProficiencySelector(this.actor, options).render(true);
	}

	/* -------------------------------------------- */

	/**
	 * Handle spawning the TraitSelector application which allows a checkbox of multiple trait options
	 * @param {Event} event   The click event which originated the selection
	 * @private
	 */
	_onTraitSelector(event) {
		event.preventDefault();
		const a = event.currentTarget;
		const label = a.parentElement.querySelector("label");
		const choices = CONFIG.TRPG[a.dataset.options];
		const options = { name: a.dataset.target, title: label.innerText, choices };
		return new TraitSelector(this.actor, options).render(true);
	}

	/* -------------------------------------------- */

	/** @override */
	_getHeaderButtons() {
		let buttons = super._getHeaderButtons();
		if (this.actor.isPolymorphed) {
			buttons.unshift({
				label: "TRPG.PolymorphRestoreTransformation",
				class: "restore-transformation",
				icon: "fas fa-backward",
				onclick: () => this.actor.revertOriginalForm(),
			});
		}
		return buttons;
	}
}

export function injectActorSheet(app, html, data) {
	if (!game.settings.get("trpg", "customizeSkills")) return;
	html.find(".skills-list").addClass("skill-customize");

	const skillRowSelector = ".skills-list .skill";

	const actor = app.actor;

	html.find(skillRowSelector).each(function () {
		const skillElem = $(this);
		const skillKey = $(this).attr("data-skill");
		const bonusKey = `${skillKey}.skill-bonus`;
		const selectedAbility = actor.system.skills[skillKey].ability;

		let selectElement = $("<select>");
		selectElement.addClass("skill-ability-select");
		Object.keys(actor.system.abilities).forEach((ability) => {
			let abilityOption = $("<option>");
			let abilityKey = ability.charAt(0).toUpperCase() + ability.slice(1);
			let abilityString = game.i18n.localize(`TRPG.Ability${abilityKey}`).slice(0, 3);

			abilityOption.attr("value", ability);

			if (ability === selectedAbility) {
				abilityOption.attr("selected", "true");
			}

			abilityOption.text(abilityString);
			selectElement.append(abilityOption);
		});

		selectElement.change(function (event) {
			let newData = { data: { skills: {} } };
			newData.data.skills[skillKey] = { ability: event.target.value };
			actor.update(newData);
		});

		let textBoxElement = $('<input type="text" size=2>');
		textBoxElement.addClass("skill-cust-bonus");
		textBoxElement.val(actor.getFlag("trpg", bonusKey) || "-");

		textBoxElement.click(function () {
			$(this).select();
		});

		textBoxElement.change(async function (event) {
			const bonusValue = event.target.value;
			if (bonusValue === "-" || bonusValue === "0") {
				await actor.unsetFlag("trpg", bonusKey);
				textBoxElement.val("-");
			} else {
				try {
					const rollResult = await new Roll(`1d20 + ${bonusValue}`).roll({ async: false });
					const valid = !isNaN(rollResult._total);

					if (valid) {
						await actor.setFlag("trpg", bonusKey, bonusValue);
					} else {
						textBoxElement.val(actor.getFlag("trpg", bonusKey) || "-");
					}
				} catch (err) {
					textBoxElement.val(actor.getFlag("trpg", bonusKey) || "-");
				}
			}
		});

		skillElem.find(".skill-ability").after(selectElement);
		skillElem.find(".skill-ability").detach();
		selectElement.after(textBoxElement);
	});

	html.find(".attribute .skill").each(function () {
		const skillElem = $(this);
		const skillKey = $(this).attr("data-save");
		const bonusKey = `${skillKey}.skill-bonus`;
		const selectedAbility = actor.system.saves[skillKey].ability;

		let textBoxElement = $('<input type="text" size=2>');
		textBoxElement.addClass("skill-cust-bonus");
		textBoxElement.val(actor.getFlag("trpg", bonusKey) || "-");

		textBoxElement.click(function () {
			$(this).select();
		});

		textBoxElement.change(async function (event) {
			const bonusValue = event.target.value;
			if (bonusValue === "-" || bonusValue === "0") {
				await actor.unsetFlag("trpg", bonusKey);
				textBoxElement.val("-");
			} else {
				try {
					const rollResult = await new Roll(`1d20 + ${bonusValue}`).roll({ async: false });
					const valid = !isNaN(rollResult._total);

					if (valid) {
						await actor.setFlag("trpg", bonusKey, bonusValue);
					} else {
						textBoxElement.val(actor.getFlag("trpg", bonusKey) || "-");
					}
				} catch (err) {
					textBoxElement.val(actor.getFlag("trpg", bonusKey) || "-");
				}
			}
		});

		skillElem.find(".save-name").after(textBoxElement);
	});
}
