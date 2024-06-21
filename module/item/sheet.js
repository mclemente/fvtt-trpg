import ActiveEffect5e from "../active-effect.js";
import TraitSelector from "../apps/trait-selector.js";

/**
 * Override and extend the core ItemSheet implementation to handle specific item types
 * @extends {ItemSheet}
 */
export default class ItemSheet5e extends ItemSheet {
	constructor(...args) {
		super(...args);

		// Expand the default size of the class sheet
		if (this.object.type === "class") {
			this.options.width = this.position.width = 600;
			this.options.height = this.position.height = 680;
		}
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			width: 560,
			height: 400,
			classes: ["dnd5e", "sheet", "item"],
			resizable: true,
			scrollY: [".tab.details"],
			tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description" }],
		});
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	get template() {
		const path = "systems/trpg/templates/items/";
		return `${path}/${this.item.type}.html`;
	}

	/* -------------------------------------------- */

	/** @override */
	async getData(options) {
		const data = super.getData(options);
		const itemData = data.data;
		data.system = data.item.system;
		data.labels = this.item.labels;
		data.config = CONFIG.TRPG;
		data.idj = game.settings.get("trpg", "idjMode");

		// Item Type, Status, and Details
		data.itemType = game.i18n.localize(`TYPES.Item.${data.item.type}`);
		data.itemStatus = this._getItemStatus(itemData);
		data.itemProperties = this._getItemProperties(itemData);
		data.isPhysical = itemData.system.hasOwnProperty("quantity");

		// Potential consumption targets
		data.abilityConsumptionTargets = this._getItemConsumptionTargets(itemData);

		// Action Details
		data.hasAttackRoll = this.item.hasAttack;
		data.isHealing = itemData.system.actionType === "heal";
		data.isFlatDC = foundry.utils.getProperty(itemData, "system.save.scaling") === "flat";
		data.isLine = ["line", "wall"].includes(itemData.system.target?.type);

		// Original maximum uses formula
		const sourceMax = foundry.utils.getProperty(this.item._source, "system.uses.max");
		if (sourceMax) itemData.system.uses.max = sourceMax;

		// Vehicles
		data.isCrewed = itemData.system.activation?.type === "crew";
		data.isMountable = this._isItemMountable(itemData);

		// Armor Class
		data.isArmor = itemData.system.armor?.type in data.config.armorTypes;
		data.hasAC = data.isArmor || data.isMountable;

		// Prepare Active Effects
		data.effects = ActiveEffect5e.prepareActiveEffectCategories(this.item.effects);

		// Re-define the template data references (backwards compatible)
		data.item = itemData;
		data.data = itemData.system;

		data.descriptionHTML = await TextEditor.enrichHTML(data.system.description.value, {
			secrets: this.item.isOwner,
			async: true,
		});
		return data;
	}

	/* -------------------------------------------- */

	/**
	 * Get the valid item consumption targets which exist on the actor
	 * @param {Object} item         Item data for the item being displayed
	 * @return {{string: string}}   An object of potential consumption targets
	 * @private
	 */
	_getItemConsumptionTargets(item) {
		const consume = item.system.consume || {};
		if (!consume.type) return [];
		const actor = this.item.actor;
		if (!actor) return {};

		// Ammunition
		if (consume.type === "ammo") {
			return actor.itemTypes.consumable.reduce(
				(ammo, i) => {
					if (i.system.consumableType === "ammo") {
						ammo[i.id] = `${i.name} (${i.system.quantity})`;
					}
					return ammo;
				},
				{ [item._id]: `${item.name} (${item.system.quantity})` }
			);
		}

		// Attributes
		else if (consume.type === "attribute") {
			const attributes = TokenDocument.getTrackedAttributes(actor.system);
			attributes.bar.forEach((a) => a.push("value"));
			return attributes.bar.concat(attributes.value).reduce((obj, a) => {
				let k = a.join(".");
				obj[k] = k;
				return obj;
			}, {});
		}

		// Materials
		else if (consume.type === "material") {
			return actor.items.reduce((obj, i) => {
				if (["consumable", "loot"].includes(i.type) && !i.system.activation) {
					obj[i.id] = `${i.name} (${i.system.quantity})`;
				}
				return obj;
			}, {});
		}

		// Charges
		else if (consume.type === "charges") {
			return actor.items.reduce((obj, i) => {
				// Limited-use items
				const uses = i.system.uses || {};
				if (uses.per && uses.max) {
					const label =
						uses.per === "charges"
							? ` (${game.i18n.format("TRPG.AbilityUseChargesLabel", { value: uses.value })})`
							: ` (${game.i18n.format("TRPG.AbilityUseConsumableLabel", { max: uses.max, per: uses.per })})`;
					obj[i.id] = i.name + label;
				}

				// Recharging items
				const recharge = i.system.recharge || {};
				if (recharge.value) obj[i.id] = `${i.name} (${game.i18n.format("TRPG.Recharge")})`;
				return obj;
			}, {});
		} else return {};
	}

	/* -------------------------------------------- */

	/**
	 * Get the text item status which is shown beneath the Item type in the top-right corner of the sheet
	 * @return {string}
	 * @private
	 */
	_getItemStatus(item) {
		if (item.type === "spell") {
			return CONFIG.TRPG.spellPreparationModes[item.preparation];
		} else if (["weapon", "equipment"].includes(item.type)) {
			return game.i18n.localize(item.equipped ? "TRPG.Equipped" : "TRPG.Unequipped");
		} else if (item.type === "tool") {
			return game.i18n.localize(item.proficient ? "TRPG.Proficient" : "TRPG.NotProficient");
		}
	}

	/* -------------------------------------------- */

	/**
	 * Get the Array of item properties which are used in the small sidebar of the description tab
	 * @return {Array}
	 * @private
	 */
	_getItemProperties(item) {
		const props = [];
		const labels = this.item.labels;

		if (item.type === "weapon") {
			props.push(
				...Object.entries(item.system.properties)
					.filter((e) => e[1] === true)
					.map((e) => CONFIG.TRPG.weaponProperties[e[0]])
			);
		} else if (item.type === "spell") {
			props.push(
				labels.components,
				labels.materials,
				item.system.components.concentration ? game.i18n.localize("TRPG.Concentration") : null,
				item.system.components.ritual ? game.i18n.localize("TRPG.Ritual") : null
			);
		} else if (item.type === "equipment") {
			props.push(CONFIG.TRPG.equipmentTypes[item.system.armor.type]);
			props.push(labels.armor);
		} else if (item.type === "feat") {
			// props.push(labels.featType);
		}

		// Action type
		if (item.system.actionType) {
			props.push(CONFIG.TRPG.itemActionTypes[item.system.actionType]);
		}

		// Action usage
		if (item.type !== "weapon" && item.system.activation && !foundry.utils.isEmpty(item.system.activation)) {
			props.push(labels.activation, labels.range, labels.target, labels.duration);
		}
		return props.filter((p) => !!p);
	}

	/* -------------------------------------------- */

	/**
	 * Is this item a separate large object like a siege engine or vehicle
	 * component that is usually mounted on fixtures rather than equipped, and
	 * has its own AC and HP.
	 * @param item
	 * @returns {boolean}
	 * @private
	 */
	_isItemMountable(item) {
		const data = item.system;
		return (item.type === "weapon" && data.weaponType === "siege") || (item.type === "equipment" && data.armor.type === "vehicle");
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	setPosition(position = {}) {
		if (!(this._minimized || position.height)) {
			position.height = this._tabs[0].active === "details" ? "auto" : this.options.height;
		}
		return super.setPosition(position);
	}

	/* -------------------------------------------- */
	/*  Form Submission                             */
	/* -------------------------------------------- */

	/** @inheritdoc */
	_getSubmitData(updateData = {}) {
		const formData = foundry.utils.expandObject(super._getSubmitData(updateData));

		// Handle Damage array
		const damage = formData.system?.damage;
		if (damage) damage.parts = Object.values(damage?.parts || {}).map((d) => [d[0] || "", d[1] || ""]);

		// Check max uses formula
		const uses = formData.system?.uses;
		if (uses?.max) {
			const maxRoll = new Roll(uses.max);
			if (!maxRoll.isDeterministic) {
				uses.max = this.item._source.system.uses.max;
				this.form.querySelector("input[name='system.uses.max']").value = uses.max;
				return ui.notifications.error(
					game.i18n.format("TRPG.FormulaCannotContainDiceError", {
						name: game.i18n.localize("TRPG.LimitedUses"),
					})
				);
			}
		}

		// Check class identifier
		// if (formData.system?.identifier) {
		// 	const dataRgx = new RegExp(/^([a-z0-9_-]+)$/i);
		// 	const match = formData.system.identifier.match(dataRgx);
		// 	if (!match) {
		// 		formData.system.identifier = this.item._source.system.identifier;
		// 		this.form.querySelector("input[name='system.identifier']").value = formData.system.identifier;
		// 		return ui.notifications.error(game.i18n.localize("TRPG.IdentifierError"));
		// 	}
		// }

		// Return the flattened submission data
		return flattenObject(formData);
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	activateListeners(html) {
		super.activateListeners(html);
		if (this.isEditable) {
			html.find(".damage-control").click(this._onDamageControl.bind(this));
			html.find(".trait-selector").click(this._onConfigureTraits.bind(this));
			html.find(".effect-control").click((ev) => {
				if (this.item.isOwned)
					return ui.notifications.warn("Managing Active Effects within an Owned Item is not currently supported and will be added in a subsequent update.");
				ActiveEffect5e.onManageActiveEffect(ev, this.item);
			});
		}
	}

	/* -------------------------------------------- */

	/**
	 * Add or remove a damage part from the damage formula
	 * @param {Event} event     The original click event
	 * @return {Promise}
	 * @private
	 */
	async _onDamageControl(event) {
		event.preventDefault();
		const a = event.currentTarget;

		// Add new damage component
		if (a.classList.contains("add-damage")) {
			await this._onSubmit(event); // Submit any unsaved changes
			const damage = this.item.system.damage;
			return this.item.update({ "data.damage.parts": damage.parts.concat([["", ""]]) });
		}

		// Remove a damage component
		if (a.classList.contains("delete-damage")) {
			await this._onSubmit(event); // Submit any unsaved changes
			const li = a.closest(".damage-part");
			const damage = foundry.utils.deepClone(this.item.system.damage);
			damage.parts.splice(Number(li.dataset.damagePart), 1);
			return this.item.update({ "data.damage.parts": damage.parts });
		}
	}

	/* -------------------------------------------- */

	/**
	 * Handle spawning the TraitSelector application for selection various options.
	 * @param {Event} event   The click event which originated the selection
	 * @private
	 */
	_onConfigureTraits(event) {
		event.preventDefault();
		const a = event.currentTarget;
		const options = {
			name: a.dataset.target,
			title: a.parentElement.innerText,
			choices: [],
			allowCustom: false,
		};
		switch (a.dataset.options) {
			case "saves":
				options.choices = CONFIG.TRPG.abilities;
				options.valueKey = null;
				break;
			case "skills.choices":
				options.choices = CONFIG.TRPG.skills;
				options.valueKey = null;
				break;
			case "skills":
				const skills = this.item.system.skills;
				const choiceSet = skills.choices?.length ? skills.choices : Object.keys(CONFIG.TRPG.skills);
				options.choices = Object.fromEntries(Object.entries(CONFIG.TRPG.skills).filter(([skill]) => choiceSet.includes(skill)));
				options.maximum = skills.number;
				break;
		}
		new TraitSelector(this.item, options).render(true);
	}

	/* -------------------------------------------- */

	/** @inheritdoc */
	async _onSubmit(...args) {
		if (this._tabs[0].active === "details") this.position.height = "auto";
		await super._onSubmit(...args);
	}
}
