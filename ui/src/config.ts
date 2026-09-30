/**
 * Socket server url. Resolution order:
 * 1. `VITE_SOCKET_URL` — build/dev-time override. `.env.development` sets it
 *    to the backend's :3001 because the Vite dev server runs on :3000.
 * 2. Same origin as the page — single-origin deployments, where the backend
 *    serves the built UI (the production default).
 */
export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL || window.location.origin;
