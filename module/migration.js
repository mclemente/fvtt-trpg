/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function () {
	ui.notifications.info(`Migrando o sistema para a versão ${game.system.data.version}. Por favor, tenha paciência e não feche o jogo ou desligue o servidor.`, {
		permanent: true,
	});

	// Migrate World Actors
	for (let a of game.actors) {
		try {
			const updateData = migrateActorData(a.toObject());
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Actor entity ${a.name}`);
				await a.update(updateData, { enforceTypes: false });
			}
		} catch (err) {
			err.message = `Migração do ator ${a.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Items
	for (let i of game.items) {
		try {
			const updateData = migrateItemData(i.toObject());
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrating Item entity ${i.name}`);
				await i.update(updateData, { enforceTypes: false });
			}
		} catch (err) {
			err.message = `Migração do item ${i.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate Actor Override Tokens
	for (let s of game.scenes) {
		try {
			const updateData = migrateSceneData(s.data);
			if (!foundry.utils.isEmpty(updateData)) {
				console.log(`Migrando entidade da cena ${s.name}`);
				await s.update(updateData, { enforceTypes: false });
				// If we do not do this, then synthetic token actors remain in cache
				// with the un-updated actorData.
				s.tokens.forEach((t) => (t._actor = null));
			}
		} catch (err) {
			err.message = `Migração da cena ${s.name} falhou: ${err.message}`;
			console.error(err);
		}
	}

	// Migrate World Compendium Packs
	for (let p of game.packs) {
		if (p.metadata.package !== "world") continue;
		if (!["Actor", "Item", "Scene"].includes(p.metadata.entity)) continue;
		await migrateCompendium(p);
	}

	// Set the migration as complete
	game.settings.set("trpg", "systemMigrationVersion", game.system.data.version);
	ui.notifications.info(`Migração do sistema para a versão ${game.system.data.version} está completa!`, { permanent: true });
};

/* -------------------------------------------- */

/**
 * Apply migration rules to all Entities within a single Compendium pack
 * @param pack
 * @return {Promise}
 */
export const migrateCompendium = async function (pack) {
	const entity = pack.metadata.entity;
	if (!["Actor", "Item", "Scene"].includes(entity)) return;

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
			switch (entity) {
				case "Actor":
					updateData = migrateActorData(doc.toObject());
					break;
				case "Item":
					updateData = migrateItemData(doc.toObject());
					break;
				case "Scene":
					updateData = migrateSceneData(doc.data);
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
export const migrateActorData = function (actor) {
	const updateData = {};

	// Actor Data Updates
	if (actor.data) {
		const ep = actor.data.currency?.ep;
		if (ep !== undefined) {
			updateData["data.currency.-=ep"] = null;
		}
	}

	// Migrate Owned Items
	if (!actor.items) return updateData;
	const items = actor.items.reduce((arr, i) => {
		// Migrate the Owned Item
		const itemData = i instanceof CONFIG.Item.documentClass ? i.toObject() : i;
		let itemUpdate = migrateItemData(itemData);

		// Prepared, Equipped, and Proficient for NPC actors
		if (actor.type === "npc") {
			if (foundry.utils.getProperty(itemData.data, "preparation.prepared") === false) itemUpdate["data.preparation.prepared"] = true;
			if (foundry.utils.getProperty(itemData.data, "equipped") === false) itemUpdate["data.equipped"] = true;
			if (foundry.utils.getProperty(itemData.data, "proficient") === false) itemUpdate["data.proficient"] = true;
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
export const migrateItemData = function (item) {
	const updateData = {};
	return updateData;
};

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

/* -------------------------------------------- */
/*  Low level migration utilities
/* -------------------------------------------- */
