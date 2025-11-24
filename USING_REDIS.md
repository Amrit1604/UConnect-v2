# Using Redis with UConnect — Quick Guide (for demo / RedisInsight)

This guide helps you: install Redis locally, run RedisInsight, connect it to your local Redis instance, and demonstrate data with a small demo route in the UConnect app.

## 1) Install Redis locally
- macOS (Homebrew):
  ```bash
  brew install redis
  brew services start redis  # runs Redis as a background service
  redis-cli ping            # should return PONG
  ```
- Docker (all systems):
  ```bash
  docker run -d --name uconnect-redis -p 6379:6379 redis
  docker exec -it uconnect-redis redis-cli ping # PONG
  ```

## 2) Install RedisInsight
- Download RedisInsight from https://www.redis.com/redis-insight/ and run it locally.
- In RedisInsight, add a new Redis database with Host: `localhost`, Port: `6379` (default).

## 3) Use the Redis demo routes
We added a simple demo route and a caching middleware so you can show operations in RedisInsight.
### Routes available (after running the server locally):
- POST /redis/set — Set a key in Redis
  - request body (JSON): { "key": "mykey", "value": "myvalue", "ttl": 3600 }
  - Example:
    ```bash
    curl -X POST http://localhost:4000/redis/set -H "Content-Type: application/json" -d '{"key":"demo:1","value":{"name":"test","value":123}}'
    ```
- GET /redis/get?key=KEY — Get value from Redis
  - Example:
    ```bash
    curl http://localhost:4000/redis/get?key=demo:1
    ```
- GET /redis/expensive?id=123 — Demo route that performs an expensive operation and caches the result for 30s.
  - Use curl to call and hit the cache twice: first call should return MISS, next ones HIT.
    ```bash
    curl http://localhost:4000/redis/expensive?id=1
    ```

## 4) Observe data in RedisInsight
1. After you set a key using POST `/redis/set`, open RedisInsight and browse the Keys view.
2. The `demo:1` key should appear — click to inspect the value.
3. For the cached `/redis/expensive` route, watch keys like `expensive:1` appear and expire after 30 seconds (depending on TTL).

## 5) Environment variables
Define a `REDIS_URL` value in your `.env` file (or `export` in shell):
```
REDIS_URL=redis://127.0.0.1:6379
```

## 6) Notes and considerations
- This demo stores JSON as values for convenience; in production you may store IDs, short strings, or use Redis Hashes/Sets for structured data.
- For session storage in production, consider `connect-redis` or Redis Cluster depending on scale.
- In this repo, Redis is used only for development/demo features unless configured otherwise.
  - Sessions (when `REDIS_URL` is set and `SESSION_STORE=redis`) are stored under `sess:<session-id>`.
  - Cached responses (from the demo route GET `/redis/expensive`) are stored under `expensive:<id>`.
  - Keys created by `POST /redis/set` are stored with your provided key name (e.g., `demo:1`).
  - The demo `activity_log` (if used by other routes) is stored as a Redis list (LPUSH, LRANGE).

---

## 7) What the project does NOT store in Redis
- Binary uploads (photos/videos) are stored using GridFS (MongoDB) or cloud storage — not in Redis.
- The database of users, posts, comments, and the primary app data are still stored in MongoDB.

---

## 8) Verify keys with the CLI
Use the Redis CLI tools for a quick check and diagnostics:
```bash
# List keys (development only - KEYS is O(N) on DB size, use with care)
redis-cli keys '*'

# Check a specific session key or cached key
redis-cli get 'sess:*'   # will show only one if pattern matches exactly
redis-cli get 'expensive:1'
redis-cli ttl 'expensive:1'   # Check TTL on cached keys

# Inspect a list
redis-cli lrange activity_log 0 -1
```

For production-scale datasets, prefer SCAN over KEYS:
```bash
redis-cli --scan --pattern 'sess:*' | xargs -r redis-cli --no-input del
```

---

## 9) Remove demo data from RedisInsight or CLI (safest methods)
Sometimes you want to clean demo keys after your evaluation — here are safe ways to remove keys.

Important: **do not run** `FLUSHALL` on a production server unless you're sure — it removes **all** keys from all databases.

Safe deletion by pattern (developer machine only):

Using Redis CLI with SCAN (recommended) — non-blocking:
```bash
# Delete all demo: keys
redis-cli --scan --pattern 'demo:*' | xargs -r redis-cli unlink

# Delete cached expensive keys
redis-cli --scan --pattern 'expensive:*' | xargs -r redis-cli unlink

# Delete session keys (careful)
redis-cli --scan --pattern 'sess:*' | xargs -r redis-cli unlink
```

Using KEYS (dangerous for large DBs):
```bash
redis-cli keys 'demo:*' | xargs redis-cli del
```

Using RedisInsight GUI:
1. Connect to your Redis database and go to the Keys view.
2. Search for patterns such as `demo:*`, `expensive:*` or `sess:*`.
3. Select keys and use the `Delete` action. Confirm the deletion.

---

## 10) Quick demo flow (recommended for your evaluation)
1. Start Redis & RedisInsight (or `docker run` commands above).
2. Start the UConnect app with `REDIS_URL` configured and `NODE_ENV=development`.
3. Use `POST /redis/set` → inspect the key in RedisInsight.
4. Use `GET /redis/expensive?id=1` twice to show `X-Cache: MISS` then `X-Cache: HIT` and inspect TTL.
5. Use the login form — the session string should be stored if sessions are configured to use Redis — show `sess:*` in RedisInsight.
6. After your demo: remove the demo keys via RedisInsight or CLI (see step 9).

---

## 11) Troubleshooting tips
- If `redis-cli ping` fails: install or start Redis or use Docker.
- If session keys don't appear: ensure `SESSION_STORE=redis` or `REDIS_URL` is set and the server is restarted.
- If you see `ClientClosedError` in logs: ensure the Redis sessions client isn't shutdown by other code; server restart helps.
- If TTLs are 0: you may have created values without TTL; set TTL with `EX` via the demo route or with `expire` CLI.

---

If you'd like, I can add a `docker-compose.yml` to run the app, Redis, and RedisInsight together so your demo is reproducible and clean, or add a temporary admin route to list keys (dev only). Tell me which you prefer.


If you want more advanced examples (pub/sub, streams, caching top N posts, session storage), let me know and I’ll add them.
