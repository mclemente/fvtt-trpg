import Actor5e from "../entity.js";
import ActorSheet5e from "./base.js";

/**
 * An Actor sheet for player character type actors.
 * Extends the base ActorSheet5e class.
 * @type {ActorSheet5e}
 */
export default class ActorSheet5eCharacter extends ActorSheet5e {
	/**
	 * Define default rendering options for the NPC sheet
	 * @return {Object}
	 */
	static get defaultOptions() {
		let classes = ["dnd5e", "sheet", "actor", "character"];
		let height = 680;
		if (game.settings.get("trpg", "idjMode")) {
			classes.push("idj");
			height = 730;
		}
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes,
			width: 720,
			height,
		});
	}

	/* -------------------------------------------- */

	/**
	 * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
	 */
	async getData() {
		const context = await super.getData();

		// Temporary HP
		let hp = context.system.attributes.hp;
		let mp = context.system.attributes.mp;
		if (hp.temp === 0) delete hp.temp;
		if (hp.tempmax === 0) delete hp.tempmax;
		if (mp.temp === 0) delete mp.temp;
		if (mp.tempmax === 0) delete mp.tempmax;

		// Resources
		context.resources = ["primary", "secondary"].reduce((arr, r) => {
			const res = context.system.resources[r] || {};
			res.name = r;
			res.placeholder = game.i18n.localize("TRPG.Resource" + r.titleCase());
			if (res && res.value === 0) delete res.value;
			if (res && res.max === 0) delete res.max;
			return arr.concat([res]);
		}, []);

		context.idj = game.settings.get("trpg", "idjMode");

		// Experience Tracking
		context.disableExperience = game.settings.get("trpg", "disableExperienceTracking");
		context.classLabels = this.actor.itemTypes.class.map((c) => c.name).join(", ");
		context.multiclassLabels = this.actor.itemTypes.class
			.map((c) => {
				return [c.system.subclass, c.name, c.system.levels].filterJoin(" ");
			})
			.join(", ");

		// Return data for rendering
		return context;
	}

	/* -------------------------------------------- */

	/**
	 * Organize and classify Owned Items for Character sheets
	 * @private
	 */
	_prepareItems(data) {
		// Categorize items as inventory, spellbook, features, and classes
		const inventory = {
			weapon: { label: "TRPG.ItemTypeWeaponPl", items: [], dataset: { type: "weapon" } },
			equipment: { label: "TRPG.ItemTypeEquipmentPl", items: [], dataset: { type: "equipment" } },
			consumable: { label: "TRPG.ItemTypeConsumablePl", items: [], dataset: { type: "consumable" } },
			// tool: { label: "TRPG.ItemTypeToolPl", items: [], dataset: { type: "tool" } },
			// backpack: { label: "TRPG.ItemTypeContainerPl", items: [], dataset: { type: "backpack" } },
			loot: { label: "TRPG.ItemTypeLootPl", items: [], dataset: { type: "loot" } },
		};

		// Partition items by category
		let [items, spells, feats, classes] = data.items.reduce(
			(arr, item) => {
				// Item details
				item.img = item.img || CONST.DEFAULT_TOKEN;
				item.isStack = Number.isNumeric(item.system.quantity) && item.system.quantity !== 1;
				item.attunement = {
					[CONFIG.TRPG.attunementTypes.REQUIRED]: {
						icon: "fa-sun",
						cls: "not-attuned",
						title: "TRPG.AttunementRequired",
					},
					[CONFIG.TRPG.attunementTypes.ATTUNED]: {
						icon: "fa-sun",
						cls: "attuned",
						title: "TRPG.AttunementAttuned",
					},
				}[item.system.attunement];

				// Item usage
				item.hasUses = item.system.uses && item.system.uses.max > 0;
				item.isOnCooldown = item.system.recharge && !!item.system.recharge.value && item.system.recharge.charged === false;
				item.isDepleted = item.isOnCooldown && item.system.uses.per && item.system.uses.value > 0;
				item.hasTarget = !!item.system.target && !["none", ""].includes(item.system.target.type);

				// Item toggle state
				this._prepareItemToggleState(item);

				// Primary Class
				if (item.type === "class") item.isOriginalClass = item._id === this.actor.system.details.originalClass;

				// Classify items into types
				if (item.type === "spell") arr[1].push(item);
				else if (item.type === "feat") arr[2].push(item);
				else if (item.type === "class") arr[3].push(item);
				else if (Object.keys(inventory).includes(item.type)) arr[0].push(item);
				return arr;
			},
			[[], [], [], []]
		);

		// Apply active item filters
		items = this._filterItems(items, this._filters.inventory);
		spells = this._filterItems(spells, this._filters.spellbook);
		feats = this._filterItems(feats, this._filters.features);

		// Organize items
		for (let i of items) {
			i.system.quantity = i.system.quantity || 0;
			i.system.weight = i.system.weight || 0;
			i.totalWeight = (i.system.quantity * i.system.weight).toNearest(0.1);
			inventory[i.type].items.push(i);
		}

		// Organize Spellbook and count the number of prepared spells (excluding always, at will, etc...)
		const spellbook = this._prepareSpellbook(data, spells);
		const nPrepared = spells.filter((s) => {
			return s.system.level > 0 && s.system.preparation.mode === "prepared" && s.system.preparation.prepared;
		}).length;

		// Organize Features
		const features = {
			classes: {
				label: "TRPG.ItemTypeClassPl",
				items: [],
				hasActions: false,
				dataset: { type: "class" },
				isClass: true,
			},
			active: {
				label: "TRPG.FeatureActive",
				items: [],
				hasActions: true,
				dataset: { type: "feat", "activation.type": "action" },
			},
			passive: { label: "TRPG.FeaturePassive", items: [], hasActions: false, dataset: { type: "feat" } },
		};
		for (let f of feats) {
			if (f.system.activation.type) features.active.items.push(f);
			else features.passive.items.push(f);
		}
		classes.sort((a, b) => b.system.levels - a.system.levels);
		features.classes.items = classes;

		// Assign and return
		data.inventory = Object.values(inventory);
		data.spellbook = spellbook;
		data.preparedSpells = nPrepared;
		data.features = Object.values(features);
	}

	/* -------------------------------------------- */

	/**
	 * A helper method to establish the displayed preparation state for an item
	 * @param {Item} item
	 * @private
	 */
	_prepareItemToggleState(item) {
		if (item.type === "spell") {
			const isAlways = foundry.utils.getProperty(item.system, "preparation.mode") === "always";
			const isPrepared = foundry.utils.getProperty(item.system, "preparation.prepared");
			item.toggleClass = isPrepared ? "active" : "";
			if (isAlways) item.toggleClass = "fixed";
			if (isAlways) item.toggleTitle = CONFIG.TRPG.spellPreparationModes.always;
			else if (isPrepared) item.toggleTitle = CONFIG.TRPG.spellPreparationModes.prepared;
			else item.toggleTitle = game.i18n.localize("TRPG.SpellUnprepared");
		} else {
			const isActive = foundry.utils.getProperty(item.system, "equipped");
			item.toggleClass = isActive ? "active" : "";
			item.toggleTitle = game.i18n.localize(isActive ? "TRPG.Equipped" : "TRPG.Unequipped");
		}
	}

	/* -------------------------------------------- */
	/*  Event Listeners and Handlers
  /* -------------------------------------------- */

	/**
	 * Activate event listeners using the prepared sheet HTML
	 * @param html {jQuery}   The prepared HTML object ready to be rendered into the DOM
	 */
	activateListeners(html) {
		super.activateListeners(html);
		if (!this.isEditable) return;

		// Item State Toggling
		html.find(".item-toggle").click(this._onToggleItem.bind(this));

		// Short and Long Rest
		html.find(".long-rest").click(this._onLongRest.bind(this));

		// Rollable sheet actions
		html.find(".rollable[data-action]").click(this._onSheetAction.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * Handle mouse click events for character sheet actions
	 * @param {MouseEvent} event    The originating click event
	 * @private
	 */
	_onSheetAction(event) {
		event.preventDefault();
		const button = event.currentTarget;
		switch (button.dataset.action) {
			case "convertCurrency":
				return Dialog.confirm({
					title: `${game.i18n.localize("TRPG.CurrencyConvert")}`,
					content: `<p>${game.i18n.localize("TRPG.CurrencyConvertHint")}</p>`,
					yes: () => this.actor.convertCurrency(),
				});
			case "rollDeathSave":
				return this.actor.rollDeathSave({ event: event });
			case "rollInitiative":
				return this.actor.rollInitiative({ createCombatants: true });
		}
	}

	/* -------------------------------------------- */

	/**
	 * Handle toggling the state of an Owned Item within the Actor
	 * @param {Event} event   The triggering click event
	 * @private
	 */
	_onToggleItem(event) {
		event.preventDefault();
		const itemId = event.currentTarget.closest(".item").dataset.itemId;
		const item = this.actor.items.get(itemId);
		const attr = item.type === "spell" ? "system.preparation.prepared" : "system.equipped";
		return item.update({ [attr]: !foundry.utils.getProperty(item, attr) });
	}

	/* -------------------------------------------- */

	/**
	 * Take a short rest, calling the relevant function on the Actor instance
	 * @param {Event} event   The triggering click event
	 * @private
	 */
	async _onShortRest(event) {
		event.preventDefault();
		await this._onSubmit(event);
		return this.actor.shortRest();
	}

	/* -------------------------------------------- */

	/**
	 * Take a long rest, calling the relevant function on the Actor instance
	 * @param {Event} event   The triggering click event
	 * @private
	 */
	async _onLongRest(event) {
		event.preventDefault();
		await this._onSubmit(event);
		return this.actor.longRest();
	}

	/* -------------------------------------------- */

	/** @override */
	async _onDropItemCreate(itemData) {
		// Increment the number of class levels a character instead of creating a new item
		if (itemData.type === "class") {
			const cls = this.actor.itemTypes.class.find((c) => c.name === itemData.name);
			let priorLevel = cls?.system.levels ?? 0;
			if (!!cls) {
				const next = Math.min(priorLevel + 1, CONFIG.TRPG.maxLevel + priorLevel - this.actor.system.details.level);
				if (next > priorLevel) {
					itemData.levels = next;
					return cls.update({ "data.levels": next });
				}
			}
		}

		// Default drop handling if levels were not added
		return super._onDropItemCreate(itemData);
	}
}
