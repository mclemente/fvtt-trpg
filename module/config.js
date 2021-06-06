import {ClassFeatures} from "./classFeatures.js"

// Namespace Configuration Values
export const TRPG = {};

// ASCII Artwork
TRPG.ASCII = ``;


/**
 * The set of Ability Scores used within the system
 * @type {Object}
 */
TRPG.abilities = {
  "str": "TRPG.AbilityStr",
  "dex": "TRPG.AbilityDex",
  "con": "TRPG.AbilityCon",
  "int": "TRPG.AbilityInt",
  "wis": "TRPG.AbilityWis",
  "cha": "TRPG.AbilityCha"
};

TRPG.abilityAbbreviations = {
  "str": "TRPG.AbilityStrAbbr",
  "dex": "TRPG.AbilityDexAbbr",
  "con": "TRPG.AbilityConAbbr",
  "int": "TRPG.AbilityIntAbbr",
  "wis": "TRPG.AbilityWisAbbr",
  "cha": "TRPG.AbilityChaAbbr"
};

/* -------------------------------------------- */

/**
 * Character alignment options
 * @type {Object}
 */
TRPG.alignments = {
  'lg': "TRPG.AlignmentLG",
  'ng': "TRPG.AlignmentNG",
  'cg': "TRPG.AlignmentCG",
  'ln': "TRPG.AlignmentLN",
  'tn': "TRPG.AlignmentTN",
  'cn': "TRPG.AlignmentCN",
  'le': "TRPG.AlignmentLE",
  'ne': "TRPG.AlignmentNE",
  'ce': "TRPG.AlignmentCE"
};

/* -------------------------------------------- */

/**
 * An enumeration of item attunement types
 * @enum {number}
 */
TRPG.attunementTypes = {
  NONE: 0,
  REQUIRED: 1,
  ATTUNED: 2,
};

/**
 * An enumeration of item attunement states
 * @type {{"0": string, "1": string, "2": string}}
 */
TRPG.attunements = {
  0: "TRPG.AttunementNone",
  1: "TRPG.AttunementRequired",
  2: "TRPG.AttunementAttuned"
};

/* -------------------------------------------- */


TRPG.weaponProficiencies = {
  "sim": "TRPG.WeaponSimpleProficiency",
  "mar": "TRPG.WeaponMartialProficiency",
  "exo": "Armas Exóticas",
};

/**
 * The basic weapon types in 5e. This enables specific weapon proficiencies or
 * starting equipment provided by classes and backgrounds.
 *
 * @enum {string}
 */
TRPG.weaponIds = {
    "battleaxe": "I0WocDSuNpGJayPb",
    "blowgun": "wNWK6yJMHG9ANqQV",
    "club": "nfIRTECQIG81CvM4",
    "dagger": "0E565kQUBmndJ1a2",
    "dart": "3rCO8MTIdPGSW6IJ",
    "flail": "UrH3sMdnUDckIHJ6",
    "glaive": "rOG1OM2ihgPjOvFW",
    "greataxe": "1Lxk6kmoRhG8qQ0u",
    "greatclub": "QRCsxkCwWNwswL9o",
    "greatsword": "xMkP8BmFzElcsMaR",
    "halberd": "DMejWAc8r8YvDPP1",
    "handaxe": "eO7Fbv5WBk5zvGOc",
    "handcrossbow": "qaSro7kFhxD6INbZ",
    "heavycrossbow": "RmP0mYRn2J7K26rX",
    "javelin": "DWLMnODrnHn8IbAG",
    "lance": "RnuxdHUAIgxccVwj",
    "lightcrossbow": "ddWvQRLmnnIS0eLF",
    "lighthammer": "XVK6TOL4sGItssAE",
    "longbow": "3cymOVja8jXbzrdT",
    "longsword": "10ZP2Bu3vnCuYMIB",
    "mace": "Ajyq6nGwF7FtLhDQ",
    "maul": "DizirD7eqjh8n95A",
    "morningstar": "dX8AxCh9o0A9CkT3",
    "net": "aEiM49V8vWpWw7rU",
    "pike": "tC0kcqZT9HHAO0PD",
    "quarterstaff": "g2dWN7PQiMRYWzyk",
    "rapier": "Tobce1hexTnDk4sV",
    "scimitar": "fbC0Mg1a73wdFbqO",
    "shortsword": "osLzOwQdPtrK3rQH",
    "sickle": "i4NeNZ30ycwPDHMx",
    "spear": "OG4nBBydvmfWYXIk",
    "shortbow": "GJv6WkD7D2J6rP6M",
    "sling": "3gynWO9sN4OLGMWD",
    "trident": "F65ANO66ckP8FDMa",
    "warpick": "2YdfjN1PIIrSHZii",
    "warhammer":  "F0Df164Xv1gWcYt0",
    "whip": "QKTyxoO0YDnAsbYe"
};

