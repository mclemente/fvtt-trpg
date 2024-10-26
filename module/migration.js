/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
	ui.notifications.info(`Migrando o sistema para a versão ${game.system.version}. Por favor, tenha paciência e não feche o jogo ou desligue o servidor.`, {
		permanent: true,
	});

	const migrationData = await getMigrationData();

	// Migrate World Actors
	const actors = game.actors.map((a) => [a, true])
		.concat(Array.from(game.actors.invalidDocumentIds).map((id) => [game.actors.getInvalid(id), false]));
	for (const [actor, valid] of actors) {
		try {
			const source = valid ? actor.toObject() : game.actors.find((a) => a._id === actor.id);
			const updateData = migrateActorData(source, migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Actor document ${actor.name}`);
				await actor.update(updateData, { enforceTypes: false, diff: valid });
			}
		} catch (err) {
			err.message = `Migração do ator ${actor.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Items
	const items = game.items.map((i) => [i, true])
		.concat(Array.from(game.items.invalidDocumentIds).map((id) => [game.items.getInvalid(id), false]));
	for (const [item, valid] of items) {
		try {
			const source = valid ? item.toObject() : game.items.find((i) => i._id === item.id);
			const updateData = migrateItemData(source, migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Item document ${item.name}`);
				await item.update(updateData, { enforceTypes: false, diff: valid });
			}
		} catch (err) {
			err.message = `Migração do item ${item.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Macros
	for (const m of game.macros) {
		try {
			const updateData = migrateMacroData(m.toObject(), migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Macro document ${m.name}`);
				await m.update(updateData, { enforceTypes: false });
			}
		} catch(err) {
			err.message = `Migração da Macro ${m.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Roll Tables
	for (const table of game.tables) {
		try {
			const updateData = migrateRollTableData(table.toObject(), migrationData);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating RollTable document ${table.name}`);
				await table.update(updateData, { enforceTypes: false });
			}
		} catch(err) {
			err.message = `Migração da Tabela de Rolagem ${table.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate Actor Override Tokens
	for (let s of game.scenes) {
		try {
			const updateData = migrateSceneData(s.data);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrando documento da Cena ${s.name}`);
				await s.update(updateData, { enforceTypes: false });
				// If we do not do this, then synthetic token actors remain in cache
				// with the un-updated actorData.
				s.tokens.forEach((t) => (t._actor = null));
			}
		} catch (err) {
			err.message = `Migração da Cena ${s.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Compendium Packs
	for (let p of game.packs) {
		if (p.metadata.packageType !== "world") continue;
		if (!["Actor", "Item", "Scene"].includes(p.metadata.type)) continue;
		await migrateCompendium(p);
	}

	// Set the migration as complete
	game.settings.set("trpg", "systemMigrationVersion", game.system.version);
	ui.notifications.info(`Migração do sistema para a versão ${game.system.version} está completa!`, { permanent: true });
};

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @return {Promise}
 */
export const migrateCompendium = async function (pack) {
	const entity = pack.metadata.type;
	if (!["Actor", "Item", "Scene"].includes(entity)) return;

	const migrationData = await getMigrationData();

	// Unlock the pack for editing
	const wasLocked = pack.locked;
	await pack.configure({ locked: false });

	// Begin by requesting server-side data model migration and get the migrated content
	await pack.migrate();
	const documents = await pack.getDocuments();

	// Iterate over compendium entries - applying fine-tuned migration functions
	for (let doc of documents) {
		let updateData = {};
		try {
			const source = doc.toObject();
			switch (entity) {
				case "Actor":
					updateData = migrateActorData(source, migrationData);
					break;
				case "Item":
					updateData = migrateItemData(source, migrationData);
					break;
				case "Scene":
					updateData = migrateSceneData(source, migrationData);
					break;
			}

			// Save the entry, if data was changed
			if (foundry.utils.isEmpty(updateData)) continue;
			await doc.update(updateData);
			console.log(`Migrated ${entity} entity ${doc.name} in Compendium ${pack.collection}`);
		} catch (err) {
			// Handle migration failures
			err.message = `Failed dnd5e system migration for entity ${doc.name} in pack ${pack.collection}: ${err.message}`;
			console.error(err);
		}
	}

	// Apply the original locked status for the pack
	await pack.configure({ locked: wasLocked });
	console.log(`Migrated all ${entity} entities from Compendium ${pack.collection}`);
};

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate a single Actor entity to incorporate latest data model changes
 * Return an Object of updateData to be applied
 * @param {object} actor    The actor data object to update
 * @return {Object}         The updateData to apply
 */
export function migrateActorData(actor, migrationData) {
	const updateData = {};

	// Actor Data Updates
	if (actor.system) {
		const ep = actor.system.currency?.ep;
		if (ep !== undefined) {
			updateData["system.currency.-=ep"] = null;
		}
	}

	// Migrate Owned Items
	if (!actor.items) return updateData;
	const items = actor.items.reduce((arr, i) => {
		// Migrate the Owned Item
		const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
		let itemUpdate = migrateItemData(itemData, migrationData);

		// Prepared, Equipped, and Proficient for NPC actors
		if (actor.type === "npc") {
			if (foundry.utils.getProperty(itemData.system, "preparation.prepared") === false) itemUpdate["system.preparation.prepared"] = true;
			if (foundry.utils.getProperty(itemData.system, "equipped") === false) itemUpdate["system.equipped"] = true;
			if (foundry.utils.getProperty(itemData.system, "proficient") === false) itemUpdate["system.proficient"] = true;
		}

		// Update the Owned Item
		if (!foundry.utils.isEmpty(itemUpdate)) {
			itemUpdate._id = itemData._id;
			arr.push(expandObject(itemUpdate));
		}

		return arr;
	}, []);
	if (items.length > 0) updateData.items = items;
	return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Item entity to incorporate latest data model changes
 *
 * @param {object} item  Item data to migrate
 * @return {object}      The updateData to apply
 */
export function migrateItemData (item, migrationData) {
	const updateData = {};
	_migrateDocumentIcon(item, updateData, migrationData);
	return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single Macro document to incorporate latest data model changes.
 * @param {object} macro            Macro data to migrate
 * @param {object} [migrationData]  Additional data to perform the migration
 * @returns {object}                The updateData to apply
 */
export const migrateMacroData = function (macro, migrationData) {
	const updateData = {};
	_migrateDocumentIcon(macro, updateData, migrationData);
	return updateData;
};

/* -------------------------------------------- */

/**
 * Migrate a single RollTable document to incorporate the latest data model changes.
 * @param {object} table            Roll table data to migrate.
 * @param {object} [migrationData]  Additional data to perform the migration.
 * @returns {object}                The update delta to apply.
 */
export function migrateRollTableData(table, migrationData) {
	const updateData = {};
	_migrateDocumentIcon(table, updateData, migrationData);
	return updateData;
}

/* -------------------------------------------- */

/**
 * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Object}       The updateData to apply
 */
export const migrateSceneData = function (scene) {
	const tokens = scene.tokens.map((token) => {
		const t = token.toJSON();
		if (!t.actorId || t.actorLink) {
			t.actorData = {};
		} else if (!game.actors.has(t.actorId)) {
			t.actorId = null;
			t.actorData = {};
		} else if (!t.actorLink) {
			const actorData = duplicate(t.actorData);
			actorData.type = token.actor?.type;
			const update = migrateActorData(actorData);
			["items", "effects"].forEach((embeddedName) => {
				if (!update[embeddedName]?.length) return;
				const updates = new Map(update[embeddedName].map((u) => [u._id, u]));
				t.actorData[embeddedName].forEach((original) => {
					const update = updates.get(original._id);
					if (update) foundry.utils.mergeObject(original, update);
				});
				delete update[embeddedName];
			});

			foundry.utils.mergeObject(t.actorData, update);
		}
		return t;
	});
	return { tokens };
};

/**
 * Fetch bundled data for large-scale migrations.
 * @returns {Promise<object>}  Object mapping original system icons to their core replacements.
 */
export const getMigrationData = async function () {
	const data = {};
	try {
		const icons = await fetch("systems/trpg/json/icon-migration.json");
		const spellIcons = await fetch("systems/trpg/json/spell-icon-migration.json");
		data.iconMap = { ...await icons.json(), ...await spellIcons.json() };
	} catch(err) {
		console.warn(`Failed to retrieve icon migration data: ${err.message}`);
	}
	return data;
};

/**
 * Convert system icons to use bundled core webp icons.
 * @param {object} document                                 Document data to migrate
 * @param {object} updateData                               Existing update to expand upon
 * @param {object} [migrationData={}]                       Additional data to perform the migration
 * @param {Object<string, string>} [migrationData.iconMap]  A mapping of system icons to core foundry icons
 * @param {string} [migrationData.field]                    The document field to migrate
 * @returns {object}                                        The updateData to apply
 * @private
 */
function _migrateDocumentIcon(document, updateData, { iconMap, field="img" }={}) {
	let path = document?.[field];
	if (path && iconMap) {
		if (path.startsWith("/") || path.startsWith("\\")) path = path.substring(1);
		const rename = iconMap[path];
		if (rename) updateData[field] = rename;
	}
	return updateData;
}