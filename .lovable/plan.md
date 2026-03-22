

# Fix: Add Sensor from Profile + Token Disappearing on Create

## Two Issues

### 1. No "Add Sensor" button on profile page
The `DeviceManagement` component (used on the profile/settings page) only lists existing devices. When there are no devices, it says "ask orchid to set up a sensor device" — there's no button to create one. The `SensorPicker` component (which has create functionality) only exists in `PlantVitals.tsx` and requires a `plantId`.

**Fix**: Add an "add new sensor" button and inline create form to `DeviceManagement`. This creates a device without a plant assignment (unassigned/pulse-check mode). Show the token after creation.

### 2. Token flashes then disappears on plant page
When `handleCreateAndAssign` succeeds, it sets `newToken` state to show the token. But `useCreateDevice`'s `onSuccess` callback calls `queryClient.invalidateQueries({ queryKey: ["devices"] })`, which triggers a re-render of the parent `PlantVitals` component. Since `SensorPicker` is conditionally rendered and its state is local, the re-render resets `newToken` to `null`.

**Fix**: Lift the `newToken` state up — or more simply, remove the `queryClient.invalidateQueries` from happening immediately on create success and instead defer it until the user clicks "done" on the token display. Alternatively, use a `ref` to persist the token across re-renders triggered by query invalidation.

The cleanest fix: in `useCreateDevice`, don't invalidate queries in `onSuccess`. Instead, have the `SensorPicker`'s "done" button manually invalidate queries when the user dismisses the token view.

## Changes

### `src/components/dashboard/DeviceManagement.tsx`
- Add state for `showAddNew`, `newToken`, `newName`, `copied`
- Add "add new sensor" button in the header area (or below the device list)
- Add inline form: name input + "create" button
- On create success, show token with copy button + "done" dismissal
- On "done", invalidate devices query

### `src/hooks/useDevices.ts`
- In `useCreateDevice`, remove the `onSuccess` query invalidation (move it to be caller-controlled)
- Or: keep it but wrap in a slight delay that won't cause the token view to reset

### `src/components/plants/PlantVitals.tsx`
- In `SensorPicker`, after creating a device and showing the token, only invalidate queries when user clicks "done" (not automatically on mutation success)
- This prevents the parent re-render that kills `newToken` state

## Technical Detail

The root cause of the token flash: `useCreateDevice.onSuccess` → `invalidateQueries(["devices"])` → `PlantVitals` re-renders (it also calls `useDevices()`) → `SensorPicker` re-mounts → `newToken` resets to `null`.

Fix approach: Remove auto-invalidation from `useCreateDevice`. Instead, manually call `queryClient.invalidateQueries({ queryKey: ["devices"] })` in both the `SensorPicker` "done" handler and the new `DeviceManagement` "done" handler.

