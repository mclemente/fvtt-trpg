import LongRestDialog from "../apps/long-rest.js";
import SelectItemsPrompt from "../apps/select-items-prompt.js";
import { TRPG } from "../config.js";
import { d20Roll, damageRoll } from "../dice.js";
import Item5e from "../item/entity.js";

/**
 * Extend the base Actor class to implement additional system-specific logic.
 * @extends {Actor}
 */
export default class Actor5e extends Actor {
	/**
	 * The data source for Actor5e.classes allowing it to be lazily computed.
	 * @type {Object<string, Item5e>}
	 * @private
	 */
	_classes = undefined;

	/* -------------------------------------------- */
	/*  Properties                                  */
	/* -------------------------------------------- */

	/**
	 * A mapping of classes belonging to this Actor.
	 * @type {Object<string, Item5e>}
	 */
	get classes() {
		if (this._classes !== undefined) return this._classes;
		if (!["character", "npc"].includes(this.type)) return (this._classes = {});
		return (this._classes = this.items
			.filter((item) => item.type === "class")
			.reduce((obj, cls) => {
				obj[cls.name.slugify({ strict: true })] = cls;
				return obj;
			}, {}));
	}

	/* -------------------------------------------- */
	/*  Methods                                     */
	/* -------------------------------------------- */

	/** @override */
	prepareData() {
		this._preparationWarnings = [];
		super.prepareData();

		const skills = this.system.skills;
		for (let key in skills) {
			let skill = skills[key];
			let bonus = this.getFlag("trpg", `${key}.skill-bonus`) || 0;
			let bonusAsInt = parseInt(Number(bonus));
			if (!isNaN(bonusAsInt)) {
				if (skill.pda && this.system.attributes.penalidadeArmadura) {
					bonusAsInt += this.system.attributes.penalidadeArmadura;
				}
				skill.total += bonusAsInt;
			}
		}

		const saves = this.system.saves;
		for (let key in saves) {
			let save = saves[key];
			let bonus = this.getFlag("trpg", `${key}.skill-bonus`) || 0;
			let bonusAsInt = parseInt(Number(bonus));
			if (!isNaN(bonusAsInt)) {
				save.save += bonusAsInt;
			}
		}

		// iterate over owned items and recompute attributes that depend on prepared actor data
		this.items.forEach((item) => item.prepareFinalAttributes());
	}

	/* -------------------------------------------- */

	/** @override */
	prepareBaseData() {
		this._prepareBaseArmorClass(this);
		switch (this.type) {
			case "character":
				return this._prepareCharacterData(this);
			case "npc":
				return this._prepareNPCData(this);
		}
	}

	/* --------------------------------------------- */

	/** @override */
	applyActiveEffects() {
		// The Active Effects do not have access to their parent at preparation time so we wait until this stage to
		// determine whether they are suppressed or not.
		this.effects.forEach((e) => e.determineSuppression());
		return super.applyActiveEffects();
	}

	/* -------------------------------------------- */

	/** @override */
	prepareDerivedData() {
		const actorData = this;
		const data = actorData.system;
		const flags = actorData.flags.trpg || {};
		const bonuses = foundry.utils.getProperty(data, "bonuses.abilities") || {};

		// Ability modifiers
		const dcBonus = Number.isNumeric(data.bonuses?.spell?.dc) ? parseInt(data.bonuses.spell.dc) : 0;
		const saveBonus = Number.isNumeric(bonuses.save) ? parseInt(bonuses.save) : 0;
		const checkBonus = Number.isNumeric(bonuses.check) ? parseInt(bonuses.check) : 0;
		for (let [id, abl] of Object.entries(data.abilities)) {
			abl.mod = Math.floor((abl.value - 10) / 2);
			abl.checkBonus = checkBonus;
			abl.dc = 10 + abl.mod + dcBonus;
		}

		// Saves
		for (let [id, abl] of Object.entries(data.saves)) {
			if (flags.diamondSoul) abl.proficient = 1; // Diamond Soul is proficient in all saves
			abl.mod = Math.floor((data.abilities[abl.ability].value - 10) / 2);
			abl.prof = abl.proficient ? 3 + data.details.level : Math.floor(data.details.level / 2);
			abl.saveBonus = saveBonus;
			abl.save = abl.mod + abl.prof + abl.saveBonus;
		}

		// Inventory encumbrance
		data.attributes.encumbrance = this._computeEncumbrance(actorData);

		// Prepare skills
		this._prepareSkills(actorData, bonuses, checkBonus);

		// Reset class store to ensure it is updated with any changes
		this._classes = undefined;

		// Cache labels
		this.labels = {};
		if (this.type === "npc") {
			this.labels["creatureType"] = this.constructor.formatCreatureType(data.details.type);
		}

		// Prepare spell-casting data
		this._computeSpellcastingProgression(this);

		// Prepare armor class data
		const ac = this._computeArmorClass(data);
		this.armor = ac.equippedArmor || null;
		this.shield = ac.equippedShield || null;
		if (ac.warnings) this._preparationWarnings.push(...ac.warnings);
	}

	/* -------------------------------------------- */

	/**
	 * Return the amount of experience required to gain a certain character level.
	 * @param level {Number}  The desired level
	 * @return {Number}       The XP required
	 */
	getLevelExp(level) {
		const levels = CONFIG.TRPG.CHARACTER_EXP_LEVELS;
		return levels[Math.min(level, levels.length - 1)];
	}

	/* -------------------------------------------- */

