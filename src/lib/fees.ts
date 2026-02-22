export const APP_FEE_RATE = 0.3;

export function calcDeliveryAppFee(grossDelivery: number) {
  return grossDelivery * APP_FEE_RATE;
}

export function calcDeliveryNetAfterApps(
  grossDelivery: number,
  netDelivery: number
) {
  return netDelivery - calcDeliveryAppFee(grossDelivery);
}

export function calcProductNetRealAfterApps(p: {
  channels: {
    restaurant: { net_total: number };
    delivery: { gross_total: number; net_total: number };
  };
}) {
  const rNet = p.channels.restaurant.net_total ?? 0;
  const dGross = p.channels.delivery.gross_total ?? 0;
  const dNet = p.channels.delivery.net_total ?? 0;

  return rNet + calcDeliveryNetAfterApps(dGross, dNet);
}