/* -------------------------------------------- */



TRPG.toolProficiencies = {
  "art": "TRPG.ToolArtisans",
  "disg": "TRPG.ToolDisguiseKit",
  "forg": "TRPG.ToolForgeryKit",
  "game": "TRPG.ToolGamingSet",
  "herb": "TRPG.ToolHerbalismKit",
  "music": "TRPG.ToolMusicalInstrument",
  "navg": "TRPG.ToolNavigators",
  "pois": "TRPG.ToolPoisonersKit",
  "thief": "TRPG.ToolThieves",
  "vehicle": "TRPG.ToolVehicle"
};

/**
 * The basic tool types in 5e. This enables specific tool proficiencies or
 * starting equipment provided by classes and backgrounds.
 *
 * @enum {string}
 */
TRPG.toolIds = {
  "alchemist": "SztwZhbhZeCqyAes",
  "bagpipes": "yxHi57T5mmVt0oDr",
  "brewer": "Y9S75go1hLMXUD48",
  "calligrapher": "jhjo20QoiD5exf09",
  "card": "YwlHI3BVJapz4a3E",
  "carpenter": "8NS6MSOdXtUqD7Ib",
  "cartographer": "fC0lFK8P4RuhpfaU",
  "cobbler": "hM84pZnpCqKfi8XH",
  "cook": "Gflnp29aEv5Lc1ZM",
  "dice": "iBuTM09KD9IoM5L8",
  "disg": "IBhDAr7WkhWPYLVn",
  "drum": "69Dpr25pf4BjkHKb",
  "dulcimer": "NtdDkjmpdIMiX7I2",
  "flute": "eJOrPcAz9EcquyRQ",
  "forg": "cG3m4YlHfbQlLEOx",
  "glassblower": "rTbVrNcwApnuTz5E",
  "herb": "i89okN7GFTWHsvPy",
  "horn": "aa9KuBy4dst7WIW9",
  "jeweler": "YfBwELTgPFHmQdHh",
  "leatherworker": "PUMfwyVUbtyxgYbD",
  "lute": "qBydtUUIkv520DT7",
  "lyre": "EwG1EtmbgR3bM68U",
  "mason": "skUih6tBvcBbORzA",
  "navg": "YHCmjsiXxZ9UdUhU",
  "painter": "ccm5xlWhx74d6lsK",
  "panflute": "G5m5gYIx9VAUWC3J",
  "pois": "il2GNi8C0DvGLL9P",
  "potter": "hJS8yEVkqgJjwfWa",
  "shawm": "G3cqbejJpfB91VhP",
  "smith": "KndVe2insuctjIaj",
  "thief": "woWZ1sO5IUVGzo58",
  "tinker": "0d08g1i5WXnNrCNA",
  "viol": "baoe3U5BfMMMxhCU",
  "weaver": "ap9prThUB2y9lDyj",
  "woodcarver": "xKErqkLo4ASYr5EP",
};


/* -------------------------------------------- */

/**
 * This Object defines the various lengths of time which can occur
 * @type {Object}
 */
TRPG.timePeriods = {
  "inst": "TRPG.TimeInst",
  "turn": "TRPG.TimeTurn",
  "round": "TRPG.TimeRound",
  "minute": "TRPG.TimeMinute",
  "hour": "TRPG.TimeHour",
  "day": "TRPG.TimeDay",
  "month": "TRPG.TimeMonth",
  "year": "TRPG.TimeYear",
  "perm": "TRPG.TimePerm",
  "spec": "TRPG.Special"
};


