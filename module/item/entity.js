import AbilityUseDialog from "../apps/ability-use-dialog.js";
import { TRPG } from "../config.js";
import { d20Roll, damageRoll, simplifyRollFormula } from "../dice.js";

/**
 * Override and extend the basic Item implementation
 * @extends {Item}
 */
export default class Item5e extends Item {
	/* -------------------------------------------- */
	/*  Item Properties                             */
	/* -------------------------------------------- */

	/**
	 * Determine which ability score modifier is used by this item
	 * @type {string|null}
	 */
	get abilityMod() {
		const itemData = this.system;
		if (!("ability" in itemData)) return null;

		// Case 1 - defined directly by the item
		if (itemData.ability) return itemData.ability;
		// Case 2 - inferred from a parent actor
		else if (this.actor) {
			const actorData = this.actor.system;

			// Spells - Use Actor spellcasting modifier
			if (this.type === "spell") return actorData.attributes.spellcasting || "int";
			// Tools - default to Intelligence
			else if (this.type === "tool") return "int";
			// Weapons
			else if (this.type === "weapon") {
				const wt = itemData.weaponType;

				//Weapons using the spellcasting modifier
				if (["msak", "rsak"].includes(itemData.actionType)) {
					return actorData.attributes.spellcasting || "int";
				}

				// Finesse weapons - Str or Dex (PHB pg. 147)
				else if (itemData.properties.fin === true) {
					return actorData.abilities["dex"].mod >= actorData.abilities["str"].mod ? "dex" : "str";
				}

				// Ranged weapons - Dex (PH p.194)
				else if (["simpleR", "martialR"].includes(wt)) return "dex";
			}
			return "str";
		}

		// Case 3 - unknown
		return null;
	}

	/* -------------------------------------------- */

	/**
	 * Does the Item implement an attack roll as part of its usage
	 * @type {boolean}
	 */
	get hasAttack() {
		return ["mwak", "rwak", "msak", "rsak"].includes(this.system.actionType);
	}

	/* -------------------------------------------- */

	/**
	 * Does the Item implement a damage roll as part of its usage
	 * @type {boolean}
	 */
	get hasDamage() {
		return !!(this.system.damage && this.system.damage.parts.length);
	}

	/* -------------------------------------------- */

	/**
	 * Does the Item implement a versatile damage roll as part of its usage
	 * @type {boolean}
	 */
	get isVersatile() {
		return !!(this.hasDamage && this.system.damage.versatile);
	}

	/* -------------------------------------------- */

	/**
	 * Does the item provide an amount of healing instead of conventional damage?
	 * @return {boolean}
	 */
	get isHealing() {
		return this.system.actionType === "heal" && this.system.damage.parts.length;
	}

	/* -------------------------------------------- */

	/**
	 * Does the Item implement a saving throw as part of its usage
	 * @type {boolean}
	 */
	get hasSave() {
		const save = this.system?.save || {};
		return !!(save.ability && save.scaling);
	}

	/* -------------------------------------------- */

	/**
	 * Does the Item have a target
	 * @type {boolean}
	 */
	get hasTarget() {
		const target = this.system.target;
		return target && !["none", ""].includes(target.type);
	}

	/* -------------------------------------------- */

	/**
	 * Does the Item have an area of effect target
	 * @type {boolean}
	 */
	get hasAreaTarget() {
		const target = this.system.target;
		return target && target.type in CONFIG.TRPG.areaTargetTypes;
	}

	/* -------------------------------------------- */

	/**
	 * A flag for whether this Item is limited in it's ability to be used by charges or by recharge.
	 * @type {boolean}
	 */
	get hasLimitedUses() {
		let chg = this.system.recharge || {};
		let uses = this.system.uses || {};
		return !!chg.value || (uses.per && uses.max > 0);
	}

	/* -------------------------------------------- */
	/*	Data Preparation														*/
	/* -------------------------------------------- */

	/**
	 * Augment the basic Item data model with additional dynamic data.
	 */
	prepareDerivedData() {
		super.prepareDerivedData();
		this.labels = {};

		// Clear out linked item cache
		this._classLink = undefined;

		// Advancement
		this._prepareAdvancement();

		// Specialized preparation per Item type
		switch (this.type) {
			case "equipment":
				this._prepareEquipment();
				break;
			case "feat":
				this._prepareFeat();
				break;
			case "spell":
				this._prepareSpell();
				break;
		}

		// Activated Items
		this._prepareActivation();
		this._prepareAction();

		if (!this.isOwned) this.prepareFinalAttributes();

		return;

		// Get the Item's data
		const itemData = this;
		const data = itemData.system;
		const C = CONFIG.TRPG;
		const labels = (this.labels = {});

		// Classes
		if (itemData.type === "class") {
			data.levels = Math.clamp(data.levels, 1, 20);
		}

		// Spell Level,  School, and Components
		if (itemData.type === "spell") {
			data.preparation.mode = data.preparation.mode || "prepared";
			labels.level = data.level;
			labels.spellList = C.spellLists[data.spellList];
			labels.school = C.spellSchools[data.school];
			labels.components = Object.entries(data.components).reduce((arr, c) => {
				if (c[1] !== true) return arr;
				arr.push(c[0].titleCase().slice(0, 1));
				return arr;
			}, []);
			labels.materials = data?.materials?.value ?? null;
		}

		// Feat Items
		else if (itemData.type === "feat") {
			const act = data.activation;
			if (act && act.type) labels.featType = game.i18n.localize(C.abilityActivationTypes[data.activation.type]);
			else labels.featType = game.i18n.localize("TRPG.Passive");
		}

		// Equipment Items
		else if (itemData.type === "equipment") {
			labels.armor = data.armor.value ? `${data.armor.value} ${game.i18n.localize("TRPG.AC")}` : "";
		}

		// Activated Items
		if (data.hasOwnProperty("activation")) {
			// Ability Activation Label
			let act = data.activation || {};
			if (act) labels.activation = [act.cost, C.abilityActivationTypes[act.type]].filterJoin(" ");

			// Target Label
			let tgt = data.target || {};
			if (["none", "touch", "self"].includes(tgt.units)) tgt.value = null;
			if (["none", "self"].includes(tgt.type)) {
				tgt.value = null;
				tgt.units = null;
			}
			labels.target = [tgt.value, C.distanceUnits[tgt.units], C.targetTypes[tgt.type]].filterJoin(" ");

			// Range Label
			let rng = data.range || {};
			if (["none", "touch", "self"].includes(rng.units)) {
				rng.value = null;
				rng.long = null;
			}
			labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");

			// Duration Label
			let dur = data.duration || {};
			if (["inst", "perm"].includes(dur.units)) dur.value = null;
			labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");

			// Recharge Label
			let chg = data.recharge || {};
			labels.recharge = `${game.i18n.localize("TRPG.Recharge")} [${chg.value}${parseInt(chg.value) < 6 ? "+" : ""}]`;
		}

		// Item Actions
		if (data.hasOwnProperty("actionType")) {
			// Damage
			let dam = data.damage || {};
			if (dam.parts) {
				labels.damage = dam.parts
					.map((d) => d[0])
					.join(" + ")
					.replace(/\+ -/g, "- ");
				labels.damageTypes = dam.parts.map((d) => C.damageTypes[d[1]]).join(", ");
			}
		}

		// if this item is owned, we prepareFinalAttributes() at the end of actor init
		if (!this.isOwned) this.prepareFinalAttributes();
	}

