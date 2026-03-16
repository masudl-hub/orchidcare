

## Plan: Fix Build Errors & Deploy All Edge Functions

### Fix 1: `ShoppingResults.tsx` — Framer Motion `ease` type error
The `cardItem` variants object on line 67 uses `ease: [0.16, 1, 0.3, 1]` which is a cubic bezier tuple. Framer Motion's types expect this as a tuple `[number, number, number, number]`, not `number[]`. Fix by casting with `as const` or extracting the ease value.

**Change line 65-68** from:
```ts
const cardItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};
```
to:
```ts
const cardItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};
```

### Fix 2: `useDevices.ts` — insert type mismatch
**Change line 112** to wrap the object in an array:
```ts
.insert([{
  device_id: deviceId,
  command,
  payload: payload || null,
  status: "pending",
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
}])
```

### Deploy
After fixes, deploy all 12 edge functions: `api`, `call-session`, `delete-account`, `delete-message`, `demo-agent`, `dev-call-proxy`, `orchid-agent`, `proactive-agent`, `pwa-agent`, `sensor-reading`, `summarise-call`, `telegram-bot`.