/* -------------------------------------------- */

/**
 * This describes the ways that an ability can be activated
 * @type {Object}
 */
TRPG.abilityActivationTypes = {
  "none": "TRPG.None",
  "action": "TRPG.Action",
  "bonus": "TRPG.BonusAction",
  "reaction": "TRPG.Reaction",
  "minute": TRPG.timePeriods.minute,
  "hour": TRPG.timePeriods.hour,
  "day": TRPG.timePeriods.day,
  "special": TRPG.timePeriods.spec,
  "legendary": "TRPG.LegAct",
  "lair": "TRPG.LairAct",
  "crew": "TRPG.VehicleCrewAction"
};

/* -------------------------------------------- */


TRPG.abilityConsumptionTypes = {
  "ammo": "TRPG.ConsumeAmmunition",
  "attribute": "TRPG.ConsumeAttribute",
  "material": "TRPG.ConsumeMaterial",
  "charges": "TRPG.ConsumeCharges"
};


/* -------------------------------------------- */

// Creature Sizes
TRPG.actorSizes = {
  "tiny": "TRPG.SizeTiny",
  "sm": "TRPG.SizeSmall",
  "med": "TRPG.SizeMedium",
  "lg": "TRPG.SizeLarge",
  "huge": "TRPG.SizeHuge",
  "grg": "TRPG.SizeGargantuan"
};

TRPG.tokenSizes = {
  "tiny": 1,
  "sm": 1,
  "med": 1,
  "lg": 2,
  "huge": 3,
  "grg": 4
};

/**
 * Colors used to visualize temporary and temporary maximum HP in token health bars
 * @enum {number}
 */
TRPG.tokenHPColors = {
  temp: 0x66CCFF,
  tempmax: 0x440066,
  negmax: 0x550000
}

/* -------------------------------------------- */

/**
 * Creature types
 * @type {Object}
 */
TRPG.creatureTypes = {
  "aberration": "TRPG.CreatureAberration",
  "beast": "TRPG.CreatureBeast",
  "celestial": "TRPG.CreatureCelestial",
  "construct": "TRPG.CreatureConstruct",
  "dragon": "TRPG.CreatureDragon",
  "elemental": "TRPG.CreatureElemental",
  "fey": "TRPG.CreatureFey",
  "fiend": "TRPG.CreatureFiend",
  "giant": "TRPG.CreatureGiant",
  "humanoid": "TRPG.CreatureHumanoid",
  "monstrosity": "TRPG.CreatureMonstrosity",
  "ooze": "TRPG.CreatureOoze",
  "plant": "TRPG.CreaturePlant",
  "undead": "TRPG.CreatureUndead"
};


/* -------------------------------------------- */

/**
 * Classification types for item action types
 * @type {Object}
 */
TRPG.itemActionTypes = {
  "mwak": "TRPG.ActionMWAK",
  "rwak": "TRPG.ActionRWAK",
  // "msak": "TRPG.ActionMSAK",
  // "rsak": "TRPG.ActionRSAK",
  "save": "TRPG.ActionSave",
  "heal": "TRPG.ActionHeal",
  "abil": "TRPG.ActionAbil",
  "util": "TRPG.ActionUtil",
  "other": "TRPG.ActionOther"
};

/* -------------------------------------------- */

TRPG.itemCapacityTypes = {
  "items": "TRPG.ItemContainerCapacityItems",
  "weight": "TRPG.ItemContainerCapacityWeight"
};

/* -------------------------------------------- */

/**
 * Enumerate the lengths of time over which an item can have limited use ability
 * @type {Object}
 */
TRPG.limitedUsePeriods = {
  // "sr": "TRPG.ShortRest",
  "lr": "TRPG.LongRest",
  "day": "TRPG.Day",
  "charges": "TRPG.Charges"
};


/* -------------------------------------------- */

/**
 * The set of equipment types for armor, clothing, and other objects which can be worn by the character
 * @type {Object}
 */