	/* -------------------------------------------- */

	/**
	 * Prepare derived data for an equipment-type item and define labels.
	 * @protected
	 */
	_prepareEquipment() {
		this.labels.armor = this.system.armor.value ? `${this.system.armor.value} ${game.i18n.localize("DND5E.AC")}` : "";
	}

	/* -------------------------------------------- */

	/**
	 * Prepare derived data for a feat-type item and define labels.
	 * @protected
	 */
	_prepareFeat() {
		const act = this.system.activation;
		const types = CONFIG.TRPG.abilityActivationTypes;
		if (act?.type) {
			this.labels.featType = game.i18n.localize(this.system.damage.length ? "TRPG.Attack" : "TRPG.Action");
		} else this.labels.featType = game.i18n.localize("TRPG.Passive");
	}

	/* -------------------------------------------- */

	/**
	 * Prepare derived data for a spell-type item and define labels.
	 * @protected
	 */
	_prepareSpell() {
		const attributes = { ...CONFIG.TRPG.spellComponents };
		this.system.preparation.mode ||= "prepared";
		this.labels.level = CONFIG.TRPG.spellLevels[this.system.level];
		this.labels.school = CONFIG.TRPG.spellSchools[this.system.school];
		this.labels.components = Object.entries(this.system.components).reduce(
			(obj, [c, active]) => {
				const config = attributes[c];
				if (!config || active !== true) return obj;
				obj.all.push({ abbr: config.abbr, tag: config.tag });
				if (config.tag) obj.tags.push(config.label);
				else obj.vsm.push(config.abbr);
				return obj;
			},
			{ all: [], vsm: [], tags: [] }
		);
		this.labels.components.vsm = new Intl.ListFormat(game.i18n.lang, {
			style: "narrow",
			type: "conjunction",
		}).format(this.labels.components.vsm);
		this.labels.materials = this.system?.materials?.value ?? null;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare derived data for activated items and define labels.
	 * @protected
	 */
	_prepareActivation() {
		if (!("activation" in this.system)) return;
		const C = CONFIG.TRPG;

		// Ability Activation Label
		const act = this.system.activation ?? {};
		this.labels.activation = [act.cost, C.abilityActivationTypes[act.type]].filterJoin(" ");

		// Target Label
		let tgt = this.system.target ?? {};
		if (["none", "touch", "self"].includes(tgt.units)) tgt.value = null;
		if (["none", "self"].includes(tgt.type)) {
			tgt.value = null;
			tgt.units = null;
		}
		this.labels.target = [tgt.value, C.distanceUnits[tgt.units], C.targetTypes[tgt.type]].filterJoin(" ");

		// Range Label
		let rng = this.system.range ?? {};
		if (["none", "touch", "self"].includes(rng.units)) {
			rng.value = null;
			rng.long = null;
		}
		this.labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");

		// Duration Label
		let dur = this.system.duration ?? {};
		if (["inst", "perm"].includes(dur.units)) dur.value = null;
		this.labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");

		// Recharge Label
		let chg = this.system.recharge ?? {};
		const chgSuffix = `${chg.value}${parseInt(chg.value) < 6 ? "+" : ""}`;
		this.labels.recharge = `${game.i18n.localize("TRPG.Recharge")} [${chgSuffix}]`;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare derived data and labels for items which have an action which deals damage.
	 * @protected
	 */
	_prepareAction() {
		if (!("actionType" in this.system)) return;
		let dmg = this.system.damage || {};
		if (dmg.parts) {
			const types = CONFIG.TRPG.damageTypes;
			this.labels.damage = dmg.parts
				.map((d) => d[0])
				.join(" + ")
				.replace(/\+ -/g, "- ");
			this.labels.damageTypes = dmg.parts.map((d) => types[d[1]]).join(", ");
		}
	}

	/* -------------------------------------------- */

	/**
	 * Prepare advancement objects from stored advancement data.
	 * @protected
	 */
	_prepareAdvancement() {
		const minAdvancementLevel = ["class", "subclass"].includes(this.type) ? 1 : 0;
		this.advancement = {
			byId: {},
			byLevel: Object.fromEntries(
				Array.fromRange(CONFIG.TRPG.maxLevel + 1)
					.slice(minAdvancementLevel)
					.map((l) => [l, []])
			),
			byType: {},
			needingConfiguration: [],
		};
		for (const advancementData of this.system.advancement ?? []) {
			const Advancement = game.trpg.advancement.types[`${advancementData.type}Advancement`];
			if (!Advancement) continue;
			const advancement = new Advancement(this, advancementData);
			this.advancement.byId[advancement.id] = advancement;
			this.advancement.byType[advancementData.type] ??= [];
			this.advancement.byType[advancementData.type].push(advancement);
			advancement.levels.forEach((l) => this.advancement.byLevel[l].push(advancement));
			if (!advancement.levels.length) this.advancement.needingConfiguration.push(advancement);
		}
		Object.entries(this.advancement.byLevel).forEach(([lvl, data]) =>
			data.sort((a, b) => {
				return a.sortingValueForLevel(lvl).localeCompare(b.sortingValueForLevel(lvl));
			})
		);
	}

	/* -------------------------------------------- */

	/**
	 * Compute item attributes which might depend on prepared actor data.
	 */
	prepareFinalAttributes() {
		if (this.system.hasOwnProperty("actionType")) {
			// Saving throws
			this.getSaveDC();

			// To Hit
			this.getAttackToHit();

			// Limited Uses
			this.prepareMaxUses();

			// Damage Label
			this.getDerivedDamageLabel();
		}
	}

	/* -------------------------------------------- */

	/**
	 * Populate a label with the compiled and simplified damage formula
	 * based on owned item actor data. This is only used for display
	 * purposes and is not related to Item5e#rollDamage
	 *
	 * @returns {Array} array of objects with `formula` and `damageType`
	 */
	getDerivedDamageLabel() {
		const itemData = this.system;
		if (!this.hasDamage || !itemData || !this.isOwned) return [];

		const rollData = this.getRollData();

		const derivedDamage = itemData.damage?.parts?.map((damagePart) => ({
			formula: simplifyRollFormula(damagePart[0], rollData, { constantFirst: false }),
			damageType: damagePart[1],
		}));

		this.labels.derivedDamage = derivedDamage;

		return derivedDamage;
	}

	/* -------------------------------------------- */

	/**
	 * Update the derived spell DC for an item that requires a saving throw
	 * @returns {number|null}
	 */
	getSaveDC() {
		if (!this.hasSave) return;
		const save = this.system?.save;

		// Actor spell-DC based scaling
		if (save.scaling === "spell") {
			save.dc = this.isOwned ? foundry.utils.getProperty(this.actor, "system.attributes.spelldc") + (this.system.level ?? 0) : null;
		}

		// Ability-score based scaling
		else if (save.scaling !== "flat") {
			save.dc = this.isOwned ? foundry.utils.getProperty(this.actor, `system.abilities.${save.scaling}.dc`) + (this.system.level ?? 0) : null;
		}

		// Update labels
		const abl = CONFIG.TRPG.saves[save.ability];
		this.labels.save = game.i18n.format("TRPG.SaveDC", { dc: save.dc || "", ability: abl });
		return save.dc;
	}

	/* -------------------------------------------- */

	/**
	 * Update a label to the Item detailing its total to hit bonus.
	 * Sources:
	 * - item entity's innate attack bonus
	 * - item's actor's proficiency bonus if applicable
	 * - item's actor's global bonuses to the given item type
	 * - item's ammunition if applicable
	 *
	 * @returns {Object} returns `rollData` and `parts` to be used in the item's Attack roll
	 */
	getAttackToHit() {
		const itemData = this.system;
		if (!this.hasAttack || !itemData) return;
		const rollData = this.getRollData();

		// Define Roll bonuses
		const parts = [];

		// Include the item's innate attack bonus as the initial value and label
		if (itemData.attackBonus) {
			parts.push(itemData.attackBonus);
			this.labels.toHit = itemData.attackBonus;
		}

		// Take no further action for un-owned items
		if (!this.isOwned) return { rollData, parts };

		// Ability score modifier
		parts.push(`@mod`);

		// Add proficiency bonus if an explicit proficiency flag is present or for non-item features
		if (rollData.attributes.bab.total !== 0 && rollData.attributes.bab.total != null) {
			parts.push("@attributes.bab.total");
		}
		if (itemData.proficient != undefined && !itemData.proficient) {
			parts.push("-4");
		}

		// Actor-level global bonus to attack rolls
		const actorBonus = this.actor.system.bonuses?.[itemData.actionType] || {};
		if (actorBonus.attack) parts.push(actorBonus.attack);

		// One-time bonus provided by consumed ammunition
		if (itemData.consume?.type === "ammo" && !!this.actor.items) {
			const ammoItemData = this.actor.items.get(itemData.consume.target);

			if (ammoItemData) {
				const ammoItemQuantity = ammoItemData.system.quantity;
				const ammoCanBeConsumed = ammoItemQuantity && ammoItemQuantity - (itemData.consume.amount ?? 0) >= 0;
				const ammoItemAttackBonus = ammoItemData.systemattackBonus;
				const ammoIsTypeConsumable = ammoItemData.type === "consumable" && ammoItemData.systemconsumableType === "ammo";
				if (ammoCanBeConsumed && ammoItemAttackBonus && ammoIsTypeConsumable) {
					parts.push("@ammo");
					rollData["ammo"] = ammoItemAttackBonus;
				}
			}
		}

		// Condense the resulting attack bonus formula into a simplified label
		let toHitLabel = simplifyRollFormula(parts.join("+"), rollData).trim();
		if (toHitLabel.charAt(0) !== "-") {
			toHitLabel = "+ " + toHitLabel;
		}
		this.labels.toHit = toHitLabel;

		// Update labels and return the prepared roll data
		return { rollData, parts };
	}

	/* -------------------------------------------- */

	/**
	 * Populates the max uses of an item.
	 * If the item is an owned item and the `max` is not numeric, calculate based on actor data.
	 */
	prepareMaxUses() {
		const data = this.system;
		if (!data.uses?.max) return;
		let max = data.uses.max;

		// if this is an owned item and the max is not numeric, we need to calculate it
		if (this.isOwned && !Number.isNumeric(max)) {
			if (this.actor.system === undefined) return;
			try {
				max = Roll.replaceFormulaData(max, this.actor.getRollData(), { missing: 0, warn: true });
				max = Roll.safeEval(max);
			} catch (e) {
				console.error("Problem preparing Max uses for", this.name, e);
				return;
			}
		}
		data.uses.max = Number(max);
	}

	/* -------------------------------------------- */

	/**
	 * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
	 * @param {boolean} [configureDialog]     Display a configuration dialog for the item roll, if applicable?
	 * @param {string} [rollMode]             The roll display mode with which to display (or not) the card
	 * @param {boolean} [createMessage]       Whether to automatically create a chat message (if true) or simply return
	 *                                        the prepared chat message data (if false).
	 * @return {Promise<ChatMessage|object|void>}
	 */
	async roll({ configureDialog = true, rollMode, createMessage = true } = {}) {
		let item = this;
		const id = this.system; // Item system data
		const actor = this.actor;
		const ad = actor.system; // Actor system data

		// Reference aspects of the item data necessary for usage
		const hasArea = this.hasAreaTarget; // Is the ability usage an AoE?
		const resource = id.consume || {}; // Resource consumption
		const recharge = id.recharge || {}; // Recharge mechanic
		const uses = id?.uses ?? {}; // Limited uses
		const isSpell = this.type === "spell"; // Does the item require a spell slot?
		const requireSpellSlot = false; //isSpell && (id.level > 0) && CONFIG.TRPG.spellUpcastModes.includes(id.preparation.mode);

		// Define follow-up actions resulting from the item usage
		let createMeasuredTemplate = hasArea; // Trigger a template creation
		let consumeRecharge = !!recharge.value; // Consume recharge
		let consumeResource = !!resource.target && resource.type !== "ammo"; // Consume a linked (non-ammo) resource
		let consumeSpellSlot = requireSpellSlot; // Consume a spell slot
		let consumeUsage = !!uses.per; // Consume limited uses
		let consumeQuantity = uses.autoDestroy; // Consume quantity of the item in lieu of uses
		let consumeSpellLevel = null; // Consume a specific category of spell slot
		if (requireSpellSlot) consumeSpellLevel = `spell${id.level}`;

		// Display a configuration dialog to customize the usage
		const needsConfiguration = createMeasuredTemplate || consumeRecharge || consumeResource || consumeSpellSlot || consumeUsage;
		if (configureDialog && needsConfiguration) {
			const configuration = await AbilityUseDialog.create(this);
			if (!configuration) return;

			// Determine consumption preferences
			createMeasuredTemplate = Boolean(configuration.placeTemplate);
			consumeUsage = Boolean(configuration.consumeUse);
			consumeRecharge = Boolean(configuration.consumeRecharge);
			consumeResource = Boolean(configuration.consumeResource);
			consumeSpellSlot = Boolean(configuration.consumeSlot);

			// Handle spell upcasting
			if (requireSpellSlot) {
				consumeSpellLevel = `spell${configuration.level}`;
				if (consumeSpellSlot === false) consumeSpellLevel = null;
				const upcastLevel = parseInt(configuration.level);
				if (upcastLevel !== id.level) {
					item = this.clone({ "system.level": upcastLevel }, { keepId: true });
					item.update({ _id: this.id }); // Retain the original ID (needed until 0.8.2+)
					item.prepareFinalAttributes(); // Spell save DC, etc...
				}
			}
		}

		// Determine whether the item can be used by testing for resource consumption
		const usage = item._getUsageUpdates({
			consumeRecharge,
			consumeResource,
			consumeSpellLevel,
			consumeUsage,
			consumeQuantity,
		});
		if (!usage) return;
		const { actorUpdates, itemUpdates, resourceUpdates } = usage;

		// Commit pending data updates
		if (!foundry.utils.isEmpty(itemUpdates)) await item.update(itemUpdates);
		if (consumeQuantity && item.system.quantity === 0) await item.delete();
		if (!foundry.utils.isEmpty(actorUpdates)) await actor.update(actorUpdates);
		if (!foundry.utils.isEmpty(resourceUpdates)) {
			const resource = actor.items.get(id.consume?.target);
			if (resource) await resource.update(resourceUpdates);
		}

		// Initiate measured template creation
		if (createMeasuredTemplate) {
			const template = game.trpg.canvas.AbilityTemplate.fromItem(item);
			if (template) template.drawPreview();
		}

		// Create or return the Chat Message data
		return item.displayCard({ rollMode, createMessage });
	}

	/* -------------------------------------------- */

	/**
	 * Verify that the consumed resources used by an Item are available.
	 * Otherwise display an error and return false.
	 * @param {boolean} consumeQuantity     Consume quantity of the item if other consumption modes are not available?
	 * @param {boolean} consumeRecharge     Whether the item consumes the recharge mechanic
	 * @param {boolean} consumeResource     Whether the item consumes a limited resource
	 * @param {string|null} consumeSpellLevel The category of spell slot to consume, or null
	 * @param {boolean} consumeUsage        Whether the item consumes a limited usage
	 * @returns {object|boolean}            A set of data changes to apply when the item is used, or false
	 * @private
	 */
	_getUsageUpdates({ consumeQuantity, consumeRecharge, consumeResource, consumeSpellLevel, consumeUsage }) {
		// Reference item data
		const id = this.system;
		const actorUpdates = {};
		const itemUpdates = {};
		const resourceUpdates = {};

		// Consume Recharge
		if (consumeRecharge) {
			const recharge = id.recharge || {};
			if (recharge.charged === false) {
				ui.notifications.warn(game.i18n.format("TRPG.ItemNoUses", { name: this.name }));
				return false;
			}
			itemUpdates["system.recharge.charged"] = false;
		}

		// Consume Limited Resource
		if (consumeResource) {
			const canConsume = this._handleConsumeResource(itemUpdates, actorUpdates, resourceUpdates);
			if (canConsume === false) return false;
		}

		// Consume Spell Slots
		if (consumeSpellLevel) {
			if (Number.isNumeric(consumeSpellLevel)) consumeSpellLevel = `spell${consumeSpellLevel}`;
			const level = this.actor?.system.spells[consumeSpellLevel];
			const spells = Number(level?.value ?? 0);
			if (spells === 0) {
				const label = game.i18n.localize(`TRPG.SpellLevel${id.level}`);
				ui.notifications.warn(game.i18n.format("TRPG.SpellCastNoSlots", { name: this.name, level: label }));
				return false;
			}
			actorUpdates[`system.spells.${consumeSpellLevel}.value`] = Math.max(spells - 1, 0);
		}

		// Consume Limited Usage
		if (consumeUsage) {
			const uses = id.uses || {};
			const available = Number(uses.value ?? 0);
			let used = false;

			// Reduce usages
			const remaining = Math.max(available - 1, 0);
			if (available >= 1) {
				used = true;
				itemUpdates["system.uses.value"] = remaining;
			}

			// Reduce quantity if not reducing usages or if usages hit 0 and we are set to consumeQuantity
			if (consumeQuantity && (!used || remaining === 0)) {
				const q = Number(id.quantity ?? 1);
				if (q >= 1) {
					used = true;
					itemUpdates["system.quantity"] = Math.max(q - 1, 0);
					itemUpdates["system.uses.value"] = uses.max ?? 1;
				}
			}

			// If the item was not used, return a warning
			if (!used) {
				ui.notifications.warn(game.i18n.format("TRPG.ItemNoUses", { name: this.name }));
				return false;
			}
		}

		// Return the configured usage
		return { itemUpdates, actorUpdates, resourceUpdates };
	}

	/* -------------------------------------------- */

	/**
	 * Handle update actions required when consuming an external resource
	 * @param {object} itemUpdates        An object of data updates applied to this item
	 * @param {object} actorUpdates       An object of data updates applied to the item owner (Actor)
	 * @param {object} resourceUpdates    An object of data updates applied to a different resource item (Item)
	 * @return {boolean|void}             Return false to block further progress, or return nothing to continue
	 * @private
	 */
	_handleConsumeResource(itemUpdates, actorUpdates, resourceUpdates) {
		const actor = this.actor;
		const itemData = this.system;
		const consume = itemData.consume || {};
		if (!consume.type) return;

		// No consumed target
		const typeLabel = CONFIG.TRPG.abilityConsumptionTypes[consume.type];
		if (!consume.target) {
			ui.notifications.warn(game.i18n.format("TRPG.ConsumeWarningNoResource", { name: this.name, type: typeLabel }));
			return false;
		}

		// Identify the consumed resource and its current quantity
		let resource = null;
		let amount = Number(consume.amount ?? 1);
		let quantity = 0;
		switch (consume.type) {
			case "attribute":
				resource = foundry.utils.getProperty(actor.system, consume.target);
				quantity = resource || 0;
				break;
			case "ammo":
			case "material":
				resource = actor.items.get(consume.target);
				quantity = resource ? resource.system.quantity : 0;
				break;
			case "charges":
				resource = actor.items.get(consume.target);
				if (!resource) break;
				const uses = resource.system.uses;
				if (uses.per && uses.max) quantity = uses.value;
				else if (resource.system.recharge?.value) {
					quantity = resource.system.recharge.charged ? 1 : 0;
					amount = 1;
				}
				break;
		}

		// Verify that a consumed resource is available
		if (!resource) {
			ui.notifications.warn(game.i18n.format("TRPG.ConsumeWarningNoSource", { name: this.name, type: typeLabel }));
			return false;
		}

		// Verify that the required quantity is available
		let remaining = quantity - amount;
		if (remaining < 0) {
			ui.notifications.warn(game.i18n.format("TRPG.ConsumeWarningNoQuantity", { name: this.name, type: typeLabel }));
			return false;
		}

		// Define updates to provided data objects
		switch (consume.type) {
			case "attribute":
				actorUpdates[`system.${consume.target}`] = remaining;
				break;
			case "ammo":
			case "material":
				resourceUpdates["system.quantity"] = remaining;
				break;
			case "charges":
				const uses = resource.system.uses || {};
				const recharge = resource.system.recharge || {};
				if (uses.per && uses.max) resourceUpdates["system.uses.value"] = remaining;
				else if (recharge.value) resourceUpdates["system.recharge.charged"] = false;
				break;
		}
	}

	/* -------------------------------------------- */

	/**
	 * Display the chat card for an Item as a Chat Message
	 * @param {object} options          Options which configure the display of the item chat card
	 * @param {string} rollMode         The message visibility mode to apply to the created card
	 * @param {boolean} createMessage   Whether to automatically create a ChatMessage entity (if true), or only return
	 *                                  the prepared message data (if false)
	 */
	async displayCard({ rollMode, createMessage = true } = {}) {
		// Render the chat card template
		const token = this.actor.token;
		const templateData = {
			actor: this.actor,
			tokenId: token?.uuid || null,
			item: this,
			system: await this.getChatData(),
			labels: this.labels,
			hasAttack: this.hasAttack,
			isHealing: this.isHealing,
			hasDamage: this.hasDamage,
			isVersatile: this.isVersatile,
			isSpell: this.type === "spell",
			hasSave: this.hasSave,
			hasAreaTarget: this.hasAreaTarget,
			isTool: this.type === "tool",
		};
		const html = await renderTemplate("systems/trpg/templates/chat/item-card.html", templateData);

		// Create the ChatMessage data object
		const chatData = {
			user: game.user.id,
			content: html,
			flavor: this.system.chatFlavor || this.name,
			speaker: ChatMessage.getSpeaker({ actor: this.actor, token }),
			flags: { "core.canPopout": true },
		};

		// If the Item was destroyed in the process of displaying its card - embed the item data in the chat message
		if (this.type === "consumable" && !this.actor.items.has(this.id)) {
			chatData.flags["trpg.itemData"] = this.data;
		}

		// Apply the roll mode to adjust message visibility
		ChatMessage.applyRollMode(chatData, rollMode || game.settings.get("core", "rollMode"));

		// Create the Chat Message or return its data
		return createMessage ? ChatMessage.create(chatData) : chatData;
	}

	/* -------------------------------------------- */
	/*  Chat Cards																	*/
	/* -------------------------------------------- */

	/**
	 * Prepare an object of chat data used to display a card for the Item in the chat log
	 * @param {Object} htmlOptions    Options used by the TextEditor.enrichHTML function
	 * @return {Object}               An object of chat data to render
	 */
	async getChatData(htmlOptions = {}) {
		const data = this.toObject().system;
		const labels = this.labels;

		// Rich text description
		data.description.value = await TextEditor.enrichHTML(data.description.value, {
			async: true,
			relativeTo: this,
			...htmlOptions,
		});

		// Item type specific properties
		const props = [];
		const fn = this[`_${this.type}ChatData`];
		if (fn) fn.bind(this)(data, labels, props);

		// Equipment properties
		if (data.hasOwnProperty("equipped") && !["loot", "tool"].includes(this.type)) {
			if (data.attunement === CONFIG.TRPG.attunementTypes.REQUIRED) props.push(game.i18n.localize(CONFIG.TRPG.attunements[CONFIG.TRPG.attunementTypes.REQUIRED]));
			props.push(game.i18n.localize(data.equipped ? "TRPG.Equipped" : "TRPG.Unequipped"), game.i18n.localize(data.proficient ? "TRPG.Proficient" : "TRPG.NotProficient"));
		}

		// Ability activation properties
		if (data.hasOwnProperty("activation")) {
			props.push(labels.activation + (data.activation?.condition ? ` (${data.activation.condition})` : ""), labels.target, labels.range, labels.duration);
		}

		// Filter properties and return
		data.properties = props.filter((p) => !!p);
		return data;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare chat card data for equipment type items
	 * @private
	 */
	_equipmentChatData(data, labels, props) {
		props.push(CONFIG.TRPG.equipmentTypes[data.armor.type], labels.armor || null, data.stealth ? `PDA: ${data.stealth}` : null);
	}

	/* -------------------------------------------- */

	/**
	 * Prepare chat card data for weapon type items
	 * @private
	 */
	_weaponChatData(data, labels, props) {
		props.push(CONFIG.TRPG.weaponTypes[data.weaponType]);
	}

	/* -------------------------------------------- */

	/**
	 * Prepare chat card data for consumable type items
	 * @private
	 */
	_consumableChatData(data, labels, props) {
		props.push(CONFIG.TRPG.consumableTypes[data.consumableType], data.uses.value + "/" + data.uses.max + " " + game.i18n.localize("TRPG.Charges"));
		data.hasCharges = data.uses.value >= 0;
	}

	/* -------------------------------------------- */

	/**
	 * Prepare chat card data for tool type items
	 * @private
	 */
	_toolChatData(data, labels, props) {
		props.push(CONFIG.TRPG.abilities[data.ability] || null, CONFIG.TRPG.proficiencyLevels[data.proficient || 0]);
	}

	/* -------------------------------------------- */

	/**
	 * Prepare chat card data for tool type items
	 * @private
	 */
	_lootChatData(data, labels, props) {
		props.push(game.i18n.localize("TRPG.ItemTypeLoot"), data.weight ? data.weight + " " + game.i18n.localize("TRPG.AbbreviationLbs") : null);
	}

	/* -------------------------------------------- */

	/**
	 * Render a chat card for Spell type data
	 * @return {Object}
	 * @private
	 */
	_spellChatData(data, labels, props) {
		props.push(labels.level);
	}

	/* -------------------------------------------- */

	/**
	 * Prepare chat card data for items of the "Feat" type
	 * @private
	 */
	_featChatData(data, labels, props) {
		props.push(data.requirements);
	}

	/* -------------------------------------------- */
	/*  Item Rolls - Attack, Damage, Saves, Checks  */
	/* -------------------------------------------- */

	/**
	 * Place an attack roll using an item (weapon, feat, spell, or equipment)
	 * Rely upon the d20Roll logic for the core implementation
	 *
	 * @param {object} options        Roll options which are configured and provided to the d20Roll function
	 * @return {Promise<Roll|null>}   A Promise which resolves to the created Roll instance
	 */
	async rollAttack(options = {}) {
		const itemData = this.system;
		const flags = this.actor.flags.trpg || {};
		if (!this.hasAttack) {
			throw new Error("You may not place an Attack Roll with this Item.");
		}
		let title = `${this.name} - ${game.i18n.localize("TRPG.AttackRoll")}`;

		// get the parts and rollData for this item's attack
		const { parts, rollData } = this.getAttackToHit();

		// Handle ammunition consumption
		delete this._ammo;
		let ammo = null;
		let ammoUpdate = null;
		const consume = itemData.consume;
		if (consume?.type === "ammo") {
			ammo = this.actor.items.get(consume.target);
			if (ammo?.data) {
				const q = ammo.system.quantity;
				const consumeAmount = consume.amount ?? 0;
				if (q && q - consumeAmount >= 0) {
					this._ammo = ammo;
					title += ` [${ammo.name}]`;
				}
			}

			// Get pending ammunition update
			const usage = this._getUsageUpdates({ consumeResource: true });
			if (usage === false) return null;
			ammoUpdate = usage.resourceUpdates || {};
		}

		// Compose roll options
		let rollConfig = {
			parts: parts,
			actor: this.actor,
			data: rollData,
			title: title,
			flavor: title,
			dialogOptions: {
				width: 400,
				top: options.event ? options.event.clientY - 80 : null,
				left: window.innerWidth - 710,
			},
			messageData: {
				"flags.trpg.roll": { type: "attack", itemId: this.id },
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			},
		};

		// Expanded critical hit thresholds
		if (this.type === "weapon" || this.type === "spell") {
			rollConfig.critical = itemData.critical.threshold;
		}

		// Elven Accuracy
		if (flags.elvenAccuracy && ["dex", "int", "wis", "cha"].includes(this.abilityMod)) {
			rollConfig.elvenAccuracy = true;
		}

		// Apply Halfling Lucky
		if (flags.halflingLucky) rollConfig.halflingLucky = true;

		// Compose calculated roll options with passed-in roll options
		rollConfig = foundry.utils.mergeObject(rollConfig, options);

		// Invoke the d20 roll helper
		const roll = await d20Roll(rollConfig);
		if (roll === false) return null;

		// Commit ammunition consumption on attack rolls resource consumption if the attack roll was made
		if (ammo && !foundry.utils.isEmpty(ammoUpdate)) await ammo.update(ammoUpdate);
		return roll;
	}

	/* -------------------------------------------- */

	/**
	 * Place a damage roll using an item (weapon, feat, spell, or equipment)
	 * Rely upon the damageRoll logic for the core implementation.
	 * @param {MouseEvent} [event]    An event which triggered this roll, if any
	 * @param {boolean} [critical]    Should damage be rolled as a critical hit?
	 * @param {number} [spellLevel]   If the item is a spell, override the level for damage scaling
	 * @param {boolean} [versatile]   If the item is a weapon, roll damage using the versatile formula
	 * @param {object} [options]      Additional options passed to the damageRoll function
	 * @return {Promise<Roll>}        A Promise which resolves to the created Roll instance
	 */
	rollDamage({ critical = false, event = null, spellLevel = null, versatile = false, options = {} } = {}) {
		if (!this.hasDamage) throw new Error("You may not make a Damage Roll with this Item.");
		const itemData = this.system;
		const actorData = this.actor.system;
		const messageData = { "flags.trpg.roll": { type: "damage", itemId: this.id } };

		// Get roll data
		const parts = itemData.damage.parts.map((d) => d[0]);
		const rollData = this.getRollData();
		if (spellLevel) rollData.item.level = spellLevel;

		// Configure the damage roll
		const actionFlavor = game.i18n.localize(itemData.actionType === "heal" ? "TRPG.Healing" : "TRPG.DamageRoll");
		const title = `${this.name} - ${actionFlavor}`;
		const rollConfig = {
			actor: this.actor,
			critical: critical ?? event?.altKey ?? false,
			data: rollData,
			event: event,
			fastForward: event ? !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey : false,
			parts: parts,
			title: title,
			flavor: this.labels.damageTypes.length ? `${title} (${this.labels.damageTypes})` : title,
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			dialogOptions: {
				width: 400,
				top: event ? event.clientY - 80 : null,
				left: window.innerWidth - 710,
			},
			messageData: messageData,
		};

		// Adjust damage from versatile usage
		if (versatile && itemData.damage.versatile) {
			parts[0] = itemData.damage.versatile;
			messageData["flags.trpg.roll"].versatile = true;
		}

		if (this.type === "weapon" || this.type === "spell") {
			rollConfig.criticalMultiplier = itemData.critical.multiplier;
		}

		// Scale damage from up-casting spells
		if (this.type === "spell") {
			if (itemData.scaling.mode === "cantrip") {
				let level;
				if (this.actor.type === "character") level = actorData.details.level;
				else if (itemData.preparation.mode === "innate") level = Math.ceil(actorData.details.cr);
				else level = actorData.details.spellLevel;
				this._scaleCantripDamage(parts, itemData.scaling.formula, level, rollData);
			} else if (spellLevel && itemData.scaling.mode === "level" && itemData.scaling.formula) {
				const scaling = itemData.scaling.formula;
				this._scaleSpellDamage(parts, itemData.level, spellLevel, scaling, rollData);
			}
		}

		// Add damage bonus formula
		const actorBonus = foundry.utils.getProperty(actorData, `bonuses.${itemData.actionType}`) || {};
		if (actorBonus.damage && parseInt(actorBonus.damage) !== 0) {
			parts.push(actorBonus.damage);
		}

		// Handle ammunition damage
		const ammoData = this._ammo?.system;

		// only add the ammunition damage if the ammution is a consumable with type 'ammo'
		if (this._ammo && ammoData.type === "consumable" && ammoData.consumableType === "ammo") {
			parts.push("@ammo");
			rollData["ammo"] = ammoData.damage.parts.map((p) => p[0]).join("+");
			rollConfig.flavor += ` [${this._ammo.name}]`;
			delete this._ammo;
		}

		// Call the roll helper utility
		return damageRoll(foundry.utils.mergeObject(rollConfig, options));
	}

	/* -------------------------------------------- */

	/**
	 * Adjust a cantrip damage formula to scale it for higher level characters and monsters
	 * @private
	 */
	_scaleCantripDamage(parts, scale, level, rollData) {
		const add = Math.floor((level + 1) / 6);
		if (add === 0) return;
		this._scaleDamage(parts, scale || parts.join(" + "), add, rollData);
	}

	/* -------------------------------------------- */

	/**
	 * Adjust the spell damage formula to scale it for spell level up-casting
	 * @param {Array} parts         The original damage parts
	 * @param {number} baseLevel    The default spell level
	 * @param {number} spellLevel   The casted spell level
	 * @param {string} formula      The scaling formula
	 * @param {object} rollData     A data object that should be applied to the scaled damage roll
	 * @return {string[]}           The scaled roll parts
	 * @private
	 */
	_scaleSpellDamage(parts, baseLevel, spellLevel, formula, rollData) {
		const upcastLevels = Math.max(spellLevel - baseLevel, 0);
		if (upcastLevels === 0) return parts;
		this._scaleDamage(parts, formula, upcastLevels, rollData);
	}

	/* -------------------------------------------- */

	/**
	 * Scale an array of damage parts according to a provided scaling formula and scaling multiplier
	 * @param {string[]} parts    Initial roll parts
	 * @param {string} scaling    A scaling formula
	 * @param {number} times      A number of times to apply the scaling formula
	 * @param {object} rollData   A data object that should be applied to the scaled damage roll
	 * @return {string[]}         The scaled roll parts
	 * @private
	 */
	_scaleDamage(parts, scaling, times, rollData) {
		if (times <= 0) return parts;
		const p0 = new Roll(parts[0], rollData);
		const s = new Roll(scaling, rollData).alter(times);

		// Attempt to simplify by combining like dice terms
		let simplified = false;
		if (s.terms[0] instanceof Die && s.terms.length === 1) {
			const d0 = p0.terms[0];
			const s0 = s.terms[0];
			if (d0 instanceof Die && d0.faces === s0.faces && d0.modifiers.equals(s0.modifiers)) {
				d0.number += s0.number;
				parts[0] = p0.formula;
				simplified = true;
			}
		}

		// Otherwise add to the first part
		if (!simplified) {
			parts[0] = `${parts[0]} + ${s.formula}`;
		}
		return parts;
	}

	/* -------------------------------------------- */

	/**
	 * Place an attack roll using an item (weapon, feat, spell, or equipment)
	 * Rely upon the d20Roll logic for the core implementation
	 *
	 * @return {Promise<Roll>}   A Promise which resolves to the created Roll instance
	 */
	async rollFormula({ spellLevel } = {}) {
		if (!this.system.formula) {
			throw new Error("This Item does not have a formula to roll!");
		}

		// Define Roll Data
		const rollData = this.getRollData();
		if (spellLevel) rollData.item.level = spellLevel;
		const title = `${this.name} - ${game.i18n.localize("TRPG.OtherFormula")}`;

		// Invoke the roll and submit it to chat
		const roll = await new Roll(rollData.item.formula, rollData).roll({ async: true });
		roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			flavor: title,
			rollMode: game.settings.get("core", "rollMode"),
			messageData: { "flags.trpg.roll": { type: "other", itemId: this.id } },
		});
		return roll;
	}

	/* -------------------------------------------- */

	/**
	 * Perform an ability recharge test for an item which uses the d6 recharge mechanic
	 * @return {Promise<Roll>}   A Promise which resolves to the created Roll instance
	 */
	async rollRecharge() {
		const data = this.system;
		if (!data.recharge.value) return;

		// Roll the check
		const roll = new Roll("1d6").roll({ async: true });
		const success = roll.total >= parseInt(data.recharge.value);

		// Display a Chat Message
		const promises = [
			roll.toMessage({
				flavor: `${game.i18n.format("TRPG.ItemRechargeCheck", { name: this.name })} - ${game.i18n.localize(
					success ? "TRPG.ItemRechargeSuccess" : "TRPG.ItemRechargeFailure"
				)}`,
				speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.actor.token }),
			}),
		];

