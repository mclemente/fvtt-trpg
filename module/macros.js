/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} dropData     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
export async function create5eMacro(dropData, slot) {
	const macroData = { type: "script", scope: "actor" };
	if (dropData.type !== "Item") return;
	const itemData = await Item.implementation.fromDropData(dropData);
		if ( !itemData ) {
			ui.notifications.warn("MACRO.5eUnownedWarn", {localize: true});
			return null;
		}
		foundry.utils.mergeObject(macroData, {
			name: itemData.name,
			img: itemData.img,
			command: `game.trpg.rollItemMacro("${item.name}");`,
			flags: {"trpg.itemMacro": true}
		});

	  // Assign the macro to the hotbar
	const macro = game.macros.find(m => {
		return (m.name === macroData.name) && (m.command === macroData.command) && m.isAuthor;
	}) || await Macro.create(macroData);
	game.user.assignHotbarMacro(macro, slot);
	return false;
}

/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
export function rollItemMacro(itemName) {
	const speaker = ChatMessage.getSpeaker();
	let actor;
	if (speaker.token) actor = game.actors.tokens[speaker.token];
	if (!actor) actor = game.actors.get(speaker.actor);

	// Get matching items
	const items = actor ? actor.items.filter((i) => i.name === itemName) : [];
	if (items.length > 1) {
		ui.notifications.warn(`Your controlled Actor ${actor.name} has more than one Item with name ${itemName}. The first matched item will be chosen.`);
	} else if (items.length === 0) {
		return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);
	}
	const item = items[0];

	// Trigger the item roll
	return item.roll();
}