TRPG.equipmentTypes = {
  "light": "TRPG.EquipmentLight",
  "medium": "TRPG.EquipmentMedium",
  "heavy": "TRPG.EquipmentHeavy",
  "bonus": "TRPG.EquipmentBonus",
  "natural": "TRPG.EquipmentNatural",
  "shield": "TRPG.EquipmentShield",
  "clothing": "TRPG.EquipmentClothing",
  "trinket": "TRPG.EquipmentTrinket",
  "vehicle": "TRPG.EquipmentVehicle"
};


/* -------------------------------------------- */

/**
 * The set of Armor Proficiencies which a character may have
 * @type {Object}
 */
TRPG.armorProficiencies = {
  "lgt": TRPG.equipmentTypes.light,
  "med": TRPG.equipmentTypes.medium,
  "hvy": TRPG.equipmentTypes.heavy,
  "shl": "TRPG.EquipmentShieldProficiency"
};


/* -------------------------------------------- */

/**
 * Enumerate the valid consumable types which are recognized by the system
 * @type {Object}
 */
TRPG.consumableTypes = {
  "ammo": "TRPG.ConsumableAmmunition",
  "potion": "TRPG.ConsumablePotion",
  "poison": "TRPG.ConsumablePoison",
  "food": "TRPG.ConsumableFood",
  "scroll": "TRPG.ConsumableScroll",
  "wand": "TRPG.ConsumableWand",
  "rod": "TRPG.ConsumableRod",
  "trinket": "TRPG.ConsumableTrinket"
};

/* -------------------------------------------- */

/**
 * The valid currency denominations supported by the 5e system
 * @type {Object}
 */
TRPG.currencies = {
  "pp": "TRPG.CurrencyPP",
  "gp": "TRPG.CurrencyGP",
  // "ep": "TRPG.CurrencyEP",
  "sp": "TRPG.CurrencySP",
  "cp": "TRPG.CurrencyCP",
};


/**
 * Define the upwards-conversion rules for registered currency types
 * @type {{string, object}}
 */
TRPG.currencyConversion = {
  cp: {into: "sp", each: 10},
  sp: {into: "gp", each: 10},
  // ep: {into: "gp", each: 2 },
  gp: {into: "pp", each: 10}
};

/* -------------------------------------------- */


// Damage Types
TRPG.damageTypes = {
  "acid": "TRPG.DamageAcid",
  "bludgeoning": "TRPG.DamageBludgeoning",
  "cold": "TRPG.DamageCold",
  "fire": "TRPG.DamageFire",
  "force": "TRPG.DamageForce",
  "lightning": "TRPG.DamageLightning",
  "necrotic": "TRPG.DamageNecrotic",
  "piercing": "TRPG.DamagePiercing",
  "poison": "TRPG.DamagePoison",
  "psychic": "TRPG.DamagePsychic",
  "radiant": "TRPG.DamageRadiant",
  "slashing": "TRPG.DamageSlashing",
  "thunder": "TRPG.DamageThunder"
};

// Damage Resistance Types
TRPG.damageResistanceTypes = mergeObject(foundry.utils.deepClone(TRPG.damageTypes), {
  "physical": "TRPG.DamagePhysical"
});


/* -------------------------------------------- */

/**
 * The valid units of measure for movement distances in the game system.
 * By default this uses the imperial units of feet and miles.
 * @type {Object<string,string>}
 */
TRPG.movementTypes = {
  "burrow": "TRPG.MovementBurrow",
  "climb": "TRPG.MovementClimb",
  "fly": "TRPG.MovementFly",
  "swim": "TRPG.MovementSwim",
  "walk": "TRPG.MovementWalk",
};

/**
 * The valid units of measure for movement distances in the game system.
 * By default this uses the imperial units of feet and miles.
 * @type {Object<string,string>}
 */
TRPG.movementUnits = {
  "m": "TRPG.DistM",
  // "ft": "TRPG.DistFt",
  // "mi": "TRPG.DistMi"
};

/**
 * The valid units of measure for the range of an action or effect.
 * This object automatically includes the movement units from TRPG.movementUnits
 * @type {Object<string,string>}
 */
TRPG.distanceUnits = {
  "none": "TRPG.None",
  "self": "TRPG.DistSelf",
  "touch": "TRPG.DistTouch",
  "spec": "TRPG.Special",
  "any": "TRPG.DistAny"
};
for ( let [k, v] of Object.entries(TRPG.movementUnits) ) {
  TRPG.distanceUnits[k] = v;
}