		// Update the Item data
		if (success) promises.push(this.update({ "system.recharge.charged": true }));
		return Promise.all(promises).then(() => roll);
	}

	/* -------------------------------------------- */

	/**
	 * Roll a Tool Check. Rely upon the d20Roll logic for the core implementation
	 * @prarm {Object} options   Roll configuration options provided to the d20Roll function
	 * @return {Promise<Roll>}   A Promise which resolves to the created Roll instance
	 */
	rollToolCheck(options = {}) {
		if (this.type !== "tool") throw "Wrong item type!";

		// Prepare roll data
		let rollData = this.getRollData();
		const parts = [`@mod`, "@prof"];
		const title = `${this.name} - ${game.i18n.localize("TRPG.ToolCheck")}`;

		// Add global actor bonus
		const bonuses = foundry.utils.getProperty(this.actor.system, "bonuses.abilities") || {};
		if (bonuses.check) {
			parts.push("@checkBonus");
			rollData.checkBonus = bonuses.check;
		}

		// Compose the roll data
		const rollConfig = foundry.utils.mergeObject(
			{
				parts: parts,
				data: rollData,
				title: title,
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: title,
				dialogOptions: {
					width: 400,
					top: options.event ? options.event.clientY - 80 : null,
					left: window.innerWidth - 710,
				},
				chooseModifier: true,
				halflingLucky: this.actor.getFlag("trpg", "halflingLucky") || false,
				reliableTalent: this.system.proficient >= 1 && this.actor.getFlag("trpg", "reliableTalent"),
				messageData: { "flags.trpg.roll": { type: "tool", itemId: this.id } },
			},
			options
		);
		rollConfig.event = options.event;

		// Call the roll helper utility
		return d20Roll(rollConfig);
	}

	/* -------------------------------------------- */

	/**
	 * Prepare a data object which is passed to any Roll formulas which are created related to this Item
	 * @private
	 */
	getRollData() {
		if (!this.actor) return null;
		const rollData = this.actor.getRollData();
		rollData.item = foundry.utils.deepClone(this.system);

		// Include an ability score modifier if one exists
		const abl = this.abilityMod;
		if (abl) {
			const ability = rollData.abilities[abl];
			if (!ability) {
				console.warn(`Item ${this.name} in Actor ${this.actor.name} has an invalid item ability modifier of ${abl} defined`);
			}
			rollData["mod"] = ability?.mod || 0;
		}

		// Include a proficiency score
		const prof = "proficient" in rollData.item ? rollData.item.proficient || 0 : 1;
		rollData["prof"] = Math.floor(prof * (rollData.attributes.prof || 0));
		return rollData;
	}

	/* -------------------------------------------- */
	/*  Chat Message Helpers                        */
	/* -------------------------------------------- */

	static chatListeners(html) {
		html.on("click", ".card-buttons button", this._onChatCardAction.bind(this));
		html.on("click", ".item-name", this._onChatCardToggleContent.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * Handle execution of a chat card action via a click event on one of the card buttons
	 * @param {Event} event       The originating click event
	 * @returns {Promise}         A promise which resolves once the handler workflow is complete
	 * @private
	 */
	static async _onChatCardAction(event) {
		event.preventDefault();

		// Extract card data
		const button = event.currentTarget;
		button.disabled = true;
		const card = button.closest(".chat-card");
		const messageId = card.closest(".message").dataset.messageId;
		const message = game.messages.get(messageId);
		const action = button.dataset.action;

		// Validate permission to proceed with the roll
		const isTargetted = action === "save";
		if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

		// Recover the actor for the chat card
		const actor = await this._getChatCardActor(card);
		if (!actor) return;

		// Get the Item from stored flag data or by the item ID on the Actor
		const storedData = message.getFlag("trpg", "itemData");
		const item = storedData ? new this(storedData, { parent: actor }) : actor.items.get(card.dataset.itemId);
		if (!item) {
			return ui.notifications.error(game.i18n.format("TRPG.ActionWarningNoItem", { item: card.dataset.itemId, name: actor.name }));
		}
		const spellLevel = parseInt(card.dataset.spellLevel) || null;

		// Handle different actions
		switch (action) {
			case "attack":
				await item.rollAttack({ event });
				break;
			case "damage":
			case "versatile":
				await item.rollDamage({
					critical: event.altKey,
					event: event,
					spellLevel: spellLevel,
					versatile: action === "versatile",
				});
				break;
			case "formula":
				await item.rollFormula({ event, spellLevel });
				break;
			case "save":
				const targets = this._getChatCardTargets(card);
				for (let token of targets) {
					const speaker = ChatMessage.getSpeaker({ scene: canvas.scene, token: token });
					await token.actor.rollAbilitySave(button.dataset.ability, { event, speaker });
				}
				break;
			case "toolCheck":
				await item.rollToolCheck({ event });
				break;
			case "placeTemplate":
				const template = game.trpg.canvas.AbilityTemplate.fromItem(item);
				if (template) template.drawPreview();
				break;
		}

		// Re-enable the button
		button.disabled = false;
	}

	/* -------------------------------------------- */

	/**
	 * Handle toggling the visibility of chat card content when the name is clicked
	 * @param {Event} event   The originating click event
	 * @private
	 */
	static _onChatCardToggleContent(event) {
		event.preventDefault();
		const header = event.currentTarget;
		const card = header.closest(".chat-card");
		const content = card.querySelector(".card-content");
		content.style.display = content.style.display === "none" ? "block" : "none";
	}

	/* -------------------------------------------- */

	/**
	 * Get the Actor which is the author of a chat card
	 * @param {HTMLElement} card    The chat card being used
	 * @return {Actor|null}         The Actor entity or null
	 * @private
	 */
	static async _getChatCardActor(card) {
		// Case 1 - a synthetic actor from a Token
		if (card.dataset.tokenId) {
			const token = await fromUuid(card.dataset.tokenId);
			if (!token) return null;
			return token.actor;
		}

		// Case 2 - use Actor ID directory
		const actorId = card.dataset.actorId;
		return game.actors.get(actorId) || null;
	}

	/* -------------------------------------------- */

	/**
	 * Get the Actor which is the author of a chat card
	 * @param {HTMLElement} card    The chat card being used
	 * @return {Actor[]}            An Array of Actor entities, if any
	 * @private
	 */
	static _getChatCardTargets(card) {
		let targets = canvas.tokens.controlled.filter((t) => !!t.actor);
		if (!targets.length && game.user.character) targets = targets.concat(game.user.character.getActiveTokens());
		if (!targets.length) ui.notifications.warn(game.i18n.localize("TRPG.ActionWarningNoToken"));
		return targets;
	}

	/* -------------------------------------------- */
	/*  Event Handlers                              */
	/* -------------------------------------------- */

	/** @inheritdoc */
	async _preCreate(data, options, user) {
		await super._preCreate(data, options, user);

		if (!this.isEmbedded) return;
		const isNPC = this.parent.type === "npc";
		let updates;
		switch (data.type) {
			case "equipment":
				updates = this._onCreateOwnedEquipment(data, isNPC);
				break;
			case "weapon":
				updates = this._onCreateOwnedWeapon(data, isNPC);
				break;
			case "spell":
				updates = this._onCreateOwnedSpell(data, isNPC);
				break;
		}
		if (updates) return this.updateSource(updates);
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	_onCreate(data, options, userId) {
		super._onCreate(data, options, userId);

		// The below options are only needed for character classes
		if (userId !== game.user.id) return;
		const isCharacterClass = this.parent && this.type === "class";
		if (!isCharacterClass) return;

		// Assign a new primary class
		const pc = this.parent.items.get(this.parent.system.details.originalClass);
		if (!pc) this.parent._assignPrimaryClass();

		// Prompt to add new class features
		if (options.addFeatures === false) return;
		this.parent
			.getClassFeatures({
				className: this.name,
				subclassName: this.system.subclass,
				level: this.system.levels,
			})
			.then((features) => {
				return this.parent.addEmbeddedItems(features, options.promptAddFeatures);
			});
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	_onUpdate(changed, options, userId) {
		super._onUpdate(changed, options, userId);

		// The below options are only needed for character classes
		if (userId !== game.user.id) return;
		const isCharacterClass = this.parent && this.type === "class";
		if (!isCharacterClass) return;

		// Prompt to add new class features
		const addFeatures = changed["name"] || (changed.data && ["subclass", "levels"].some((k) => k in changed.data));
		if (!addFeatures || options.addFeatures === false) return;
		this.parent
			.getClassFeatures({
				className: changed.name || this.name,
				subclassName: changed.data?.subclass || this.system.subclass,
				level: changed.data?.levels || this.system.levels,
			})
			.then((features) => {
				return this.parent.addEmbeddedItems(features, options.promptAddFeatures);
			});
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	_onDelete(options, userId) {
		super._onDelete(options, userId);

		// Assign a new primary class
		if (this.parent && this.type === "class" && userId === game.user.id) {
			if (this.id !== this.parent.system.details.originalClass) return;
			this.parent._assignPrimaryClass();
		}
	}

	/* -------------------------------------------- */

	/**
	 * Pre-creation logic for the automatic configuration of owned equipment type Items
	 * @private
	 */
	_onCreateOwnedEquipment(data, isNPC) {
		const updates = {};
		if (foundry.utils.getProperty(data, "system.equipped") === undefined) {
			updates["system.equipped"] = isNPC; // NPCs automatically equip equipment
		}
		if (foundry.utils.getProperty(data, "system.proficient") === undefined) {
			if (isNPC) {
				updates["system.proficient"] = true; // NPCs automatically have equipment proficiency
			} else {
				const armorProf = CONFIG.TRPG.armorProficienciesMap[this.system.armor?.type]; // Player characters check proficiency
				const actorArmorProfs = this.parent.system.traits?.armorProf?.value || [];
				updates["system.proficient"] = armorProf === true || actorArmorProfs.includes(armorProf);
			}
		}
		return updates;
	}

	/* -------------------------------------------- */

	/**
	 * Pre-creation logic for the automatic configuration of owned spell type Items
	 * @private
	 */
	_onCreateOwnedSpell(data, isNPC) {
		const updates = {};
		if (foundry.utils.getProperty(data, "system.proficient") === undefined) {
			updates["system.prepared"] = isNPC; // NPCs automatically prepare spells
		}
		return updates;
	}

	/* -------------------------------------------- */

	/**
	 * Pre-creation logic for the automatic configuration of owned weapon type Items
	 * @private
	 */
	_onCreateOwnedWeapon(data, isNPC) {
		// NPCs automatically equip items and are proficient with them
		if (isNPC) {
			const updates = {};
			if (!foundry.utils.hasProperty(data, "system.equipped")) updates["system.equipped"] = true;
			if (!foundry.utils.hasProperty(data, "system.proficient")) updates["system.proficient"] = true;
			return updates;
		}
		if (data.system?.proficient !== undefined) return {};

		// Some weapon types are always proficient
		const weaponProf = CONFIG.TRPG.weaponProficienciesMap[this.system.weaponType];
		const updates = {};
		if (weaponProf === true) updates["system.proficient"] = true;
		else {
			const actorProfs = this.parent.system.traits?.weaponProf?.value || [];
			updates["system.proficient"] = actorProfs.includes(weaponProf) || actorProfs.includes(weaponProf);
		}
		return updates;
	}

	/* -------------------------------------------- */
	/*  Factory Methods                             */
	/* -------------------------------------------- */

	/**
	 * Create a consumable spell scroll Item from a spell Item.
	 * @param {Item5e} spell      The spell to be made into a scroll
	 * @return {Item5e}           The created scroll consumable item
	 */
	static async createScrollFromSpell(spell) {
		// Get spell data
		const itemData = spell instanceof Item5e ? spell.toObject() : spell;
		const { actionType, description, source, activation, duration, target, range, damage, save, level } = itemData.system;

		// Get scroll data
		const scrollUuid = `Compendium.${CONFIG.TRPG.sourcePacks.ITEMS}.${CONFIG.TRPG.spellScrollIds[level]}`;
		const scrollItem = await fromUuid(scrollUuid);
		const scrollData = scrollItem.system;
		delete scrollData._id;

		// Split the scroll description into an intro paragraph and the remaining details
		const scrollDescription = scrollData.description.value;
		const pdel = "</p>";
		const scrollIntroEnd = scrollDescription.indexOf(pdel);
		const scrollIntro = scrollDescription.slice(0, scrollIntroEnd + pdel.length);
		const scrollDetails = scrollDescription.slice(scrollIntroEnd + pdel.length);

		// Create a composite description from the scroll description and the spell details
		const desc = `${scrollIntro}<hr/><h3>${itemData.name} (Level ${level})</h3><hr/>${description.value}<hr/><h3>Scroll Details</h3><hr/>${scrollDetails}`;

		// Create the spell scroll data
		const spellScrollData = foundry.utils.mergeObject(scrollData, {
			name: `${game.i18n.localize("TRPG.SpellScroll")}: ${itemData.name}`,
			img: itemData.img,
			data: {
				"description.value": desc.trim(),
				source,
				actionType,
				activation,
				duration,
				target,
				range,
				damage,
				save,
				level,
			},
		});
		return new this(spellScrollData);
	}
}
