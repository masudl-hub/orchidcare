// Orchid IoT Sensor — ESP32 firmware
// Reads soil moisture, temperature, and humidity.
// POSTs readings to Supabase edge function via HTTPS.
//
// WIRING:
//   Capacitive soil moisture sensor AOUT → GPIO 32
//   DHT11 data pin                       → GPIO 4
//   All sensors VCC                      → 3.3V
//   All sensors GND                      → GND

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

// ==========================================================================
// USER CONFIG — edit these values for your setup
// ==========================================================================
const char* WIFI_SSID      = "dadjokes";
const char* WIFI_PASS      = "gobiggreen";
const char* ENDPOINT       = "https://ewkfjmekrootyiijrgfh.supabase.co/functions/v1/sensor-reading";
const char* DEVICE_TOKEN   = "odev_hp4wGjI0wPwDx18KSAHXSSvOXxWVnTRkH7Wu4E9fuFg";
const char* ANON_KEY       = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3a2ZqbWVrcm9vdHlpaWpyZ2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTUyNDQsImV4cCI6MjA4NzA3MTI0NH0.rSRq4mlDNetIvQV1uP9b6HM3XbclcVCcEcMyQa37kKQ";

const int READ_INTERVAL_SEC = 20;  // 3 per minute (under rate limit of 4/min)

// Soil moisture calibration
const int SOIL_DRY_VALUE   = 3200; // Raw ADC value in dry air
const int SOIL_WET_VALUE   = 1500; // Raw ADC value submerged in water
// ==========================================================================

// Pin assignments
#define SOIL_PIN     32   // ADC1_CH4
#define DHT_PIN      4
#define DHT_TYPE     DHT11

// Sensor instances
DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Orchid Sensor ===");

  analogSetAttenuation(ADC_11db);
  dht.begin();

  Serial.println("Warming up sensors...");
  delay(2000);

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

  // Log to Serial
  Serial.printf("[Reading] Soil: %d%% (raw: %d) | Temp: %.1f°C | Humidity: %.1f%%\n",
    soilPct, soilRaw, temperature, humidity);

  // Build JSON payload
  String json = "{";
  json += "\"soil_moisture\":" + String(soilPct);
  if (!isnan(temperature)) json += ",\"temperature\":" + String(temperature, 1);
  if (!isnan(humidity))    json += ",\"humidity\":" + String(humidity, 1);
  json += "}";

  // POST to endpoint
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + ANON_KEY);
  http.addHeader("apikey", ANON_KEY);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  int httpCode = http.POST(json);
  String response = http.getString();

  if (httpCode == 200) {
    Serial.printf("[OK] %s\n", response.c_str());
  } else {
    Serial.printf("[ERROR] HTTP %d: %s\n", httpCode, response.c_str());
  }

  http.end();

  delay(READ_INTERVAL_SEC * 1000);
}
