// Minis stand in SLOT_COUNT slots round the main mascot: beside its feet, by its shoulders, then
// further out (see slotOffset). Their places follow from how big they are next to it.
export const SLOT_COUNT = 6;
export const SLOT_GAP = 2; // main grid pixels between neighbouring bodies at half size; it scales with the minis

export const BADGE_CLEARANCE = 5; // mini pixels between the +N badge and the mini under it

export const GLIDE_MS = 160;
// A dragged crew trails the pointer a little, so it follows rather than sticks to it.
export const FOLLOW_MS = 110;
