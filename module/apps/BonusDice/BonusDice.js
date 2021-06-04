import { getCounter, getSetting, setCounter } from "./Settings.js";
import { createNewMessage } from "./MessageHandle.js";
/**
 * Creates a warning to a target player
 *
 * @param checkSource - the target of the warning
 * @param type - details of the warning
 */
const createWarning = (checkSource, type) => {
    // @ts-ignore
    if (checkSource === game.user.data._id)
        ui.notifications.warn(getSetting(type));
};
/**
 * Returns the id of the span that holds a player's bonus die number
 *
 * @param id - player id
 */
const getJQueryObjectFromId = (id) => $(`#BonusDie-${id}`);
/**
 * Updates the counter display
 *
 * @param counter - jQuery element of the span to update
 * @param newValue - the new value of the span
 */
const updateCounter = (counter, newValue) => counter.forEach((entity) => getJQueryObjectFromId(entity).text(newValue[entity]));
/**
 * Returns true if a counter should be modified and false + reason if not
 *
 * @param counter - list of all the bonus dice of all the players
 * @param players - a list of players involved in the modification
 * @param modifiers - the modifiers applied to the counter
 */
const createShouldModifyObject = (counter, players, modifiers) => {
    let returnValue = true;
    let reason = 'nothing';
    players.forEach((current, index) => {
        if (counter[current] === 0 && modifiers[index] === -1) {
            returnValue = false;
            // reason = 'onModifyNegative';
        }
    });
    return {
        state: returnValue,
        reason: reason
    };
};
const createMessageOnModification = async (context, players) => await createNewMessage(context, players[0]);
/**
 * Modifies the structure of the counter
 *
 * @param players - list of players involved in the modification
 * @param counter - the entire counter
 * @param modifiers - the modifications done by each player
 */
const modifyCounter = (players, counter, modifiers) => {
    players.forEach((pl, index) => {
        if (isNaN(counter[pl]))
            counter[pl] = 0;
        counter[pl] = Math.max(counter[pl] + modifiers[index], 0);
    });
    return counter;
};
/**
 * Update the counter in the settings and emits the message for the players to update their counters
 *
 * @param counter - all saved data
 * @param players - a list of players whose numbers should be modified
 */
const updateCounterAndDisplay = (counter, players) => {
    setCounter(counter).then(() => {
        updateCounter(players, counter);
        game.socket.emit('module.BonusDie', {
            action: 'updatePlayerDisplay',
            targetId: players,
            counter: counter
        });
    });
};
/**
 * Method called by the buttons to update the numbers displayed
 *
 * @param players - owner of the bonus die
 * @param modifiers - how should the number of bonus die be modified (+/-)
 * @param context - what message should be created
 * @param source - who called the modification
 */
const modifyBonusDieAmountGM = async (players, modifiers, context, source) => {
    if (!game.user.isGM)
        return;
    let counter = getCounter();
    const modify = createShouldModifyObject(counter, players, modifiers);
    if (!modify.state)
        return;
    if (context == 'use') {
        await createMessageOnModification(context, players);
    }
    counter = modifyCounter(players, counter, modifiers);
    updateCounterAndDisplay(counter, players);
};
/**
 * Method intended for calling modify Die Amount from the player's side,
 * it emits a socket that will be answered by the GM side of the method
 *
 * @param player - player calling the method
 * @param modifier - +1/-1
 * @param context
 * @param source
 */
const modifyBonusDieAmountPlayer = async (player, modifier, context, source) => {
    await game.socket.emit('module.BonusDie', {
        action: 'requestCounterUpdate',
        players: player,
        modifier: modifier,
        context: context,
        source: source
    });
};
/**
 * Selects if the method above should add or subtract from the counter
 *
 * @param type - increase/decrease
 * @param player - owner of the structure
 */
const methodSelector = (type, player) => async () => {
    switch (type) {
        case 'increase':
            return modifyBonusDieAmountGM([player], [1], 'increase');
        case 'decrease':
            return modifyBonusDieAmountGM([player], [-1], 'decrease');
        case 'use':
            return await modifyBonusDieAmountPlayer([player], [-1], 'use', player);
    }
};
const iconSelector = (type) => `fas ${type === 'increase' ? 'fa-plus' : type === 'decrease' ? 'fa-minus' : type === 'use' ? 'fa-dice-d20' : ''}`;
/**
 * Creates the structure for the button
 *
 * @param player - owner of the data
 */
const button = (player) => (type) => {
    const iconType = iconSelector(type);
    let createdButton = $(`<span><i class='${iconType}'></i></span>`);
    createdButton.on('click', methodSelector(type, player));
    return createdButton;
};
/**
 * Returns the number of bonus die held by a player
 *
 * @param player
 */
const getBonusDieValue = (player) => {
    const counter = getCounter();
    if (counter?.[player]) {
        return counter[player];
    }
    else
        return 0;
};
/**
 * Returns a unique identifier for each span
 *
 * @param index - index of the span
 */
const getSpanId = (index) => `BonusDie-${index}`;
/**
 * Creates the structure for the bonus die display as a span with the number of bonus die
 *
 * @param player - the player owner of the structure
 */
const bonusDieStructure = (player) => $(`<span id="${getSpanId(player)}">${getBonusDieValue(player)}</i></span>`);
/**
 * Creates the controls structure for the DM (display, plus button, minus button)
 *
 * @param players - player that has it's data controlled
 * @param index - index of the span
 */
const getControls = (players, index) => {
    const playerId = players.users[index].data._id;
    const $bonusDie = bonusDieStructure(playerId);
    const buttonWithPlayer = button(playerId);
    if (game.user.isGM) {
        const buttonPlus = buttonWithPlayer('increase');
        const buttonMinus = buttonWithPlayer('decrease');
        if (players.users[index].isGM)
            return [''];
        else
            return [buttonPlus, $bonusDie, buttonMinus];
    }
    else {
        // @ts-ignore
        const buttonUse = game.user.data._id === playerId ? buttonWithPlayer('use') : '';
        if (players.users[index].isGM)
            return [''];
        else
            return [$bonusDie, buttonUse];
    }
};
/**
 * Appends the controls to the players display
 *
 * @param players - a list of players
 */
const handle = (players) => (index, playerHTML) => {
    const $container = $('<div class="BonusDie-button-container"></div>');
    $container.append(...getControls(players, index));
    return $(playerHTML).append($container);
};
export { handle, updateCounter, modifyBonusDieAmountGM, createWarning };
