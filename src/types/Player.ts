export type Player = {
  id: number;
  slotIndex: number;
  name: string;
  avatar?: string;
  twitchLogin?: string;
  twitchId?: string;
  twitchImportedName?: string;
  selectedAgentId?: string;
  isRandomizePending?: boolean;
  color?: string;
};