/* -------------------------------------------- */


/**
 * Configure aspects of encumbrance calculation so that it could be configured by modules
 * @type {Object}
 */
TRPG.encumbrance = {
  currencyPerWeight: 1, //10 grams
  strMultiplier: 10, //Strength value * 10
  vehicleWeightMultiplier: 2000 // 2000 lbs in a ton
};

/* -------------------------------------------- */

/**
 * This Object defines the types of single or area targets which can be applied
 * @type {Object}
 */
TRPG.targetTypes = {
  "none": "TRPG.None",
  "self": "TRPG.TargetSelf",
  "creature": "TRPG.TargetCreature",
  "ally": "TRPG.TargetAlly",
  "enemy": "TRPG.TargetEnemy",
  "object": "TRPG.TargetObject",
  "space": "TRPG.TargetSpace",
  "radius": "TRPG.TargetRadius",
  "sphere": "TRPG.TargetSphere",
  "cylinder": "TRPG.TargetCylinder",
  "cone": "TRPG.TargetCone",
  "square": "TRPG.TargetSquare",
  "cube": "TRPG.TargetCube",
  "line": "TRPG.TargetLine",
  "wall": "TRPG.TargetWall"
};


/* -------------------------------------------- */


/**
 * Map the subset of target types which produce a template area of effect
 * The keys are TRPG target types and the values are MeasuredTemplate shape types
 * @type {Object}
 */
TRPG.areaTargetTypes = {
  cone: "cone",
  cube: "rect",
  cylinder: "circle",
  line: "ray",
  radius: "circle",
  sphere: "circle",
  square: "rect",
  wall: "ray"
};


/* -------------------------------------------- */

// Healing Types
TRPG.healingTypes = {
  "healing": "TRPG.Healing",
  "temphp": "TRPG.HealingTemp"
};


/* -------------------------------------------- */


/**
 * Enumerate the denominations of hit dice which can apply to classes
 * @type {string[]}
 */
TRPG.hitDieTypes = ["d6", "d8", "d10", "d12"];


/* -------------------------------------------- */

/**
 * The set of possible sensory perception types which an Actor may have
 * @enum {string}
 */
TRPG.senses = {
  "blindsight": "TRPG.SenseBlindsight",
  "darkvision": "TRPG.SenseDarkvision",
  "tremorsense": "TRPG.SenseTremorsense",
  "truesight": "TRPG.SenseTruesight"
};

/* -------------------------------------------- */

TRPG.saves = {
	"fortitude": "TRPG.SavesFortitude",
	"reflex": "TRPG.SavesReflex",
	"will": "TRPG.SavesWill"
}

TRPG.bab = {
  "low": "TRPG.Low",
  "med": "TRPG.Medium",
  "high": "TRPG.High"
};

TRPG.classBABFormulas = {
  "low": 0.5,
  "med": 0.75,
  "high": 1
};

/**
 * The set of skill which can be trained
 * @type {Object}
 */
TRPG.skills = {
  "acr": "TRPG.SkillAcr", //Acrobacia
  "ani": "TRPG.SkillAni", //Adestrar Animais
  "ath": "TRPG.SkillAth", //Atletismo
	"atu": "TRPG.SkillAtu", //Atuação
  "cav": "TRPG.SkilLCav", //Cavalgar
  "conArc": "TRPG.SkillArc", //Arcanismo
  "conGeo": "TRPG.SkillGeo", //Geografia
  "conHis": "TRPG.SkillHis", //História
  "conNat": "TRPG.SkillNat", //Natureza
  "conRel": "TRPG.SkillRel", //Religião
  "conTor": "TRPG.SkillTor", //Tormenta
  "cur": "TRPG.SkillCur", //Cura
	"dip": "TRPG.SkillDip", //Diplomacia
	"eng": "TRPG.SkillEng", //Enganação
  "fur": "TRPG.SkillFur", //Furtividade
  "ide": "TRPG.SkillIde", //Identificar Magia
  "init": "TRPG.SkillIni", //Iniciativa
  "inti": "TRPG.SkillInti", //Intimidação
  "intu": "TRPG.SkillIntu", //Intuição
  "lad": "TRPG.SkillLad", //Ladinagem
  "obinf": "TRPG.SkillObinf", //Obter Informação
	"ofi": "TRPG.SkillOfi", //Ofício
  "prc": "TRPG.SkillPrc", //Percepção
  "sur": "TRPG.SkillSur" //Sobrevivência
};