	/**
	 * Return the amount of experience granted by killing a creature of a certain CR.
	 * @param cr {Number}     The creature's challenge rating
	 * @return {Number}       The amount of experience granted per kill
	 */
	getCRExp(cr) {
		return cr * 300;
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	getRollData() {
		const data = super.getRollData();
		data.prof = this.system.attributes.prof || 0;
		data.classes = Object.entries(this.classes).reduce((obj, e) => {
			const [slug, cls] = e;
			obj[slug] = cls.system;
			return obj;
		}, {});
		return data;
	}

	/* -------------------------------------------- */

	/**
	 * Given a list of items to add to the Actor, optionally prompt the
	 * user for which they would like to add.
	 * @param {Array.<Item5e>} items - The items being added to the Actor.
	 * @param {boolean} [prompt=true] - Whether or not to prompt the user.
	 * @returns {Promise<Item5e[]>}
	 */
	async addEmbeddedItems(items, prompt = true) {
		let itemsToAdd = items;
		if (!items.length) return [];

		// Obtain the array of item creation data
		let toCreate = [];
		if (prompt) {
			const itemIdsToAdd = await SelectItemsPrompt.create(items, {
				hint: game.i18n.localize("TRPG.AddEmbeddedItemPromptHint"),
			});
			for (let item of items) {
				if (itemIdsToAdd.includes(item.id)) toCreate.push(item.toObject());
			}
		} else {
			toCreate = items.map((item) => item.toObject());
		}

		// Create the requested items
		if (itemsToAdd.length === 0) return [];
		return Item5e.createDocuments(toCreate, { parent: this });
	}

	/* -------------------------------------------- */

	/**
	 * Get a list of features to add to the Actor when a class item is updated.
	 * Optionally prompt the user for which they would like to add.
	 */
	async getClassFeatures({ className, subclassName, level } = {}) {
		const existing = new Set(this.items.map((i) => i.name));
		const features = await Actor5e.loadClassFeatures({ className, subclassName, level });
		return features.filter((f) => !existing.has(f.name)) || [];
	}

	/* -------------------------------------------- */

	/**
	 * Return the features which a character is awarded for each class level
	 * @param {string} className        The class name being added
	 * @param {string} subclassName     The subclass of the class being added, if any
	 * @param {number} level            The number of levels in the added class
	 * @param {number} priorLevel       The previous level of the added class
	 * @return {Promise<Item5e[]>}     Array of Item5e entities
	 */
	static async loadClassFeatures({ className = "", subclassName = "", level = 1, priorLevel = 0 } = {}) {
		className = className.toLowerCase();
		subclassName = subclassName.slugify();

		// Get the configuration of features which may be added
		const clsConfig = CONFIG.TRPG.classFeatures[className];
		if (!clsConfig) return [];

		// Acquire class features
		let ids = [];
		for (let [l, f] of Object.entries(clsConfig.features || {})) {
			l = parseInt(l);
			if (l <= level && l > priorLevel) ids = ids.concat(f);
		}

		// Acquire subclass features
		const subConfig = clsConfig.subclasses[subclassName] || {};
		for (let [l, f] of Object.entries(subConfig.features || {})) {
			l = parseInt(l);
			if (l <= level && l > priorLevel) ids = ids.concat(f);
		}

		// Load item data for all identified features
		const features = [];
		for (let id of ids) {
			features.push(await fromUuid(id));
		}

		// Class spells should always be prepared
		for (const feature of features) {
			if (feature.type === "spell") {
				const preparation = feature.system.preparation;
				preparation.mode = "always";
				preparation.prepared = true;
			}
		}
		return features;
	}

	/* -------------------------------------------- */
	/*  Data Preparation Helpers                    */
	/* -------------------------------------------- */

	/**
	 * Prepare Character type specific data
	 */
	_prepareCharacterData(actorData) {
		const data = actorData.system;

		// Determine character level and available hit dice based on owned Class items
		const [level, hd, babTotal, pda] = this.items.reduce(
			(arr, item) => {
				if (item.type === "class") {
					const classLevels = parseInt(item.system.levels) || 1;
					arr[0] += classLevels;
					arr[1] += classLevels - (parseInt(item.system.hitDiceUsed) || 0);
					arr[2] += Math.floor(classLevels * CONFIG.TRPG.classBABFormulas[item.system.bab]);
				}
				if (item.type === "equipment" && item.system.equipped) {
					arr[3] += item.system.stealth;
				}
				return arr;
			},
			[0, 0, 0, 0]
		);
		data.details.level = level;
		data.details.halfLevel = Math.floor(level / 2);
		data.attributes.hd = hd;
		data.attributes.bab.value = babTotal;
		data.attributes.bab.total = babTotal;
		data.attributes.penalidadeArmadura = pda;

		// Character proficiency bonus
		data.attributes.prof = Math.floor((level + 7) / 4);

		// Experience required for next level
		const xp = data.details.xp;
		xp.max = this.getLevelExp(level || 1);
		const prior = this.getLevelExp(level - 1 || 0);
		const required = xp.max - prior;
		const pct = Math.round(((xp.value - prior) * 100) / required);
		xp.pct = Math.clamp(pct, 0, 100);
	}

	/* -------------------------------------------- */

	/**
	 * Prepare NPC type specific data
	 */
	_prepareNPCData(actorData) {
		const data = actorData.system;

		// Kill Experience
		data.details.xp.value = this.getCRExp(data.details.cr);

		data.details.level = Math.max(0, data.details.level);
		data.details.halfLevel = Math.floor(data.details.level / 2);

		// Proficiency
		data.attributes.prof = Math.floor((Math.max(data.details.cr, 1) + 7) / 4);

		// Spellcaster Level
		if (data.attributes.spellcasting && !Number.isNumeric(data.details.spellLevel)) {
			data.details.spellLevel = Math.max(data.details.cr, 1);
		}
	}

	/* -------------------------------------------- */

	/**
	 * Prepare skill checks.
	 * @param actorData
	 * @param bonuses Global bonus data.
	 * @param checkBonus Ability check specific bonus.
	 * @private
	 */
	_prepareSkills(actorData, bonuses, checkBonus) {
		const data = actorData.system;
		const flags = actorData.flags.trpg || {};

		// Skill modifiers
		const feats = TRPG.characterFlags;
		const athlete = flags.remarkableAthlete;
		const joat = flags.jackOfAllTrades;
		const observant = flags.observantFeat;
		const skillBonus = Number.isNumeric(bonuses.skill) ? parseInt(bonuses.skill) : 0;
		for (let [id, skl] of Object.entries(data.skills)) {
			skl.value = Math.clamp(Number(skl.value).toNearest(0.5), 0, 2) ?? 0;

			// Remarkable
			if (athlete && skl.value < 0.5 && feats.remarkableAthlete.abilities.includes(skl.ability)) {
				skl.value = 0.5;
			}

			// Jack of All Trades
			if (joat && skl.value < 0.5) {
				skl.value = 0.5;
			}

			// Compute modifier
			skl.bonus = checkBonus + skillBonus;
			skl.mod = data.abilities[skl.ability].mod;
			skl.prof = skl.value ? 3 + data.details.level : Math.floor(data.details.level / 2);
			skl.total = skl.mod + skl.prof + skl.bonus;

			// Compute passive bonus
			// const passive = observant && (feats.observantFeat.skills.includes(id)) ? 5 : 0;
			// skl.passive = 10 + skl.total + passive;
		}
	}

	/* -------------------------------------------- */

	/**
	 * Initialize derived AC fields for Active Effects to target.
	 * @param actorData
	 * @private
	 */
	_prepareBaseArmorClass(actorData) {
		const ac = actorData.system.attributes.ac;
		ac.base = 10;
		ac.shield = ac.bonus = ac.cover = 0;
		this.armor = null;
		this.shield = null;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare data related to the spell-casting capabilities of the Actor
	 * @private
	 */
	_computeSpellcastingProgression(actorData) {
		const ad = actorData.system;
		const spells = ad.spells;
		const isNPC = actorData.type === "npc";

		// Spellcasting DC
		const spellcastingAbility = ad.abilities[ad.attributes.spellcasting];
		ad.attributes.spelldc = spellcastingAbility ? spellcastingAbility.dc : 10;
	}

	/* -------------------------------------------- */

	/**
	 * Determine a character's AC value from their equipped armor and shield.
	 * @param {object} data      Note that this object will be mutated.
	 * @return {{
	 *   calc: string,
	 *   value: number,
	 *   base: number,
	 *   shield: number,
	 *   bonus: number,
	 *   cover: number,
	 *   flat: number,
	 *   equippedArmor: Item5e,
	 *   equippedShield: Item5e,
	 *   warnings: string[]
	 * }}
	 * @private
	 */
	_computeArmorClass(data) {
		// Get AC configuration and apply automatic migrations for older data structures
		const ac = data.attributes.ac;
		ac.warnings = [];
		let cfg = CONFIG.TRPG.armorClasses[ac.calc];
		if (!cfg) {
			ac.calc = "flat";
			if (Number.isNumeric(ac.value)) ac.flat = Number(ac.value);
			cfg = CONFIG.TRPG.armorClasses.flat;
		}

		const armorTypes = new Set(Object.keys(CONFIG.TRPG.armorTypes));
		const { armors, shields } = this.itemTypes.equipment.reduce(
			(obj, equip) => {
				const armor = equip.system.armor;
				if (!equip.system.equipped || !armorTypes.has(armor?.type)) return obj;
				if (armor.type === "shield") obj.shields.push(equip);
				else obj.armors.push(equip);
				return obj;
			},
			{ armors: [], shields: [] }
		);

		// Determine base AC
		switch (ac.calc) {
			// Flat AC (no additional bonuses)
			case "flat":
				ac.value = ac.flat;
				return ac;

			// Natural AC (includes bonuses)
			case "natural":
				ac.base = ac.flat;
				break;

			// Equipment-based AC
			case "default":
				ac.base = 10 + Math.floor(data.details.level / 2);
				if (armors.length) {
					if (armors.length > 1) ac.warnings.push("TRPG.WarnMultipleArmor");
					const armorData = armors[0].system.armor;
					ac.dex = Math.min(armorData.dex ?? Infinity, data.abilities.dex.mod);
					ac.base += (armorData.value ?? 0) + ac.dex;
					ac.equippedArmor = armors[0];
				} else {
					ac.dex = data.abilities.dex.mod;
					ac.base += ac.dex;
				}
				break;

			// Formula-based AC
			default:
				let formula = ac.calc === "custom" ? ac.formula : cfg.formula;
				const rollData = this.getRollData();
				try {
					const replaced = Roll.replaceFormulaData(formula, rollData);
					ac.base = Roll.safeEval(replaced);
				} catch (err) {
					ac.warnings.push("TRPG.WarnBadACFormula");
					const replaced = Roll.replaceFormulaData(CONFIG.TRPG.armorClasses.default.formula, rollData);
					ac.base = Roll.safeEval(replaced);
				}
				break;
		}

		// Equipped Shield
		if (shields.length) {
			if (shields.length > 1) ac.warnings.push("TRPG.WarnMultipleShields");
			ac.shield = shields[0].system.armor.value ?? 0;
			ac.equippedShield = shields[0];
		}

		// Compute total AC and return
		ac.value = ac.base + ac.shield + ac.bonus + ac.cover;
		return ac;
	}

	/* -------------------------------------------- */

	/**
	 * Compute the level and percentage of encumbrance for an Actor.
	 *
	 * Optionally include the weight of carried currency across all denominations by applying the standard rule
	 * from the PHB pg. 143
	 * @param {Object} actorData      The data object for the Actor being rendered
	 * @returns {{max: number, value: number, pct: number}}  An object describing the character's encumbrance level
	 * @private
	 */
	_computeEncumbrance(actorData) {
		// Get the total weight from items
		const physicalItems = ["weapon", "equipment", "consumable", "tool", "backpack", "loot"];
		let weight = actorData.items.reduce((weight, i) => {
			if (!physicalItems.includes(i.type)) return weight;
			const q = i.system.quantity || 0;
			const w = i.system.weight || 0;
			return weight + q * w;
		}, 0);

		// [Optional] add Currency Weight (for non-transformed actors)
		if (game.settings.get("trpg", "currencyWeight") && actorData.system.currency) {
			const currency = actorData.system.currency;
			const numCoins = Object.values(currency).reduce((val, denom) => (val += Math.max(denom, 0)), 0);
			weight += (numCoins * CONFIG.TRPG.encumbrance.currencyPerWeight) / 100;
		}

		// Determine the encumbrance size class
		let mod =
			{
				tiny: 0.5,
				sm: 1,
				med: 1,
				lg: 2,
				huge: 4,
				grg: 8,
			}[actorData.system.traits.size] || 1;
		if (this.getFlag("trpg", "powerfulBuild")) mod = Math.min(mod * 2, 8);

		// Compute Encumbrance percentage
		weight = weight.toNearest(0.1);
		const max = actorData.system.abilities.str.value * CONFIG.TRPG.encumbrance.strMultiplier * mod;
		const pct = Math.clamp((weight * 100) / max, 0, 100);
		return { value: weight.toNearest(0.1), max, pct, encumbered: pct > 0.3 };
	}

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	/** @inheritdoc */
	async _preCreate(data, options, user) {
		await super._preCreate(data, options, user);
		const sourceId = this.getFlag("core", "sourceId");
		if (sourceId?.startsWith("Compendium.")) return;

		// Some sensible defaults for convenience
		// Token size category
		const s = CONFIG.TRPG.tokenSizes[this.system.traits.size || "med"];
		const prototypeToken = { width: s, height: s };
		if (this.type === "character") Object.assign(prototypeToken, { sight: { enabled: true }, actorLink: true, disposition: 1 });
		this.updateSource({ prototypeToken });
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	async _preUpdate(changed, options, user) {
		await super._preUpdate(changed, options, user);

		// Apply changes in Actor size to Token width/height
		const newSize = foundry.utils.getProperty(changed, "system.traits.size");
		if (newSize && newSize !== this.system.traits?.size) {
			let size = CONFIG.TRPG.tokenSizes[newSize];
			if (!foundry.utils.hasProperty(changed, "prototypeToken.width")) {
				changed.prototypeToken ||= {};
				changed.prototypeToken.height = size;
				changed.prototypeToken.width = size;
			}
		}

		// Reset death save counters
		// const isDead = this.system.attributes.hp.value <= 0;
		// if ( isDead && (foundry.utils.getProperty(changed, "system.attributes.hp.value") > 0) ) {
		//   foundry.utils.setProperty(changed, "system.attributes.death.success", 0);
		//   foundry.utils.setProperty(changed, "system.attributes.death.failure", 0);
		// }
	}

	/* -------------------------------------------- */

	/**
	 * Assign a class item as the original class for the Actor based on which class has the most levels
	 * @protected
	 */
	_assignPrimaryClass() {
		const classes = this.itemTypes.class.sort((a, b) => b.system.levels - a.system.levels);
		const newPC = classes[0]?.id || "";
		return this.update({ "system.details.originalClass": newPC });
	}

	/* -------------------------------------------- */
	/*  Gameplay Mechanics                          */
	/* -------------------------------------------- */

	/** @override */
	async modifyTokenAttribute(attribute, value, isDelta, isBar) {
		if (attribute === "attributes.hp") {
			const hp = foundry.utils.getProperty(this.system, attribute);
			const delta = isDelta ? -1 * value : hp.value + hp.temp - value;
			return this.applyDamage(delta);
		} else if (attribute === "attributes.mp") {
			const hp = foundry.utils.getProperty(this.system, attribute);
			const delta = isDelta ? -1 * value : hp.value + hp.temp - value;
			return this.reduceMagicPoints(delta);
		}
		return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
	}

	/* -------------------------------------------- */

	/**
	 * Apply a certain amount of damage or healing to the health pool for Actor
	 * @param {number} amount       An amount of damage (positive) or healing (negative) to sustain
	 * @param {number} multiplier   A multiplier which allows for resistance, vulnerability, or healing
	 * @return {Promise<Actor>}     A Promise which resolves once the damage has been applied
	 */
	async applyDamage(amount = 0, multiplier = 1) {
		amount = Math.floor(parseInt(amount) * multiplier);
		const hp = this.system.attributes.hp;

		// Deduct damage from temp HP first
		const tmp = parseInt(hp.temp) || 0;
		const dt = amount > 0 ? Math.min(tmp, amount) : 0;

		// Remaining goes to health
		const tmpMax = parseInt(hp.tempmax) || 0;
		const dh = Math.clamp(hp.value - (amount - dt), 0, hp.max + tmpMax);

		// Update the Actor
		const updates = {
			"system.attributes.hp.temp": tmp - dt,
			"system.attributes.hp.value": dh,
		};

		// Delegate damage application to a hook
		// TODO replace this in the future with a better modifyTokenAttribute function in the core
		const allowed = Hooks.call(
			"modifyTokenAttribute",
			{
				attribute: "attributes.hp",
				value: amount,
				isDelta: false,
				isBar: true,
			},
			updates
		);
		return allowed !== false ? this.update(updates) : this;
	}

	async reduceMagicPoints(amount = 0, multiplier = 1) {
		amount = Math.floor(parseInt(amount) * multiplier);
		const hp = this.system.attributes.mp;

		// Deduct damage from temp HP first
		const tmp = parseInt(hp.temp) || 0;
		const dt = amount > 0 ? Math.min(tmp, amount) : 0;

		// Remaining goes to health
		const tmpMax = parseInt(hp.tempmax) || 0;
		const dh = Math.clamp(hp.value - (amount - dt), 0, hp.max + tmpMax);

		// Update the Actor
		const updates = {
			"system.attributes.mp.temp": tmp - dt,
			"system.attributes.mp.value": dh,
		};

		// Delegate damage application to a hook
		// TODO replace this in the future with a better modifyTokenAttribute function in the core
		const allowed = Hooks.call(
			"modifyTokenAttribute",
			{
				attribute: "attributes.mp",
				value: amount,
				isDelta: false,
				isBar: true,
			},
			updates
		);
		return allowed !== false ? this.update(updates) : this;
	}

	/* -------------------------------------------- */

	/**
	 * Roll a Skill Check
	 * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
	 * @param {string} skillId      The skill id (e.g. "ins")
	 * @param {Object} options      Options which configure how the skill check is rolled
	 * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
	 */
	rollSkill(skillId, options = {}) {
		const skl = this.system.skills[skillId];
		const bonuses = foundry.utils.getProperty(this.system, "bonuses.abilities") || {};

		// Compose roll parts and data
		const parts = ["@mod"];
		const data = { mod: skl.mod + skl.prof };

		// Ability test bonus
		if (bonuses.check) {
			data["checkBonus"] = bonuses.check;
			parts.push("@checkBonus");
		}

		// Skill check bonus
		if (bonuses.skill) {
			data["skillBonus"] = bonuses.skill;
			parts.push("@skillBonus");
		}

		// Add provided extra roll parts now because they will get clobbered by mergeObject below
		if (options.parts?.length > 0) {
			parts.push(...options.parts);
		}

		// Bonus
		const skillBonus = this.getFlag("trpg", `${skillId}.skill-bonus`);
		if (skillBonus) {
			parts.push("@extra");
			data.extra = skillBonus;
		}

		// Reliable Talent applies to any skill check we have full or better proficiency in
		const reliableTalent = skl.value >= 1 && this.getFlag("trpg", "reliableTalent");

		// Roll and return
		const rollData = foundry.utils.mergeObject(options, {
			parts: parts,
			data: data,
			title: game.i18n.format("TRPG.SkillPromptTitle", { skill: CONFIG.TRPG.skills[skillId] }),
			halflingLucky: this.getFlag("trpg", "halflingLucky"),
			reliableTalent: reliableTalent,
			messageData: {
				speaker: options.speaker || ChatMessage.getSpeaker({ actor: this }),
				"flags.trpg.roll": { type: "skill", skillId },
			},
		});
		return d20Roll(rollData);
	}

	/* -------------------------------------------- */

	/**
	 * Roll a generic ability test or saving throw.
	 * Prompt the user for input on which variety of roll they want to do.
	 * @param {String}abilityId     The ability id (e.g. "str")
	 * @param {Object} options      Options which configure how ability tests or saving throws are rolled
	 */
	rollAbility(abilityId, options = {}) {
		const label = CONFIG.TRPG.abilities[abilityId];
		this.rollAbilityTest(abilityId, options);
	}

	/* -------------------------------------------- */

	/**
	 * Roll an Ability Test
	 * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
	 * @param {String} abilityId    The ability ID (e.g. "str")
	 * @param {Object} options      Options which configure how ability tests are rolled
	 * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
	 */
	rollAbilityTest(abilityId, options = {}) {
		const label = CONFIG.TRPG.abilities[abilityId];
		const abl = this.system.abilities[abilityId];

		// Construct parts
		const parts = ["@mod"];
		const data = { mod: abl.mod };

		// Add feat-related proficiency bonuses
		const feats = this.flags.trpg || {};
		if (feats.remarkableAthlete && TRPG.characterFlags.remarkableAthlete.abilities.includes(abilityId)) {
			parts.push("@proficiency");
			data.proficiency = Math.ceil(0.5 * this.system.attributes.prof);
		} else if (feats.jackOfAllTrades) {
			parts.push("@proficiency");
			data.proficiency = Math.floor(0.5 * this.system.attributes.prof);
		}

		// Add global actor bonus
		const bonuses = foundry.utils.getProperty(this.system, "bonuses.abilities") || {};
		if (bonuses.check) {
			parts.push("@checkBonus");
			data.checkBonus = bonuses.check;
		}

		// Add provided extra roll parts now because they will get clobbered by mergeObject below
		if (options.parts?.length > 0) {
			parts.push(...options.parts);
		}

		// Roll and return
		const rollData = foundry.utils.mergeObject(options, {
			parts: parts,
			data: data,
			title: game.i18n.format("TRPG.AbilityPromptTitle", { ability: label }),
			halflingLucky: feats.halflingLucky,
			messageData: {
				speaker: options.speaker || ChatMessage.getSpeaker({ actor: this }),
				"flags.trpg.roll": { type: "ability", abilityId },
			},
		});
		return d20Roll(rollData);
	}

	/* -------------------------------------------- */

	/**
	 * Roll an Ability Saving Throw
	 * Prompt the user for input regarding Advantage/Disadvantage and any Situational Bonus
	 * @param {String} abilityId    The ability ID (e.g. "str")
	 * @param {Object} options      Options which configure how ability tests are rolled
	 * @return {Promise<Roll>}      A Promise which resolves to the created Roll instance
	 */
	rollAbilitySave(abilityId, options = {}) {
		const label = CONFIG.TRPG.saves[abilityId];
		const abl = this.system.saves[abilityId];

		// Construct parts
		const parts = ["@mod"];
		const data = { mod: abl.mod };

		// Include proficiency bonus
		if (abl.prof > 0) {
			parts.push("@prof");
			data.prof = abl.prof;
		}

		// Include a global actor ability save bonus
		const bonuses = foundry.utils.getProperty(this.system, "bonuses.abilities") || {};
		if (bonuses.save) {
			parts.push("@saveBonus");
			data.saveBonus = bonuses.save;
		}

		// Add provided extra roll parts now because they will get clobbered by mergeObject below
		if (options.parts?.length > 0) {
			parts.push(...options.parts);
		}

		// Bonus
		const skillBonus = this.getFlag("trpg", `${abilityId}.skill-bonus`);
		if (skillBonus) {
			parts.push("@extra");
			data.extra = skillBonus;
		}

		// Roll and return
		const rollData = foundry.utils.mergeObject(options, {
			parts: parts,
			data: data,
			title: game.i18n.format("TRPG.SavePromptTitle", { ability: label }),
			halflingLucky: this.getFlag("trpg", "halflingLucky"),
			messageData: {
				speaker: options.speaker || ChatMessage.getSpeaker({ actor: this }),
				"flags.trpg.roll": { type: "save", abilityId },
			},
		});
		return d20Roll(rollData);
	}

	/* -------------------------------------------- */

	/**
	 * Perform a death saving throw, rolling a d20 plus any global save bonuses
	 * @param {Object} options        Additional options which modify the roll
	 * @return {Promise<Roll|null>}   A Promise which resolves to the Roll instance
	 */
	async rollDeathSave(options = {}) {
		// Display a warning if we are not at zero HP or if we already have reached 3
		const death = this.system.attributes.death;
		if (this.system.attributes.hp.value > 0 || death.failure >= 3 || death.success >= 3) {
			ui.notifications.warn(game.i18n.localize("TRPG.DeathSaveUnnecessary"));
			return null;
		}

		// Evaluate a global saving throw bonus
		const parts = [];
		const data = {};
		const speaker = options.speaker || ChatMessage.getSpeaker({ actor: this });

		// Diamond Soul adds proficiency
		if (this.getFlag("trpg", "diamondSoul")) {
			parts.push("@prof");
			data.prof = this.system.attributes.prof;
		}

		// Include a global actor ability save bonus
		const bonuses = foundry.utils.getProperty(this.system, "bonuses.abilities") || {};
		if (bonuses.save) {
			parts.push("@saveBonus");
			data.saveBonus = bonuses.save;
		}

		// Evaluate the roll
		const rollData = foundry.utils.mergeObject(options, {
			parts: parts,
			data: data,
			title: game.i18n.localize("TRPG.DeathSavingThrow"),
			halflingLucky: this.getFlag("trpg", "halflingLucky"),
			targetValue: 10,
			messageData: {
				speaker: speaker,
				"flags.trpg.roll": { type: "death" },
			},
		});
		const roll = await d20Roll(rollData);
		if (!roll) return null;

		// Take action depending on the result
		const success = roll.total >= 10;
		const d20 = roll.dice[0].total;

		let chatString;

		// Save success
		if (success) {
			let successes = (death.success || 0) + 1;

			// Critical Success = revive with 1hp
			if (d20 === 20) {
				await this.update({
					"system.attributes.death.success": 0,
					"system.attributes.death.failure": 0,
					"system.attributes.hp.value": 1,
				});
				chatString = "TRPG.DeathSaveCriticalSuccess";
			}

			// 3 Successes = survive and reset checks
			else if (successes === 3) {
				await this.update({
					"system.attributes.death.success": 0,
					"system.attributes.death.failure": 0,
				});
				chatString = "TRPG.DeathSaveSuccess";
			}

			// Increment successes
			else await this.update({ "system.attributes.death.success": Math.clamp(successes, 0, 3) });
		}

		// Save failure
		else {
			let failures = (death.failure || 0) + (d20 === 1 ? 2 : 1);
			await this.update({ "system.attributes.death.failure": Math.clamp(failures, 0, 3) });
			if (failures >= 3) {
				// 3 Failures = death
				chatString = "TRPG.DeathSaveFailure";
			}
		}

		// Display success/failure chat message
		if (chatString) {
			let chatData = { content: game.i18n.format(chatString, { name: this.name }), speaker };
			ChatMessage.applyRollMode(chatData, roll.options.rollMode);
			await ChatMessage.create(chatData);
		}

		// Return the rolled result
		return roll;
	}

	/* -------------------------------------------- */

	/**
	 * Roll a hit die of the appropriate type, gaining hit points equal to the die roll plus your CON modifier
	 * @param {string} [denomination]   The hit denomination of hit die to roll. Example "d8".
	 *                                  If no denomination is provided, the first available HD will be used
	 * @param {boolean} [dialog]        Show a dialog prompt for configuring the hit die roll?
	 * @return {Promise<Roll|null>}     The created Roll instance, or null if no hit die was rolled
	 */
	async rollHitDie(denomination, { dialog = true } = {}) {
		// If no denomination was provided, choose the first available
		let cls = null;
		if (!denomination) {
			cls = this.itemTypes.class.find((c) => c.system.hitDiceUsed < c.system.levels);
			if (!cls) return null;
			denomination = cls.system.hitDice;
		}

		// Otherwise locate a class (if any) which has an available hit die of the requested denomination
		else {
			cls = this.items.find((i) => {
				const d = i.system;
				return d.hitDice === denomination && (d.hitDiceUsed || 0) < (d.levels || 1);
			});
		}

		// If no class is available, display an error notification
		if (!cls) {
			ui.notifications.error(game.i18n.format("TRPG.HitDiceWarn", { name: this.name, formula: denomination }));
			return null;
		}

		// Prepare roll data
		const parts = [`1${denomination}`, "@abilities.con.mod"];
		const title = game.i18n.localize("TRPG.HitDiceRoll");
		const rollData = foundry.utils.deepClone(this.system);

		// Call the roll helper utility
		const roll = await damageRoll({
			event: new Event("hitDie"),
			parts: parts,
			data: rollData,
			title: title,
			allowCritical: false,
			fastForward: !dialog,
			dialogOptions: { width: 350 },
			messageData: {
				speaker: ChatMessage.getSpeaker({ actor: this }),
				"flags.trpg.roll": { type: "hitDie" },
			},
		});
		if (!roll) return null;

		// Adjust actor data
		await cls.update({ "data.hitDiceUsed": cls.system.hitDiceUsed + 1 });
		const hp = this.system.attributes.hp;
		const dhp = Math.min(hp.max + (hp.tempmax ?? 0) - hp.value, roll.total);
		await this.update({ "system.attributes.hp.value": hp.value + dhp });
		return roll;
	}

	/* -------------------------------------------- */

	/**
	 * Results from a rest operation.
	 *
	 * @typedef {object} RestResult
	 * @property {number} dhp                  Hit points recovered during the rest.
	 * @property {number} dhd                  Hit dice recovered or spent during the rest.
	 * @property {object} updateData           Updates applied to the actor.
	 * @property {Array.<object>} updateItems  Updates applied to actor's items.
	 * @property {boolean} longRest            Whether the rest type was a long rest.
	 * @property {boolean} newDay              Whether a new day occurred during the rest.
	 */

	/* -------------------------------------------- */

	/**
	 * Take a long rest, recovering hit points, hit dice, resources, item uses, and spell slots.
	 *
	 * @param {object} [options]
	 * @param {boolean} [options.dialog=true]  Present a confirmation dialog window whether or not to take a long rest.
	 * @param {boolean} [options.chat=true]    Summarize the results of the rest workflow as a chat message.
	 * @param {boolean} [options.newDay=true]  Whether the long rest carries over to a new day.
	 * @return {Promise.<RestResult>}          A Promise which resolves once the long rest workflow has completed.
	 */
	async longRest({ dialog = true, chat = true, newDay = true } = {}) {
		// Maybe present a confirmation dialog
		if (dialog) {
			try {
				newDay = await LongRestDialog.longRestDialog({ actor: this });
			} catch (err) {
				return;
			}
		}

		return this._rest(chat, newDay, true);
	}

	/* -------------------------------------------- */

	/**
	 * Perform all of the changes needed for a short or long rest.
	 *
	 * @param {boolean} chat           Summarize the results of the rest workflow as a chat message.
	 * @param {boolean} newDay         Has a new day occurred during this rest?
	 * @param {boolean} longRest       Is this a long rest?
	 * @param {number} [dhd=0]         Number of hit dice spent during so far during the rest.
	 * @param {number} [dhp=0]         Number of hit points recovered so far during the rest.
	 * @return {Promise.<RestResult>}  Consolidated results of the rest workflow.
	 * @private
	 */
	async _rest(chat, newDay, longRest, dhd = 0, dhp = 0, dmp = 0) {
		let hitPointsRecovered = 0;
		let hitPointUpdates = {};
		let magicPointsRecovered = 0;
		let magicPointUpdates = {};
		let hitDiceRecovered = 0;
		let hitDiceUpdates = [];

		// Recover hit points & hit dice on long rest
		if (longRest) {
			({ updates: hitPointUpdates, hitPointsRecovered } = this._getRestHitPointRecovery());
			({ updates: magicPointUpdates, magicPointsRecovered } = this._getRestMagicPointRecovery());
			({ updates: hitDiceUpdates, hitDiceRecovered } = this._getRestHitDiceRecovery());
		}

		// Figure out the rest of the changes
		const result = {
			dhd: dhd + hitDiceRecovered,
			dhp: dhp + hitPointsRecovered,
			dmp: dmp + magicPointsRecovered,
			updateData: {
				...hitPointUpdates,
				...magicPointUpdates,
				...this._getRestResourceRecovery({ recoverShortRestResources: !longRest, recoverLongRestResources: longRest }),
				...this._getRestSpellRecovery({ recoverSpells: longRest }),
			},
			updateItems: [...hitDiceUpdates, ...this._getRestItemUsesRecovery({ recoverLongRestUses: longRest, recoverDailyUses: newDay })],
			longRest,
			newDay,
		};

		// Perform updates
		await this.update(result.updateData);
		await this.updateEmbeddedDocuments("Item", result.updateItems);

		// Display a Chat Message summarizing the rest effects
		if (chat) await this._displayRestResultMessage(result, longRest);

		// Call restCompleted hook so that modules can easily perform actions when actors finish a rest
		Hooks.callAll("restCompleted", this, result);

		// Return data summarizing the rest effects
		return result;
	}

	/* -------------------------------------------- */

	/**
	 * Display a chat message with the result of a rest.
	 *
	 * @param {RestResult} result         Result of the rest operation.
	 * @param {boolean} [longRest=false]  Is this a long rest?
	 * @return {Promise.<ChatMessage>}    Chat message that was created.
	 * @protected
	 */
	async _displayRestResultMessage(result, longRest = false) {
		const { dhd, dhp, dmp, newDay } = result;
		const diceRestored = dhd !== 0;
		const healthRestored = dhp !== 0;
		const magicRestored = dmp !== 0;
		const length = longRest ? "Long" : "Short";

		let restFlavor, message;

		// Summarize the rest duration
		// switch (game.settings.get("trpg", "restVariant")) {
		//   case 'normal': restFlavor = (longRest && newDay) ? "TRPG.LongRestOvernight" : `TRPG.${length}RestNormal`; break;
		//   case 'gritty': restFlavor = (!longRest && newDay) ? "TRPG.ShortRestOvernight" : `TRPG.${length}RestGritty`; break;
		//   case 'epic':  restFlavor = `TRPG.${length}RestEpic`; break;
		// }
		restFlavor = longRest && newDay ? "TRPG.LongRestOvernight" : `TRPG.${length}RestNormal`;

		// Determine the chat message to display
		if (diceRestored && healthRestored) message = `TRPG.${length}RestResult`;
		else if (longRest && !diceRestored && healthRestored && magicRestored) message = "TRPG.LongRestResultHitPointsMagicPoints";
		else if (longRest && !diceRestored && healthRestored) message = "TRPG.LongRestResultHitPoints";
		else if (longRest && diceRestored && !healthRestored) message = "TRPG.LongRestResultHitDice";
		else message = `TRPG.${length}RestResultShort`;

		// Create a chat message
		let chatData = {
			user: game.user.id,
			speaker: { actor: this, alias: this.name },
			flavor: game.i18n.localize(restFlavor),
			content: game.i18n.format(message, {
				name: this.name,
				dice: longRest ? dhd : -dhd,
				health: dhp,
				magic: dmp,
			}),
		};
		ChatMessage.applyRollMode(chatData, game.settings.get("core", "rollMode"));
		return ChatMessage.create(chatData);
	}

	/* -------------------------------------------- */

	/**
	 * Automatically spend hit dice to recover hit points up to a certain threshold.
	 *
	 * @param {object} [options]
	 * @param {number} [options.threshold=3]  A number of missing hit points which would trigger an automatic HD roll.
	 * @return {Promise.<number>}             Number of hit dice spent.
	 */
	async autoSpendHitDice({ threshold = 3 } = {}) {
		const max = this.system.attributes.hp.max + this.system.attributes.hp.tempmax;

		let diceRolled = 0;
		while (this.system.attributes.hp.value + threshold <= max) {
			const r = await this.rollHitDie(undefined, { dialog: false });
			if (r === null) break;
			diceRolled += 1;
		}

		return diceRolled;
	}

	/* -------------------------------------------- */

	/**
	 * Recovers actor hit points and eliminates any temp HP.
	 *
	 * @param {object} [options]
	 * @param {boolean} [options.recoverTemp=true]     Reset temp HP to zero.
	 * @param {boolean} [options.recoverTempMax=true]  Reset temp max HP to zero.
	 * @return {object)                                Updates to the actor and change in hit points.
	 * @protected
	 */
	_getRestHitPointRecovery({ recoverTemp = true, recoverTempMax = true } = {}) {
		const data = this.system;
		let updates = {};
		let max = data.attributes.hp.max;
		let current = data.attributes.hp.value;
		let newValue = current + data.details.level;
		let recoveredHP = Math.min(newValue, max);

		if (recoverTempMax) {
			updates["system.attributes.hp.tempmax"] = 0;
		} else {
			max += data.attributes.hp.tempmax;
		}
		updates["system.attributes.hp.value"] = Math.min(newValue, max);
		if (recoverTemp) {
			updates["system.attributes.hp.temp"] = 0;
		}

		return { updates, hitPointsRecovered: recoveredHP - current };
	}

	_getRestMagicPointRecovery({ recoverTemp = true, recoverTempMax = true } = {}) {
		const data = this.system;
		let updates = {};
		let max = data.attributes.mp.max;
		let current = data.attributes.mp.value;
		let newValue = current + data.details.level;
		let recoveredHP = Math.min(newValue, max);

		if (recoverTempMax) {
			updates["system.attributes.mp.tempmax"] = 0;
		} else {
			max += data.attributes.mp.tempmax;
		}
		updates["system.attributes.mp.value"] = Math.min(newValue, max);
		if (recoverTemp) {
			updates["system.attributes.mp.temp"] = 0;
		}

		return { updates, magicPointsRecovered: recoveredHP - current };
	}

	/* -------------------------------------------- */

	/**
	 * Recovers actor resources.
	 * @param {object} [options]
	 * @param {boolean} [options.recoverShortRestResources=true]  Recover resources that recharge on a short rest.
	 * @param {boolean} [options.recoverLongRestResources=true]   Recover resources that recharge on a long rest.
	 * @return {object}                                           Updates to the actor.
	 * @protected
	 */
	_getRestResourceRecovery({ recoverShortRestResources = true, recoverLongRestResources = true } = {}) {
		let updates = {};
		for (let [k, r] of Object.entries(this.system.resources)) {
			if (Number.isNumeric(r.max) && ((recoverShortRestResources && r.sr) || (recoverLongRestResources && r.lr))) {
				updates[`data.resources.${k}.value`] = Number(r.max);
			}
		}
		return updates;
	}

	/* -------------------------------------------- */

	/**
	 * Recovers spell slots and pact slots.
	 *
	 * @param {object} [options]
	 * @param {boolean} [options.recoverPact=true]     Recover all expended pact slots.
	 * @param {boolean} [options.recoverSpells=true]   Recover all expended spell slots.
	 * @return {object}                                Updates to the actor.
	 * @protected
	 */
	_getRestSpellRecovery({ recoverSpells = true } = {}) {
		let updates = {};

		if (recoverSpells) {
			for (let [k, v] of Object.entries(this.system.spells)) {
				updates[`data.spells.${k}.value`] = Number.isNumeric(v.override) ? v.override : v.max ?? 0;
			}
		}

		return updates;
	}

	/* -------------------------------------------- */

	/**
	 * Recovers class hit dice during a long rest.
	 *
	 * @param {object} [options]
	 * @param {number} [options.maxHitDice]  Maximum number of hit dice to recover.
	 * @return {object}                      Array of item updates and number of hit dice recovered.
	 * @protected
	 */
	_getRestHitDiceRecovery({ maxHitDice = undefined } = {}) {
		// Determine the number of hit dice which may be recovered
		if (maxHitDice === undefined) {
			maxHitDice = Math.max(Math.floor(this.system.details.level / 2), 1);
		}

		// Sort classes which can recover HD, assuming players prefer recovering larger HD first.
		const sortedClasses = Object.values(this.classes).sort((a, b) => {
			return (parseInt(b.system.hitDice.slice(1)) || 0) - (parseInt(a.system.hitDice.slice(1)) || 0);
		});

		let updates = [];
		let hitDiceRecovered = 0;
		for (let item of sortedClasses) {
			const d = item.system;
			if (hitDiceRecovered < maxHitDice && d.hitDiceUsed > 0) {
				let delta = Math.min(d.hitDiceUsed || 0, maxHitDice - hitDiceRecovered);
				hitDiceRecovered += delta;
				updates.push({ _id: item.id, "data.hitDiceUsed": d.hitDiceUsed - delta });
			}
		}

		return { updates, hitDiceRecovered };
	}

	/* -------------------------------------------- */

	/**
	 * Recovers item uses during short or long rests.
	 *
	 * @param {object} [options]
	 * @param {boolean} [options.recoverShortRestUses=true]  Recover uses for items that recharge after a short rest.
	 * @param {boolean} [options.recoverLongRestUses=true]   Recover uses for items that recharge after a long rest.
	 * @param {boolean} [options.recoverDailyUses=true]      Recover uses for items that recharge on a new day.
	 * @return {Array.<object>}                              Array of item updates.
	 * @protected
	 */
	_getRestItemUsesRecovery({ recoverShortRestUses = true, recoverLongRestUses = true, recoverDailyUses = true } = {}) {
		let recovery = [];
		if (recoverShortRestUses) recovery.push("sr");
		if (recoverLongRestUses) recovery.push("lr");
		if (recoverDailyUses) recovery.push("day");

		let updates = [];
		for (let item of this.items) {
			const d = item.system;
			if (d.uses && recovery.includes(d.uses.per)) {
				updates.push({ _id: item.id, "data.uses.value": d.uses.max });
			}
			if (recoverLongRestUses && d.recharge && d.recharge.value) {
				updates.push({ _id: item.id, "data.recharge.charged": true });
			}
		}

		return updates;
	}

	/* -------------------------------------------- */

	/**
	 * Convert all carried currency to the highest possible denomination to reduce the number of raw coins being
	 * carried by an Actor.
	 * @return {Promise<Actor5e>}
	 */
	convertCurrency() {
		const curr = foundry.utils.deepClone(this.system.currency);
		const convert = CONFIG.TRPG.currencyConversion;
		for (let [c, t] of Object.entries(convert)) {
			let change = Math.floor(curr[c] / t.each);
			curr[c] -= change * t.each;
			curr[t.into] += change;
		}
		return this.update({ "data.currency": curr });
	}

	/* -------------------------------------------- */

	/**
	 * Format a type object into a string.
	 * @param {object} typeData          The type data to convert to a string.
	 * @returns {string}
	 */
	static formatCreatureType(typeData) {
		if (typeof typeData === "string") return typeData; // backwards compatibility
		let localizedType;
		if (typeData.value === "custom") {
			localizedType = typeData.custom;
		} else {
			let code = CONFIG.TRPG.creatureTypes[typeData.value];
			localizedType = game.i18n.localize(!!typeData.swarm ? `${code}Pl` : code);
		}
		let type = localizedType;
		if (!!typeData.swarm) {
			type = game.i18n.format("TRPG.CreatureSwarmPhrase", {
				size: game.i18n.localize(CONFIG.TRPG.actorSizes[typeData.swarm]) + "s",
				type: localizedType,
			});
		}
		if (typeData.subtype) type = `${type} (${typeData.subtype})`;
		return type;
	}

	/* -------------------------------------------- */

	/*
	 * Populate a proficiency object with a `selected` field containing a combination of
	 * localizable group & individual proficiencies from `value` and the contents of `custom`.
	 *
	 * @param {object} data                Object containing proficiency data
	 * @param {Array.<string>} data.value  Array of standard proficiency keys
	 * @param {string} data.custom         Semicolon-separated string of custom proficiencies
	 * @param {string} type                "armor", "weapon", or "tool"
	 */
	static prepareProficiencies(data, type) {
		const profs = CONFIG.TRPG[`${type}Proficiencies`];
		const itemTypes = CONFIG.TRPG[`${type}Ids`];

		let values = [];
		if (data.value) {
			values = data.value instanceof Array ? data.value : [data.value];
		}

		data.selected = {};
		const pack = game.packs.get(CONFIG.TRPG.sourcePacks.ITEMS);
		for (const key of values) {
			if (profs[key]) {
				data.selected[key] = profs[key];
			} else if (pack && itemTypes && itemTypes[key]) {
				const item = pack.index.get(itemTypes[key]);
				data.selected[key] = item.name;
			}
		}

		// Add custom entries
		if (data.custom) {
			data.custom.split(";").forEach((c, i) => (data.selected[`custom${i + 1}`] = c.trim()));
		}
	}

	/* -------------------------------------------- */
	/*  DEPRECATED METHODS                          */
	/* -------------------------------------------- */

	/**
	 * @deprecated since dnd5e 0.97
	 */
	getSpellDC(ability) {
		console.warn(`The Actor5e#getSpellDC(ability) method has been deprecated in favor of Actor5e#data.data.abilities[ability].dc`);
		return this.system.abilities[ability]?.dc;
	}

	/* -------------------------------------------- */

	/**
	 * Cast a Spell, consuming a spell slot of a certain level
	 * @param {Item5e} item   The spell being cast by the actor
	 * @param {Event} event   The originating user interaction which triggered the cast
	 * @deprecated since dnd5e 1.2.0
	 */
	async useSpell(item, { configureDialog = true } = {}) {
		console.warn(`The Actor5e#useSpell method has been deprecated in favor of Item5e#roll`);
		if (item.type !== "spell") throw new Error("Wrong Item type");
		return item.roll();
	}
}
