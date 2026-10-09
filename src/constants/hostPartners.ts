/**
 * The starting price per room shown to Airbnb hosts, landlords and property
 * managers on the Partners page and in their flyer, in whole dollars.
 *
 * Set this once the price is decided. While it is null, both places say rooms
 * are priced per quote instead of showing a number.
 */
export const HOST_ROOM_STARTING_PRICE: number | null = null;

/** "Rooms from $X per room", or a request-a-quote line while no price is set. */
export function hostRoomPriceLabel(price: number | null = HOST_ROOM_STARTING_PRICE): string {
  return price === null ? 'Priced per room. Request a quote.' : `Rooms from $${price} per room.`;
}
