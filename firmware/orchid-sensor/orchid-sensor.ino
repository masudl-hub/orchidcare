// Orchid IoT Sensor — ESP32 firmware
// Hybrid mode: reads locally every 30s, sends to server every 10 min OR
// immediately when a significant change is detected (e.g., watering event).

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <Wire.h>
#include <BH1750.h>

// ==========================================================================
// USER CONFIG
// ==========================================================================
const char* WIFI_SSID      = "dadjokes";
const char* WIFI_PASS      = "gobiggreen";
const char* ENDPOINT       = "https://ewkfjmekrootyiijrgfh.supabase.co/functions/v1/sensor-reading";
const char* DEVICE_TOKEN   = "odev_hp4wGjI0wPwDx18KSAHXSSvOXxWVnTRkH7Wu4E9fuFg";
const char* ANON_KEY       = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3a2ZqbWVrcm9vdHlpaWpyZ2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTUyNDQsImV4cCI6MjA4NzA3MTI0NH0.rSRq4mlDNetIvQV1uP9b6HM3XbclcVCcEcMyQa37kKQ";

// Timing
const int LOCAL_READ_SEC    = 30;   // Read sensors locally every 30s
const int SEND_INTERVAL_SEC = 600;  // Send to server every 10 min

// Delta thresholds — trigger immediate send when exceeded
const int SOIL_DELTA_THRESHOLD    = 15;  // Soil moisture % change (e.g., watering)
const float TEMP_DELTA_THRESHOLD  = 5.0; // Temperature °C change
const float HUMID_DELTA_THRESHOLD = 15.0; // Humidity % change

// Soil moisture calibration
const int SOIL_DRY_VALUE   = 3200;
const int SOIL_WET_VALUE   = 1500;
// ==========================================================================

// Pin assignments
#define SOIL_PIN     32
#define DHT_PIN      4
#define DHT_TYPE     DHT11
#define LED_PIN      2   // Onboard LED (most ESP32 dev boards)

// Sensor instances
DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;
bool bh1750Available = false;

// State for delta detection
int lastSentSoil = -1;
float lastSentTemp = -999;
float lastSentHumid = -999;
unsigned long lastSendTime = 0;
bool forceReadNow = false;  // Set by "read_now" command

// Blink the onboard LED rapidly (for "identify" command)
void blinkIdentify() {
  Serial.println("[CMD] Identify — blinking LED");
  for (int i = 0; i < 20; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}

// Parse server response for commands (simple string matching)
void handleCommands(const String& response) {
  if (response.indexOf("\"commands\"") == -1) return;

  if (response.indexOf("\"identify\"") != -1) {
    blinkIdentify();
  }
  if (response.indexOf("\"read_now\"") != -1) {
    Serial.println("[CMD] Read now — will send on next cycle");
    forceReadNow = true;
  }
  if (response.indexOf("\"set_interval\"") != -1) {
    // Future: parse payload for new interval
    Serial.println("[CMD] Set interval — not yet implemented");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Orchid Sensor (Hybrid Mode) ===");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  analogSetAttenuation(ADC_11db);
  dht.begin();
  Wire.begin(18, 19);

  // Try to find BH1750
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    bh1750Available = true;
    Serial.println("[OK] BH1750 light sensor found");
  } else {
    Serial.println("[WARN] BH1750 not found — light readings will be skipped");
  }

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

  // Send first reading immediately on boot
  lastSendTime = 0;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    delay(5000);
    if (WiFi.status() != WL_CONNECTED) {
      delay(LOCAL_READ_SEC * 1000);
      return;
    }
  }

  // Read sensors locally
  int soilRaw = analogRead(SOIL_PIN);
  int soilPct = map(soilRaw, SOIL_DRY_VALUE, SOIL_WET_VALUE, 0, 100);
  soilPct = constrain(soilPct, 0, 100);

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float lux = bh1750Available ? lightMeter.readLightLevel() : -1;

  Serial.printf("[Local] Soil: %d%% | Temp: %.1f°C | Humidity: %.1f%%",
    soilPct, temperature, humidity);
  if (bh1750Available) Serial.printf(" | Light: %.0f lux", lux);

  // Decide whether to send
  unsigned long now = millis();
  bool timeToSend = (now - lastSendTime) >= ((unsigned long)SEND_INTERVAL_SEC * 1000);
  bool firstReading = (lastSentSoil == -1);

  // Check deltas against last SENT values
  bool soilDelta = !firstReading && abs(soilPct - lastSentSoil) >= SOIL_DELTA_THRESHOLD;
  bool tempDelta = !firstReading && !isnan(temperature) && abs(temperature - lastSentTemp) >= TEMP_DELTA_THRESHOLD;
  bool humidDelta = !firstReading && !isnan(humidity) && abs(humidity - lastSentHumid) >= HUMID_DELTA_THRESHOLD;
  bool significantChange = soilDelta || tempDelta || humidDelta;

  if (significantChange) {
    String reason = "";
    if (soilDelta) reason += "soil " + String(lastSentSoil) + "%->" + String(soilPct) + "% ";
    if (tempDelta) reason += "temp " + String(lastSentTemp, 1) + "->" + String(temperature, 1) + "C ";
    if (humidDelta) reason += "humid " + String(lastSentHumid, 1) + "->" + String(humidity, 1) + "% ";
    Serial.printf(" ** DELTA: %s", reason.c_str());
  }

  Serial.println();

  if (timeToSend || firstReading || significantChange || forceReadNow) {
    if (forceReadNow) Serial.println("[SEND] Forced by read_now command");
    forceReadNow = false;
    // Build JSON
    String json = "{";
    json += "\"soil_moisture\":" + String(soilPct);
    if (!isnan(temperature)) json += ",\"temperature\":" + String(temperature, 1);
    if (!isnan(humidity))    json += ",\"humidity\":" + String(humidity, 1);
    if (lux >= 0)            json += ",\"light_lux\":" + String(lux, 0);

    // Include delta info in metadata so the server knows what triggered the send
    if (significantChange) {
      json += ",\"metadata\":{\"trigger\":\"delta\"";
      if (soilDelta) json += ",\"soil_delta\":" + String(soilPct - lastSentSoil);
      if (tempDelta) json += ",\"temp_delta\":" + String(temperature - lastSentTemp, 1);
      if (humidDelta) json += ",\"humid_delta\":" + String(humidity - lastSentHumid, 1);
      json += "}";
    }

    json += "}";

    // POST
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
      Serial.printf("[SENT] %s\n", response.c_str());
      lastSentSoil = soilPct;
      if (!isnan(temperature)) lastSentTemp = temperature;
      if (!isnan(humidity)) lastSentHumid = humidity;
      lastSendTime = now;
      handleCommands(response);
    } else {
      Serial.printf("[ERROR] HTTP %d: %s\n", httpCode, response.c_str());
    }

    http.end();
  }

  delay(LOCAL_READ_SEC * 1000);
}
