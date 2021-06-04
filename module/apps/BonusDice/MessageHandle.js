const STRINGS = {
    "use": "[$player] usou um ponto de ação."
}
const processorMethod = (playerOwner, playerTarget) => () => (valueToReplace) => {
    switch (valueToReplace) {
        case '[$player]':
            return game?.users?.get(playerOwner)?.data?.name;
        case '[$targetPlayer]':
            return game?.users?.get(playerTarget)?.data?.name;
        default:
            return `'${valueToReplace}' is not on the list of supported tags`;
    }
};
const parseRawMessages = (unparsedMessage, processorWithPlayerData) => {
    return unparsedMessage.replace(/\[\$([A-z]+)\]/g, processorWithPlayerData());
};
const getMessageContent = (context, processorWithPlayerData) => {
    const unparsedMessage = STRINGS[context];
    return parseRawMessages(unparsedMessage, processorWithPlayerData);
};
const createNewMessage = (context, playerOwner, playerTarget) => {
    const processorWithPlayerData = processorMethod(playerOwner, playerTarget);
    return ChatMessage.create({
        content: getMessageContent(context, processorWithPlayerData)
    });
};
export { createNewMessage };
