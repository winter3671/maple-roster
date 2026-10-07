export const IPC_CHANNELS = {
  systemGetInfo: 'system:get-info',
  charactersList: 'characters:list',
  charactersCreate: 'characters:create',
  charactersUpdate: 'characters:update',
  charactersSetHidden: 'characters:set-hidden',
  charactersRemove: 'characters:remove',
  huntingList: 'hunting:list',
  huntingCreate: 'hunting:create',
  huntingUpdate: 'hunting:update',
  huntingRemove: 'hunting:remove',
  ledgerList: 'ledger:list'
} as const
