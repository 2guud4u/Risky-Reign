# Public Deployment Plan — Risky Reign

Goal: let anyone with the URL join a game, while keeping the home box as
exposed as possible to nothing else.

## Current state (verified 2026-09-25)

- Docker container `catan-server` (non-root, read-only rootfs, no-new-privileges)
- Port 3001 bound to the Tailscale IP only (`100.127.5.96`) — LAN and internet refused
- ufw: default-deny incoming; only `4164/udp` (Tailscale) + `22/tcp` from `192.168.8.0/24`
- No router port forwarding; Tailscale is userspace (unaffected by ufw)
- Game has **no authentication** — the room code is the only barrier (fine for tailnet, relevant once public)
- Measured draw: ~25 W idle / ~32 W under full load

## Phase 1 — Home LAN test (do first)

1. Temporarily expose to the home LAN:
   - `docker-compose.yml`: add a second port entry `192.168.8.208:3001:3001`
   - `sudo ufw allow from 192.168.8.0/24 to any port 3001 proto tcp`
   - `docker compose up -d`
2. Playtest from a home device at **http://192.168.8.208:3001**:
   - [ ] UI loads, board renders
   - [ ] 2+ players join one room and complete a full turn
   - [ ] Refresh mid-game — state persists while the container runs
   - [ ] Note any latency / bugs to fix before going public
3. Optional cleanup before Phase 2 (keeps surface minimal):
   - remove the LAN binding from `docker-compose.yml`
   - `sudo ufw delete allow from 192.168.8.0/24 to any port 3001 proto tcp`
   - `docker compose up -d`

## Phase 2 — Go public via Tailscale Funnel

1. Enable (persistent across reboots, no router changes):
   ```
   sudo tailscale funnel 3001
   ```
   This prints the public URL: `https://<machine>-<id>.ts.net`
2. Verify from **outside the home network** (phone on cellular data):
   - [ ] UI loads over HTTPS
   - [ ] Two players in one room, one on cellular — WebSocket works, no dropped connections
   - [ ] Latency acceptable for turn-based play
3. Share the URL.

### Optional: custom domain (later)

- Buy a domain (~$10/yr), then:
  ```
  sudo tailscale funnel 3001 --www yourdomain.com
  ```
- DNS: CNAME `yourdomain.com` → `<machine>.ts.net`; Tailscale provisions the cert.

## Security checklist (public)

- [x] No router port forwarding — inbound traffic enters via Tailscale infrastructure
- [x] ufw default-deny; only 4164/udp + LAN-scoped SSH
- [x] Container hardening (non-root, read-only, no-new-privileges)
- [ ] **No auth by design** — strangers can join; room code is the only barrier
- [ ] **No rate limiting** — a malicious actor can open many connections; watch CPU
- [ ] Tailscale free plan limits: 3 users / 100 devices (Funnel allowed on free)

## Rollback (take it down, one command)

```
sudo tailscale funnel --close 3001
```

The game immediately returns to tailnet-only; nothing else changes.

## Monitoring while public

- `docker stats catan-server --no-stream` — CPU / memory
- `tailscale status` — peer count
- If abused: close the funnel, `docker restart catan-server`
  (in-memory state resets — expected, no DB yet)
