// Orchid IoT Sensor — ESP32 firmware
// Reads soil moisture, temperature, humidity, and light level.
// POSTs readings to Supabase edge function via HTTPS.
//
// WIRING:
//   Capacitive soil moisture sensor → GPIO 34 (analog)
//   DHT11 data pin                  → GPIO 4
//   BH1750 SDA                      → GPIO 21 (I2C default)
//   BH1750 SCL                      → GPIO 22 (I2C default)
//   All sensors VCC                 → 3.3V
//   All sensors GND                 → GND
//
// LIBRARIES (install via Arduino Library Manager):
//   - "DHT sensor library" by Adafruit
//   - "Adafruit Unified Sensor" by Adafruit
//   - "BH1750" by Christopher Laws

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <Wire.h>
#include <BH1750.h>

// ==========================================================================
// USER CONFIG — edit these values for your setup
// ==========================================================================
const char* WIFI_SSID      = "dadjokes";
const char* WIFI_PASS      = "gobiggreen";
const char* ENDPOINT       = "https://ewkfjmekrootyiijrgfh.supabase.co/functions/v1/sensor-reading";
const char* DEVICE_TOKEN   = "odev_hp4wGjI0wPwDx18KSAHXSSvOXxWVnTRkH7Wu4E9fuFg";
const char* ANON_KEY       = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3a2ZqbWVrcm9vdHlpaWpyZ2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTUyNDQsImV4cCI6MjA4NzA3MTI0NH0.rSRq4mlDNetIvQV1uP9b6HM3XbclcVCcEcMyQa37kKQ";

const int READ_INTERVAL_SEC = 600; // 10 minutes

// Soil moisture calibration (run calibration mode to find your values)
const int SOIL_DRY_VALUE   = 3200; // Raw ADC value in dry air
const int SOIL_WET_VALUE   = 1500; // Raw ADC value submerged in water
// ==========================================================================

// Pin assignments
#define SOIL_PIN     32   // ADC1_CH4 — GPIO 35 had UART conflict
#define DHT_PIN      4
#define DHT_TYPE     DHT11

// Sensor instances
DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;

// Calibration mode: hold GPIO 0 (BOOT button) low on startup
#define CALIBRATION_PIN 0
#define CALIBRATION_DURATION_SEC 60

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Orchid Sensor ===");

  // Init sensors
  analogSetAttenuation(ADC_11db);  // Set ADC to read full 0-3.3V range
  dht.begin();
  Wire.begin(18, 19);  // SDA=GPIO18 (row 9), SCL=GPIO19 (row 10) — trying alternate pins
  // Scan I2C bus to see what's connected
  Serial.println("Scanning I2C bus...");
  int devicesFound = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  Found device at address 0x%02X\n", addr);
      devicesFound++;
    }
  }
  Serial.printf("  %d device(s) found\n", devicesFound);

  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("[WARN] BH1750 not found — light readings will be skipped");
  }

  // DHT11 needs 2 seconds to warm up before first read
  Serial.println("Warming up sensors...");
  delay(2000);

  // Check for calibration mode (BOOT button held on startup)
  pinMode(CALIBRATION_PIN, INPUT_PULLUP);
  if (digitalRead(CALIBRATION_PIN) == LOW) {
    runCalibration();
  }

  // Connect WiFi
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi connection FAILED — will retry in loop");
  }
}

void loop() {
  // Reconnect WiFi if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(5000);
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Still disconnected, will retry next cycle");
      delay(READ_INTERVAL_SEC * 1000);
      return;
    }
  }

  // Read sensors
  int soilRaw = analogRead(SOIL_PIN);
  int soilPct = map(soilRaw, SOIL_DRY_VALUE, SOIL_WET_VALUE, 0, 100);
  soilPct = constrain(soilPct, 0, 100);

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float lux = lightMeter.readLightLevel();

  // Log to Serial
  Serial.printf("[Reading] Soil: %d%% (raw: %d) | Temp: %.1f°C | Humidity: %.1f%% | Light: %.0f lux\n",
    soilPct, soilRaw, temperature, humidity, lux);

  // Build JSON payload
  String json = "{";
  json += "\"soil_moisture\":" + String(soilPct);
  if (!isnan(temperature)) json += ",\"temperature\":" + String(temperature, 1);
  if (!isnan(humidity))    json += ",\"humidity\":" + String(humidity, 1);
  if (lux >= 0)            json += ",\"light_lux\":" + String(lux, 0);
  json += "}";

  // POST to endpoint
  WiFiClientSecure client;
  client.setInsecure(); // Skip cert validation (fine for demo, use root CA in production)

  HTTPClient http;
  http.begin(client, ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + ANON_KEY);
  http.addHeader("apikey", ANON_KEY);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int httpCode = http.POST(json);
  String response = http.getString();

  if (httpCode == 200) {
    Serial.printf("[OK] Posted successfully: %s\n", response.c_str());
  } else {
    Serial.printf("[ERROR] HTTP %d: %s\n", httpCode, response.c_str());
  }

  http.end();

  delay(READ_INTERVAL_SEC * 1000);
}

// ==========================================================================
// CALIBRATION MODE
// Prints raw sensor values for 60 seconds so you can determine
// SOIL_DRY_VALUE (sensor in air) and SOIL_WET_VALUE (sensor in water).
// ==========================================================================
void runCalibration() {
  Serial.println("\n*** CALIBRATION MODE ***");
  Serial.println("1. Note the 'Soil raw' value with sensor in AIR  → that's SOIL_DRY_VALUE");
  Serial.println("2. Dip sensor in water, note the value            → that's SOIL_WET_VALUE");
  Serial.println("3. Update the constants at the top of this file");
  Serial.printf("Reading for %d seconds...\n\n", CALIBRATION_DURATION_SEC);

  unsigned long start = millis();
  while (millis() - start < CALIBRATION_DURATION_SEC * 1000UL) {
    int soilRaw = analogRead(SOIL_PIN);
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    float lux = lightMeter.readLightLevel();

    Serial.printf("Soil raw: %4d | Temp: %5.1f°C | Humidity: %5.1f%% | Light: %7.0f lux\n",
      soilRaw, temperature, humidity, lux);
    delay(1000);
  }

  Serial.println("\nCalibration done. Reboot without holding BOOT to enter normal mode.");
  while (true) delay(1000); // Halt
}
