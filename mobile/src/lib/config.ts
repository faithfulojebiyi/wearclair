// api origin. Simulators reach the host machine via localhost; a physical device
// needs the Mac's LAN IP (set EXPO_PUBLIC_API_URL in mobile/.env, e.g.
// http://192.168.1.20:3310 — the api listens on 0.0.0.0).
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3310';