/* -------------------------------------------- */

TRPG.spellPreparationModes = {
  "prepared": "TRPG.SpellPrepPrepared",
  "pact": "TRPG.PactMagic",
  "always": "TRPG.SpellPrepAlways",
  "atwill": "TRPG.SpellPrepAtWill",
  "innate": "TRPG.SpellPrepInnate"
};

TRPG.spellUpcastModes = ["always", "pact", "prepared"];

TRPG.spellProgression = {
  "none": "TRPG.SpellNone",
  "full": "TRPG.SpellProgFull",
  "half": "TRPG.SpellProgHalf",
  "third": "TRPG.SpellProgThird",
  "pact": "TRPG.SpellProgPact",
  "artificer": "TRPG.SpellProgArt"
};

/* -------------------------------------------- */

/**
 * The available choices for how spell damage scaling may be computed
 * @type {Object}
 */
TRPG.spellScalingModes = {
  "none": "TRPG.SpellNone",
  "cantrip": "TRPG.SpellCantrip",
  "level": "TRPG.SpellLevel"
};

/* -------------------------------------------- */


/**
 * Define the set of types which a weapon item can take
 * @type {Object}
 */
TRPG.weaponTypes = {
  "simpleM": "TRPG.WeaponSimpleM",
  "simpleR": "TRPG.WeaponSimpleR",
  "martialM": "TRPG.WeaponMartialM",
  "martialR": "TRPG.WeaponMartialR",
  "natural": "TRPG.WeaponNatural",
  "improv": "TRPG.WeaponImprov",
  "siege": "TRPG.WeaponSiege"
};


/* -------------------------------------------- */

/**
 * Define the set of weapon property flags which can exist on a weapon
 * @type {Object}
 */
TRPG.weaponProperties = {
  "ada": "TRPG.WeaponPropertiesAda",
  "amm": "TRPG.WeaponPropertiesAmm",
  "fin": "TRPG.WeaponPropertiesFin",
  "fir": "TRPG.WeaponPropertiesFir",
  "foc": "TRPG.WeaponPropertiesFoc",
  "hvy": "TRPG.WeaponPropertiesHvy",
  "lgt": "TRPG.WeaponPropertiesLgt",
  "lod": "TRPG.WeaponPropertiesLod",
  "mgc": "TRPG.WeaponPropertiesMgc",
  "rch": "TRPG.WeaponPropertiesRch",
  "rel": "TRPG.WeaponPropertiesRel",
  "ret": "TRPG.WeaponPropertiesRet",
  "sil": "TRPG.WeaponPropertiesSil",
  "spc": "TRPG.WeaponPropertiesSpc",
  "thr": "TRPG.WeaponPropertiesThr",
  "two": "TRPG.WeaponPropertiesTwo",
  "ver": "TRPG.WeaponPropertiesVer"
};


// Spell Components
TRPG.spellComponents = {
  "V": "TRPG.ComponentVerbal",
  "S": "TRPG.ComponentSomatic",
  "M": "TRPG.ComponentMaterial"
};

// Spell Schools
TRPG.spellSchools = {
  "abj": "TRPG.SchoolAbj",
  "con": "TRPG.SchoolCon",
  "div": "TRPG.SchoolDiv",
  "enc": "TRPG.SchoolEnc",
  "evo": "TRPG.SchoolEvo",
  "ill": "TRPG.SchoolIll",
  "nec": "TRPG.SchoolNec",
  "trs": "TRPG.SchoolTrs"
};

// Spell Levels
TRPG.spellLevels = {
  0: "TRPG.SpellLevel0",
  1: "TRPG.SpellLevel1",
  2: "TRPG.SpellLevel2",
  3: "TRPG.SpellLevel3",
  4: "TRPG.SpellLevel4",
  5: "TRPG.SpellLevel5",
  6: "TRPG.SpellLevel6",
  7: "TRPG.SpellLevel7",
  8: "TRPG.SpellLevel8",
  9: "TRPG.SpellLevel9"
};

