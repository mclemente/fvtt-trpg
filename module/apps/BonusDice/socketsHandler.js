import { updateCounter, modifyBonusDieAmountGM, createWarning } from "./BonusDice.js";
const socketsHandle = () => async (receivedObject) => {
    switch (receivedObject.action) {
        case 'updatePlayerDisplay':
            return updateCounter(Array.isArray(receivedObject.targetId) ? receivedObject.targetId : [receivedObject.targetId], receivedObject.counter);
        case 'requestCounterUpdate':
            return modifyBonusDieAmountGM(receivedObject.players, receivedObject.modifier, receivedObject.context, receivedObject.source);
        case 'warningFallBack':
            // @ts-ignore
            return createWarning(receivedObject.source, receivedObject.reason);
    }
};
export { socketsHandle };
