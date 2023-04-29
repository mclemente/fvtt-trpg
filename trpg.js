/**
 * The DnD5e game system for Foundry Virtual Tabletop
 * A system for playing the fifth edition of the worlds most popular roleplaying game.
 * Author: Atropos
 * Software License: GNU GPLv3
 * Content License: https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf
 * Repository: https://gitlab.com/foundrynet/dnd5e
 * Issue Tracker: https://gitlab.com/foundrynet/dnd5e/issues
 */

// Import Modules
import { TRPG } from "./module/config.js";
import { registerSystemSettings } from "./module/settings.js";
import { preloadHandlebarsTemplates } from "./module/templates.js";
import { _getInitiativeFormula } from "./module/combat.js";
import { measureDistances } from "./module/canvas.js";

// Import Documents
import Actor5e from "./module/actor/entity.js";
import Item5e from "./module/item/entity.js";
import { TokenDocument5e, Token5e } from "./module/token.js";

// Import Applications
import AbilityTemplate from "./module/pixi/ability-template.js";
import AbilityUseDialog from "./module/apps/ability-use-dialog.js";
import ActorSheetFlags from "./module/apps/actor-flags.js";
import ActorSheet5eCharacter from "./module/actor/sheets/character.js";
import ActorSheet5eNPC from "./module/actor/sheets/npc.js";
import { injectActorSheet } from "./module/actor/sheets/base.js";
// import ActorSheet5eVehicle from "./module/actor/sheets/vehicle.js";
import ItemSheet5e from "./module/item/sheet.js";
import ShortRestDialog from "./module/apps/short-rest.js";
import TraitSelector from "./module/apps/trait-selector.js";
import ActorMovementConfig from "./module/apps/movement-config.js";
import ActorSensesConfig from "./module/apps/senses-config.js";

