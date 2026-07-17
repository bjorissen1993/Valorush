import type { PlayerInGame } from "../../types/Game";

export type WeaponName =
  | "Shorty"
  | "Frenzy"
  | "Ghost"
  | "Bandit"
  | "Sheriff"
  | "Stinger"
  | "Spectre"
  | "Bucky"
  | "Judge"
  | "Bulldog"
  | "Guardian"
  | "Phantom"
  | "Vandal"
  | "Marshal"
  | "Outlaw"
  | "Operator"
  | "Ares"
  | "Odin";

export const SHOP_TILE_DISCOUNT = 300;

export const weaponPrices: Record<WeaponName, number> = {
  // Sidearms
  Shorty: 300,
  Frenzy: 450,
  Ghost: 500,
  Bandit: 600,
  Sheriff: 800,

  // SMGs
  Stinger: 1100,
  Spectre: 1600,

  // Shotguns
  Bucky: 850,
  Judge: 1850,

  // Rifles
  Bulldog: 2050,
  Guardian: 2250,
  Phantom: 2900,
  Vandal: 2900,

  // Snipers
  Marshal: 950,
  Outlaw: 2400,
  Operator: 4700,

  // Machine guns
  Ares: 1600,
  Odin: 3200,
};

export const shopWeapons: WeaponName[] = [
  "Shorty",
  "Frenzy",
  "Ghost",
  "Bandit",
  "Sheriff",
  "Stinger",
  "Spectre",
  "Bucky",
  "Judge",
  "Bulldog",
  "Guardian",
  "Phantom",
  "Vandal",
  "Marshal",
  "Outlaw",
  "Operator",
  "Ares",
  "Odin"
];

export function getWeaponFinalPrice(args: {
  weapon: WeaponName;
  player: PlayerInGame;
  isOnShopTile: boolean;
}) {
  const { weapon, player, isOnShopTile } = args;

  const tileDiscount = isOnShopTile ? SHOP_TILE_DISCOUNT : 0;
  const bonusDiscount = player.nextWeaponDiscount;
  const basePrice = weaponPrices[weapon];

  return Math.max(0, basePrice - tileDiscount - bonusDiscount);
}

export function canAffordWeapon(args: {
  weapon: WeaponName;
  player: PlayerInGame;
  isOnShopTile: boolean;
}) {
  const price = getWeaponFinalPrice(args);
  return args.player.creds >= price;
}

export function buyWeaponForPlayer(args: {
  weapon: WeaponName;
  player: PlayerInGame;
  isOnShopTile: boolean;
  slot?: "primary" | "secondary";
}) {
  const { weapon, player, isOnShopTile, slot = "primary" } = args;
  const finalPrice = getWeaponFinalPrice({ weapon, player, isOnShopTile });

  if (player.creds < finalPrice) {
    return {
      success: false as const,
      finalPrice,
      updatedPlayer: player,
    };
  }

  const updatedPlayer: PlayerInGame =
    slot === "secondary"
      ? {
          ...player,
          creds: player.creds - finalPrice,
          secondaryWeapon: weapon,
          nextWeaponDiscount: 0,
        }
      : {
          ...player,
          creds: player.creds - finalPrice,
          primaryWeapon: weapon,
          weapon,
          nextWeaponDiscount: 0,
        };

  return {
    success: true as const,
    finalPrice,
    updatedPlayer,
  };
}

const SHOP_LOCATION_BY_KEEPER: Record<string, string> = {
  Raze: "Scrapyard",
  Killjoy: "Workshop",
  Brimstone: "Garage",
  Chamber: "Armory",
  Viper: "Lab",
  Cypher: "Workshop",
};

export function getShopLocationLabel(keeperName: string): string {
  const place = SHOP_LOCATION_BY_KEEPER[keeperName] ?? "Armory";
  return `${keeperName}'s ${place}`;
}