// Spell Scroll Compendium UUIDs
TRPG.spellScrollIds = {
  0: "rQ6sO7HDWzqMhSI3",
  1: "9GSfMg0VOA2b4uFN",
  2: "XdDp6CKh9qEvPTuS",
  3: "hqVKZie7x9w3Kqds",
  4: "DM7hzgL836ZyUFB1",
  5: "wa1VF8TXHmkrrR35",
  6: "tI3rWx4bxefNCexS",
  7: "mtyw4NS1s7j2EJaD",
  8: "aOrinPg7yuDZEuWr",
  9: "O4YbkJkLlnsgUszZ"
};

/**
 * Compendium packs used for localized items.
 * @enum {string}
 */
TRPG.sourcePacks = {
  ITEMS: "TRPG.items"
}

/**
 * Define the standard slot progression by character level.
 * The entries of this array represent the spell slot progression for a full spell-caster.
 * @type {Array[]}
 */
TRPG.SPELL_SLOT_TABLE = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

/* -------------------------------------------- */

// Polymorph options.
TRPG.polymorphSettings = {
  keepPhysical: 'TRPG.PolymorphKeepPhysical',
  keepMental: 'TRPG.PolymorphKeepMental',
  keepSaves: 'TRPG.PolymorphKeepSaves',
  keepSkills: 'TRPG.PolymorphKeepSkills',
  mergeSaves: 'TRPG.PolymorphMergeSaves',
  mergeSkills: 'TRPG.PolymorphMergeSkills',
  keepClass: 'TRPG.PolymorphKeepClass',
  keepFeats: 'TRPG.PolymorphKeepFeats',
  keepSpells: 'TRPG.PolymorphKeepSpells',
  keepItems: 'TRPG.PolymorphKeepItems',
  keepBio: 'TRPG.PolymorphKeepBio',
  keepVision: 'TRPG.PolymorphKeepVision'
};

/* -------------------------------------------- */

/**
 * Skill, ability, and tool proficiency levels
 * Each level provides a proficiency multiplier
 * @type {Object}
 */
TRPG.proficiencyLevels = {
  0: "TRPG.NotProficient",
  1: "TRPG.Proficient",
  0.5: "TRPG.HalfProficient",
  2: "TRPG.Expertise"
};

/* -------------------------------------------- */

/**
 * The amount of cover provided by an object.
 * In cases where multiple pieces of cover are
 * in play, we take the highest value.
 */
TRPG.cover = {
  0: 'TRPG.None',
  .5: 'TRPG.CoverHalf',
  .75: 'TRPG.CoverThreeQuarters',
  1: 'TRPG.CoverTotal'
};

/* -------------------------------------------- */


// Condition Types
TRPG.conditionTypes = {
  "blinded": "TRPG.ConBlinded",
  "charmed": "TRPG.ConCharmed",
  "deafened": "TRPG.ConDeafened",
  "diseased": "TRPG.ConDiseased",
  "exhaustion": "TRPG.ConExhaustion",
  "frightened": "TRPG.ConFrightened",
  "grappled": "TRPG.ConGrappled",
  "incapacitated": "TRPG.ConIncapacitated",
  "invisible": "TRPG.ConInvisible",
  "paralyzed": "TRPG.ConParalyzed",
  "petrified": "TRPG.ConPetrified",
  "poisoned": "TRPG.ConPoisoned",
  "prone": "TRPG.ConProne",
  "restrained": "TRPG.ConRestrained",
  "stunned": "TRPG.ConStunned",
  "unconscious": "TRPG.ConUnconscious"
};

