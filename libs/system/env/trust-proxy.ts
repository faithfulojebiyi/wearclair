/**
 * fastify `trustProxy` from TRUST_PROXY: unset -> false (never trust
 * x-forwarded-for off-LB — it is client-spoofable), 'true' -> trust all hops,
 * a number -> hop count, anything else -> CIDR/address list.
 */
export const parseTrustProxy = (
  raw: string | undefined,
): boolean | number | string => {
  if (!raw) {
    return false;
  }

  if (raw === 'true') {
    return true;
  }

  const hops = Number(raw);

  return Number.isInteger(hops) && hops > 0 ? hops : raw;
};
