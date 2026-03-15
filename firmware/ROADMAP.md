# Orchid Sensor Firmware Roadmap

## Current State
- ESP32 with DHT11 (temp/humidity) and capacitive soil moisture sensor
- Hybrid mode: local reads every 30s, sends every 10min or on significant delta
- Delta detection triggers auto-logged care events (watering)
- BH1750 light sensor in code but needs soldering for reliable connection

## Planned

### Watering Confirmation Window
**Problem:** A splash of water near the probe looks like a full watering. Soil moisture spikes, care event logs, but 15 minutes later moisture drops back because the water flowed elsewhere — the plant wasn't actually watered.

**Solution:** Firmware-side confirmation. On detecting a soil moisture spike (>15%), mark it as "pending" internally. Continue reading locally every 30s. After 10-15 minutes, if soil is still within ~10% of the spike, confirm it was a real watering and send the delta trigger. If it dropped back near the original level, discard — it was a false positive.

**Why firmware-side:** The ESP32 is already reading every 30s locally. No extra server round trips needed. Self-contained logic.

### On-Demand Live Readings
ESP32 polls a lightweight endpoint every ~30s: "any pending read requests?" When a user or Orchid asks "check my plant," a request is queued. ESP32 picks it up on next poll and sends a fresh reading. Max 30s delay.

Alternative: WebSocket/MQTT for instant push (more complex, more power draw).

### BH1750 Light Sensor
Works in code but breadboard connections are unreliable without soldering. Options:
- Solder header pins properly
- Use a different mounting approach
- Try a different light sensor module

### Nutrient/EC Sensor
Electrical conductivity sensor to detect soil nutrient levels. Similar delta logic to soil moisture — significant changes in EC could indicate fertilizing events.

### Battery/Power Optimization
- Deep sleep between readings to extend battery pack life
- Wake on timer (10min) or external interrupt
- Report battery level if powered by LiPo + voltage divider

### OTA Firmware Updates
Over-the-air updates so the ESP32 can be reflashed without plugging into a computer. Useful once the device is mounted near a plant permanently.