// Languages
TRPG.languages = {
  "common": "TRPG.LanguagesCommon",
  "abyssal": "TRPG.LanguagesAbyssal",
  "dwarvish": "TRPG.LanguagesDwarvish",
  "aquan": "TRPG.LanguagesAquan",
  "auran": "TRPG.LanguagesAuran",
  "celestial": "TRPG.LanguagesCelestial",
  "draconic": "TRPG.LanguagesDraconic",
  "elvish": "TRPG.LanguagesElvish",
  "giant": "TRPG.LanguagesGiant",
  "goblin": "TRPG.LanguagesGoblin",
  "gnoll": "TRPG.LanguagesGnoll",
  "halfling": "TRPG.LanguagesHalfling",
  "ignan": "TRPG.LanguagesIgnan",
  "infernal": "TRPG.LanguagesInfernal",
  "orc": "TRPG.LanguagesOrc",
  "primordial": "TRPG.LanguagesPrimordial",
  "sylvan": "TRPG.LanguagesSylvan",
  "taurico": "TRPG.LanguagesTaurico",
  "terran": "TRPG.LanguagesTerran"
};

// Character Level XP Requirements
TRPG.CHARACTER_EXP_LEVELS =  [
  0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000,
  78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000]
;

// Character Features Per Class And Level
TRPG.classFeatures = ClassFeatures;

// Configure Optional Character Flags
TRPG.characterFlags = {
  // "diamondSoul": {
  //   name: "TRPG.FlagsDiamondSoul",
  //   hint: "TRPG.FlagsDiamondSoulHint",
  //   section: "Feats",
  //   type: Boolean
  // },
  // "elvenAccuracy": {
  //   name: "TRPG.FlagsElvenAccuracy",
  //   hint: "TRPG.FlagsElvenAccuracyHint",
  //   section: "Racial Traits",
  //   type: Boolean
  // },
  // "halflingLucky": {
  //   name: "TRPG.FlagsHalflingLucky",
  //   hint: "TRPG.FlagsHalflingLuckyHint",
  //   section: "Racial Traits",
  //   type: Boolean
  // },
  // "initiativeAdv": {
  //   name: "TRPG.FlagsInitiativeAdv",
  //   hint: "TRPG.FlagsInitiativeAdvHint",
  //   section: "Feats",
  //   type: Boolean
  // },
  // "initiativeAlert": {
  //   name: "TRPG.FlagsAlert",
  //   hint: "TRPG.FlagsAlertHint",
  //   section: "Feats",
  //   type: Boolean
  // },
  // "jackOfAllTrades": {
  //   name: "TRPG.FlagsJOAT",
  //   hint: "TRPG.FlagsJOATHint",
  //   section: "Feats",
  //   type: Boolean
  // },
  // "observantFeat": {
  //   name: "TRPG.FlagsObservant",
  //   hint: "TRPG.FlagsObservantHint",
  //   skills: ['prc','inv'],
  //   section: "Feats",
  //   type: Boolean
  // },
  // "powerfulBuild": {
  //   name: "TRPG.FlagsPowerfulBuild",
  //   hint: "TRPG.FlagsPowerfulBuildHint",
  //   section: "Racial Traits",
  //   type: Boolean
  // },
  // "reliableTalent": {
  //   name: "TRPG.FlagsReliableTalent",
  //   hint: "TRPG.FlagsReliableTalentHint",
  //   section: "Feats",
  //   type: Boolean
  // },
  // "remarkableAthlete": {
  //   name: "TRPG.FlagsRemarkableAthlete",
  //   hint: "TRPG.FlagsRemarkableAthleteHint",
  //   abilities: ['str','dex','con'],
  //   section: "Feats",
  //   type: Boolean
  // },
  "weaponCriticalThreshold": {
    name: "TRPG.FlagsWeaponCritThreshold",
    hint: "TRPG.FlagsWeaponCritThresholdHint",
    section: "Feats",
    type: Number,
    placeholder: 20
  },
  "spellCriticalThreshold": {
    name: "TRPG.FlagsSpellCritThreshold",
    hint: "TRPG.FlagsSpellCritThresholdHint",
    section: "Feats",
    type: Number,
    placeholder: 20
  },
  "meleeCriticalDamageDice": {
    name: "TRPG.FlagsMeleeCriticalDice",
    hint: "TRPG.FlagsMeleeCriticalDiceHint",
    section: "Feats",
    type: Number,
    placeholder: 0
  },
};

// Configure allowed status flags
TRPG.allowedActorFlags = ["isPolymorphed", "originalActor"].concat(Object.keys(TRPG.characterFlags));
