const getCounter = () => game?.settings?.get("tormentarpg", "pontoDeAcao");
const setCounter = async (counterData) => await game?.settings?.set("tormentarpg", "pontoDeAcao", counterData);
const getSetting = (settingKey) => game?.settings?.get("tormentarpg", settingKey);
const setSetting = async (dataToSave, dataKey) => await game?.settings?.set("tormentarpg", dataKey, dataToSave);
export { getCounter, setCounter, setSetting, getSetting };
