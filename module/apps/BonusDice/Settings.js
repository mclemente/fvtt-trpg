const getCounter = () => game?.settings?.get("trpg", "pontoDeAcao");
const setCounter = async (counterData) => await game?.settings?.set("trpg", "pontoDeAcao", counterData);
const getSetting = (settingKey) => game?.settings?.get("trpg", settingKey);
const setSetting = async (dataToSave, dataKey) => await game?.settings?.set("trpg", dataKey, dataToSave);
export { getCounter, setCounter, setSetting, getSetting };