// Import Helpers
import * as chat from "./module/chat.js";
import * as dice from "./module/dice.js";
import * as macros from "./module/macros.js";
import * as migrations from "./module/migration.js";
import ActiveEffect5e from "./module/active-effect.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", function () {
	console.log(`TRPG | Iniciando o Sistema de Jogo TRPG`); //\n${TRPG.ASCII}

	// Create a namespace within the game global
	game.trpg = {
		applications: {
			AbilityUseDialog,
			ActorSheetFlags,
			ActorSheet5eCharacter,
			ActorSheet5eNPC,
			// ActorSheet5eVehicle,
			ItemSheet5e,
			ShortRestDialog,
			TraitSelector,
			ActorMovementConfig,
			ActorSensesConfig,
		},
		canvas: {
			AbilityTemplate,
		},
		config: TRPG,
		dice: dice,
		entities: {
			Actor5e,
			Item5e,
			TokenDocument5e,
			Token5e,
		},
		macros: macros,
		migrations: migrations,
		rollItemMacro: macros.rollItemMacro,
	};

	// Record Configuration Values
	CONFIG.TRPG = TRPG;
	CONFIG.ActiveEffect.documentClass = ActiveEffect5e;
	CONFIG.Actor.documentClass = Actor5e;
	CONFIG.Item.documentClass = Item5e;
	CONFIG.Token.documentClass = TokenDocument5e;
	CONFIG.Token.objectClass = Token5e;
	CONFIG.time.roundTime = 6;

	CONFIG.Dice.DamageRoll = dice.DamageRoll;
	CONFIG.Dice.D20Roll = dice.D20Roll;

	// 5e cone RAW should be 53.13 degrees
	CONFIG.MeasuredTemplate.defaults.angle = 53.13;

	// Register System Settings
	registerSystemSettings();

	// Patch Core Functions
	CONFIG.Combat.initiative.formula = "1d20 + @skills.init.mod + @skills.init.prof + @bonus";
	Combatant.prototype._getInitiativeFormula = _getInitiativeFormula;

	// Register Roll Extensions
	CONFIG.Dice.rolls.push(dice.D20Roll);
	CONFIG.Dice.rolls.push(dice.DamageRoll);

	// Register sheet application classes
	Actors.unregisterSheet("core", ActorSheet);
	Actors.registerSheet("trpg", ActorSheet5eCharacter, {
		types: ["character"],
		makeDefault: true,
		label: "TRPG.SheetClassCharacter",
	});
	Actors.registerSheet("trpg", ActorSheet5eNPC, {
		types: ["npc"],
		makeDefault: true,
		label: "TRPG.SheetClassNPC",
	});
	// Actors.registerSheet("trpg", ActorSheet5eVehicle, {
	//   types: ['vehicle'],
	//   makeDefault: true,
	//   label: "TRPG.SheetClassVehicle"
	// });
	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet("trpg", ItemSheet5e, {
		makeDefault: true,
		label: "TRPG.SheetClassItem",
	});

	// Preload Handlebars Templates
	return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
	// Localize CONFIG objects once up-front
	const toLocalize = [
		"abilities",
		"abilityAbbreviations",
		"abilityActivationTypes",
		"abilityConsumptionTypes",
		"actorSizes",
		"alignments",
		"armorClasses",
		"armorProficiencies",
		"bab",
		"conditionTypes",
		"consumableTypes",
		"cover",
		"currencies",
		"damageResistanceTypes",
		"damageTypes",
		"distanceUnits",
		"equipmentTypes",
		"healingTypes",
		"itemActionTypes",
		"itemRarity",
		"languages",
		"limitedUsePeriods",
		"movementTypes",
		"movementUnits",
		"polymorphSettings",
		"proficiencyLevels",
		"saves",
		"senses",
		"skills",
		"spellComponents",
		"spellLevels",
		"spellPreparationModes",
		"spellScalingModes",
		"spellSchools",
		"targetTypes",
		"timePeriods",
		"vehicleTypes",
		"weaponProficiencies",
		"weaponProperties",
		"weaponTypes",
	];

	// Exclude some from sorting where the default order matters
	const noSort = [
		"abilities",
		"actorSizes",
		"alignments",
		"armorClasses",
		"armorProficiencies",
		"currencies",
		"distanceUnits",
		"movementUnits",
		"itemActionTypes",
		"itemRarity",
		"proficiencyLevels",
		"limitedUsePeriods",
		"spellComponents",
		"spellLevels",
		"spellPreparationModes",
		"weaponProficiencies",
		"weaponTypes",
	];

	// Localize and sort CONFIG objects
	for (let o of toLocalize) {
		const localized = Object.entries(CONFIG.TRPG[o]).map(([k, v]) => {
			if (v.label) v.label = game.i18n.localize(v.label);
			if (typeof v === "string") return [k, game.i18n.localize(v)];
			return [k, v];
		});
		if (!noSort.includes(o)) localized.sort((a, b) => (a[1].label ?? a[1]).localeCompare(b[1].label ?? b[1]));
		CONFIG.TRPG[o] = localized.reduce((obj, e) => {
			obj[e[0]] = e[1];
			return obj;
		}, {});
	}
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", function () {
	// Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
	Hooks.on("hotbarDrop", (bar, data, slot) => macros.create5eMacro(data, slot));

	// Determine whether a system migration is required and feasible
	if (!game.user.isGM) return;
	const currentVersion = game.settings.get("trpg", "systemMigrationVersion");
	const NEEDS_MIGRATION_VERSION = "1.0.11";
	const COMPATIBLE_MIGRATION_VERSION = 1;
	const totalDocuments = game.actors.size + game.scenes.size + game.items.size;
	if (!currentVersion && totalDocuments === 0) return game.settings.set("trpg", "systemMigrationVersion", game.system.version);
	const needsMigration = currentVersion && isNewerVersion(NEEDS_MIGRATION_VERSION, currentVersion);
	if (!needsMigration) return;

	// Perform the migration
	if (currentVersion && isNewerVersion(COMPATIBLE_MIGRATION_VERSION, currentVersion)) {
		const warning = `O seu sistema TRPG é muito antigo e talvez não seja migrado corretamente para a última versão. O processo acontecerá, mas podem ocorrer erros.`;
		ui.notifications.error(warning, { permanent: true });
	}
	migrations.migrateWorld();
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function () {
	// Extend Diagonal Measurement
	// canvas.grid.diagonalRule = game.settings.get("trpg", "diagonalMovement");
	SquareGrid.prototype.measureDistances = measureDistances;
});

/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (app, html, data) => {
	// Display action buttons
	chat.displayChatActionButtons(app, html, data);

	// Highlight critical success or failure die
	chat.highlightCriticalSuccessFailure(app, html, data);

	// Optionally collapse the content
	if (game.settings.get("trpg", "autoCollapseItemCards")) html.find(".card-content").hide();
});
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatLog", (app, html, data) => Item5e.chatListeners(html));
Hooks.on("renderChatPopout", (app, html, data) => Item5e.chatListeners(html));
// Render Sidebar
Hooks.on("renderSidebarTab", (app, html) => {
	if (app instanceof Settings) {
		// Add Butons
		// JamboEditora
		let jambo = $(`<button>Jambô Editora</button>`);
		html.find("#game-details").append(jambo);
		jambo.click(() => {
			window.open("https://jamboeditora.com.br/");
		});
	}
});
//Skill Bonus
Hooks.on("renderActorSheet", (app, html, data) => injectActorSheet(app, html, data));
Hooks.on("getActorDirectoryEntryContext", Actor5e.addDirectoryContextOptions);

// FIXME: This helper is needed for the vehicle sheet. It should probably be refactored.
Handlebars.registerHelper("getProperty", function (data, property) {
	return getProperty(data, property);
});
