#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <stdarg.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <time.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "SparkFun_AS3935.h"

// AS3935 event bits
#define LIGHTNING_INT 0x08
#define DISTURBER_INT 0x04
#define NOISE_INT 0x01
#define INDOOR 0x12
#define OUTDOOR 0x0E

static constexpr const char* FW_REV = "M3_CONNECTED_R5_2026-03-08";

// Display config (0.91" modules are commonly 128x32)
static constexpr int OLED_W = 128;
static constexpr int OLED_H_32 = 32;
static constexpr int OLED_H_64 = 64;
static constexpr uint8_t OLED_ADDR_A = 0x3C;
static constexpr uint8_t OLED_ADDR_B = 0x3D;
static constexpr uint8_t PIN_OLED_SDA = D4;
static constexpr uint8_t PIN_OLED_SCL = D5;
Adafruit_SSD1306 display32(OLED_W, OLED_H_32, &Wire, -1);
Adafruit_SSD1306 display64(OLED_W, OLED_H_64, &Wire, -1);
Adafruit_SSD1306* g_display = nullptr;
uint8_t g_oled_addr = 0x00;
uint8_t g_oled_h = 0;

// MOD-1016 factory calibration number (register 0x08 bits [3:0]).
static constexpr uint8_t SENSOR_TUNE_CAP_BITS = 7;
static constexpr bool ENABLE_PROFILE_SELECT_SWITCH = true;  // MUTE ON at boot => NOISY

enum SensorProfile : uint8_t { PROFILE_SENSITIVE = 0, PROFILE_NOISY = 1 };
static constexpr SensorProfile SENSOR_PROFILE_DEFAULT = PROFILE_SENSITIVE;

struct SensorParams {
  uint8_t afe_mode;
  uint8_t noise_floor;
  uint8_t watchdog;
  uint8_t spike;
  uint8_t min_lightnings;
  const char* name;
};

const SensorParams PARAM_SENSITIVE = {INDOOR, 2, 1, 1, 1, "SENSITIVE"};
const SensorParams PARAM_NOISY = {OUTDOOR, 7, 6, 6, 1, "NOISY"};
SensorParams g_sensor = PARAM_SENSITIVE;

// Pin map (XIAO ESP32-C6)
static constexpr uint8_t PIN_ARM_SW = D0;      // INPUT_PULLUP, ON = GND
static constexpr uint8_t PIN_MUTE_SW = D1;     // INPUT_PULLUP, ON = GND
static constexpr uint8_t PIN_AS3935_IRQ = D2;  // interrupt
static constexpr uint8_t PIN_AS3935_CS = D3;   // SPI CS
static constexpr uint8_t PIN_BUZZER = D6;      // PN2222A base via 1k
static constexpr uint8_t PIN_RESET_BTN = D7;   // INPUT_PULLUP, pressed = GND
static constexpr uint8_t PIN_SPI_SCK = D8;
static constexpr uint8_t PIN_SPI_MISO = D9;
static constexpr uint8_t PIN_SPI_MOSI = D10;
static constexpr uint8_t PIN_STATUS_LED = LED_BUILTIN;

// Buzzer mode
static constexpr bool BUZZER_IS_PASSIVE = true;
static constexpr bool BUZZER_ACTIVE_HIGH = true;

enum FaultHex : uint16_t {
  FAULT_NONE = 0x000,
  FAULT_AS3935_INIT = 0x101,
  FAULT_AS3935_CONFIG = 0x102,
  FAULT_AS3935_IRQ_ATTACH = 0x103,
  FAULT_OLED_INIT = 0x201,
  FAULT_STORE_LOAD = 0x301,
  FAULT_STORE_SAVE = 0x302
};

struct DebouncedInput {
  uint8_t pin;
  bool active_low;
  bool stable_active;
  bool last_raw_active;
  uint32_t raw_changed_ms;
};

SparkFun_AS3935 lightning;
WebServer web(80);
Preferences prefs;
volatile bool g_irq_flag = false;
volatile uint32_t g_irq_seen_ms = 0;

DebouncedInput g_in_arm{PIN_ARM_SW, true, false, false, 0};
DebouncedInput g_in_mute{PIN_MUTE_SW, true, false, false, 0};
DebouncedInput g_in_reset{PIN_RESET_BTN, true, false, false, 0};

uint32_t g_last_heartbeat_ms = 0;
uint32_t g_last_oled_ms = 0;
uint32_t g_buzzer_off_ms = 0;
uint32_t g_last_event_ms = 0;
uint32_t g_boot_ms = 0;

uint32_t g_count_lightning = 0;
uint32_t g_count_noise = 0;
uint32_t g_count_disturber = 0;
uint8_t g_last_distance = 0;
uint32_t g_last_energy = 0;
char g_last_event_name[12] = "NONE";
uint32_t g_last_lightning_ms = 0;

static constexpr uint8_t EVENT_BUF_SIZE = 8;
static constexpr uint8_t EVENT_LINE_LEN = 24;
static constexpr uint32_t RESET_LONG_PRESS_MS = 1500;
static constexpr uint32_t BOOT_PROFILE_ASSIST_MS = 15000;
static constexpr uint32_t STARTUP_STABILIZE_MS = 10000;
static constexpr uint32_t PROFILE_SWITCH_QUIET_MS = 2500;
static constexpr uint8_t BOOT_TERM_BUF_SIZE = 10;
static constexpr uint8_t BOOT_TERM_LINE_LEN = 22;
static constexpr uint32_t BOOT_TERM_TYPE_MS = 22;
static constexpr uint8_t OLED_LINE_CHARS = 21;
static constexpr uint32_t STATUS_SCROLL_STEP_MS = 110;
static constexpr uint32_t LIGHTNING_ALERT_MS = 5000;
static constexpr uint32_t STORM_SPLASH_MS = 10000;
static constexpr bool OLED_SAFE_MODE = true;
char g_event_buf[EVENT_BUF_SIZE][EVENT_LINE_LEN];
uint8_t g_event_head = 0;   // next write slot
uint8_t g_event_count = 0;  // number of valid entries
uint8_t g_oled_roll_offset = 0;
uint32_t g_last_oled_roll_ms = 0;
uint32_t g_last_wifi_retry_ms = 0;
bool g_wifi_ok = false;
bool g_time_synced = false;
char g_wifi_ip[24] = "";

// --- M3 config ---
// Leave SSID empty to keep M3 in local-only mode.
// Set SSID/PASS before enabling connected mode on a target network.
static constexpr const char* WIFI_SSID = "";
static constexpr const char* WIFI_PASS = "";
static constexpr const char* NTP_SERVER_1 = "pool.ntp.org";
static constexpr const char* NTP_SERVER_2 = "time.nist.gov";
static constexpr long TZ_OFFSET_SEC = 0;
static constexpr int DST_OFFSET_SEC = 0;

// NVS strike history ring
static constexpr uint16_t STRIKE_MAX = 128;
struct StrikeRecord {
  uint32_t epoch_s;
  uint16_t distance_km;
  uint32_t energy;
};
StrikeRecord g_strikes[STRIKE_MAX];
uint16_t g_strike_head = 0;   // next write slot
uint16_t g_strike_count = 0;  // valid record count

bool g_latched_lightning = false;
FaultHex g_fault = FAULT_NONE;
bool g_oled_ok = false;
bool g_reset_press_active = false;
bool g_reset_long_handled = false;
uint32_t g_reset_press_start_ms = 0;
bool g_boot_profile_assist_done = false;
bool g_irq_attached = false;
bool g_event_logging_enabled = false;
uint32_t g_profile_quiet_until_ms = 0;
uint32_t g_lightning_alert_until_ms = 0;
uint32_t g_status_scroll_last_ms = 0;
uint8_t g_status_scroll_idx = 0;

char g_boot_term[BOOT_TERM_BUF_SIZE][BOOT_TERM_LINE_LEN];
uint8_t g_boot_term_head = 0;
uint8_t g_boot_term_count = 0;
uint8_t g_boot_term_reveal = 0;
uint32_t g_boot_term_last_ms = 0;
bool g_boot_term_anim = false;

Adafruit_SSD1306& oled() { return *g_display; }

bool i2cPing(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

void pushEventLine(const char* fmt, ...) {
  char line[EVENT_LINE_LEN];
  va_list args;
  va_start(args, fmt);
  vsnprintf(line, sizeof(line), fmt, args);
  va_end(args);

  strncpy(g_event_buf[g_event_head], line, EVENT_LINE_LEN - 1);
  g_event_buf[g_event_head][EVENT_LINE_LEN - 1] = '\0';
  g_event_head = (g_event_head + 1) % EVENT_BUF_SIZE;
  if (g_event_count < EVENT_BUF_SIZE) g_event_count++;
}

const char* getRecentEvent(uint8_t offset_from_newest) {
  if (g_event_count == 0) return "none";
  if (offset_from_newest >= g_event_count) offset_from_newest %= g_event_count;
  int idx = static_cast<int>(g_event_head) - 1 - static_cast<int>(offset_from_newest);
  while (idx < 0) idx += EVENT_BUF_SIZE;
  return g_event_buf[idx];
}

bool isSwitchEventLine(const char* s) {
  return (strncmp(s, "MUTE ", 5) == 0) || (strncmp(s, "ARM ", 4) == 0) ||
         (strncmp(s, "RESET ", 6) == 0);
}

const char* getRecentDisplayEvent(uint8_t offset_from_newest) {
  if (g_event_count == 0) return "none";
  uint8_t matched = 0;
  for (uint8_t i = 0; i < g_event_count; i++) {
    const char* s = getRecentEvent(i);
    if (!isSwitchEventLine(s)) {
      if (matched == offset_from_newest) return s;
      matched++;
    }
  }
  return getRecentEvent(0);
}

const char* profileText() { return (profileCode() == 1) ? "Noisy" : "Sensitive"; }
const char* armText() { return g_in_arm.stable_active ? "Armed" : "Disarmed"; }
const char* muteText() { return g_in_mute.stable_active ? "Mute" : "Loud"; }
const char* netText() { return g_wifi_ok ? "WiFi" : "Local"; }

void buildStatusLine(char* out, size_t out_len) {
  snprintf(out, out_len, "%s %s %s %s", profileText(), armText(), muteText(), netText());
}

void renderScrollingLine(uint8_t y, const char* text, bool scroll_tick) {
  const size_t n = strlen(text);
  if (n <= OLED_LINE_CHARS) {
    oled().setCursor(0, y);
    oled().print(text);
    g_status_scroll_idx = 0;
    return;
  }

  if (scroll_tick) {
    g_status_scroll_idx = (g_status_scroll_idx + 1) % static_cast<uint8_t>(n + 3);
  }

  char win[OLED_LINE_CHARS + 1];
  for (uint8_t i = 0; i < OLED_LINE_CHARS; i++) {
    const uint8_t src = (g_status_scroll_idx + i) % static_cast<uint8_t>(n + 3);
    win[i] = (src < n) ? text[src] : ' ';
  }
  win[OLED_LINE_CHARS] = '\0';
  oled().setCursor(0, y);
  oled().print(win);
}

void renderTruncatedLine(uint8_t y, const char* text) {
  char win[OLED_LINE_CHARS + 1];
  strncpy(win, text, OLED_LINE_CHARS);
  win[OLED_LINE_CHARS] = '\0';
  oled().setCursor(0, y);
  oled().print(win);
}

void bootTermAdd(const char* fmt, ...) {
  char line[BOOT_TERM_LINE_LEN];
  va_list args;
  va_start(args, fmt);
  vsnprintf(line, sizeof(line), fmt, args);
  va_end(args);

  strncpy(g_boot_term[g_boot_term_head], line, BOOT_TERM_LINE_LEN - 1);
  g_boot_term[g_boot_term_head][BOOT_TERM_LINE_LEN - 1] = '\0';
  g_boot_term_head = (g_boot_term_head + 1) % BOOT_TERM_BUF_SIZE;
  if (g_boot_term_count < BOOT_TERM_BUF_SIZE) g_boot_term_count++;

  g_boot_term_reveal = 0;
  g_boot_term_last_ms = millis();
  g_boot_term_anim = true;
}

const char* getBootTermRecent(uint8_t offset_from_newest) {
  if (g_boot_term_count == 0) return "";
  if (offset_from_newest >= g_boot_term_count) return "";
  int idx = static_cast<int>(g_boot_term_head) - 1 - static_cast<int>(offset_from_newest);
  while (idx < 0) idx += BOOT_TERM_BUF_SIZE;
  return g_boot_term[idx];
}

bool readActive(const DebouncedInput& in) {
  const bool level = digitalRead(in.pin);
  return in.active_low ? (level == LOW) : (level == HIGH);
}

void initDebounce(DebouncedInput& in, uint32_t now_ms) {
  in.last_raw_active = readActive(in);
  in.stable_active = in.last_raw_active;
  in.raw_changed_ms = now_ms;
}

bool updateDebounce(DebouncedInput& in, uint32_t now_ms, uint32_t debounce_ms) {
  const bool raw = readActive(in);
  if (raw != in.last_raw_active) {
    in.last_raw_active = raw;
    in.raw_changed_ms = now_ms;
  }
  if (in.stable_active != raw && (now_ms - in.raw_changed_ms) >= debounce_ms) {
    in.stable_active = raw;
    return true;
  }
  return false;
}

void buzzerOff() {
  if (BUZZER_IS_PASSIVE) {
    noTone(PIN_BUZZER);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
  }
}

void startBuzzer(uint32_t duration_ms, uint16_t freq_hz = 2400) {
  if (BUZZER_IS_PASSIVE) {
    tone(PIN_BUZZER, freq_hz);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
  }
  g_buzzer_off_ms = millis() + duration_ms;
}

void updateBuzzer(uint32_t now_ms) {
  if (g_buzzer_off_ms != 0 && (int32_t)(now_ms - g_buzzer_off_ms) >= 0) {
    buzzerOff();
    g_buzzer_off_ms = 0;
  }
}

void IRAM_ATTR onAs3935Irq() {
  g_irq_flag = true;
  g_irq_seen_ms = millis();
}

void faultHalt(FaultHex fault, const char* msg) {
  g_fault = fault;
  Serial.println();
  Serial.println(F("FATAL FAULT"));
  Serial.print(F("fault_hex=0x"));
  Serial.println(static_cast<uint16_t>(fault), HEX);
  Serial.println(msg);

  while (true) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(120);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(280);
  }
}

void printBanner() {
  Serial.println();
  Serial.println(F("=== Lightning Box M3 Connected ==="));
  Serial.println(F("Board: XIAO ESP32-C6"));
  Serial.println(F("Mode: AS3935 + OLED + WiFi/NTP + Flash Log + Web"));
  Serial.print(F("FW: "));
  Serial.println(FW_REV);
  Serial.println(F("Fault code format: hex (0x...)"));
}

void formatIsoTime(uint32_t epoch_s, char* out, size_t out_len) {
  if (epoch_s == 0) {
    snprintf(out, out_len, "unsynced");
    return;
  }
  time_t t = static_cast<time_t>(epoch_s);
  struct tm tmv;
  gmtime_r(&t, &tmv);
  strftime(out, out_len, "%Y-%m-%dT%H:%M:%SZ", &tmv);
}

void addStrikeRecord(uint32_t epoch_s, uint16_t distance_km, uint32_t energy) {
  g_strikes[g_strike_head] = {epoch_s, distance_km, energy};
  g_strike_head = (g_strike_head + 1) % STRIKE_MAX;
  if (g_strike_count < STRIKE_MAX) g_strike_count++;
}

bool saveStrikeStore() {
  if (!prefs.begin("m3log", false)) return false;
  bool ok = true;
  ok &= prefs.putUShort("head", g_strike_head) == sizeof(g_strike_head);
  ok &= prefs.putUShort("count", g_strike_count) == sizeof(g_strike_count);
  ok &= prefs.putBytes("records", g_strikes, sizeof(g_strikes)) == sizeof(g_strikes);
  prefs.end();
  return ok;
}

bool loadStrikeStore() {
  if (!prefs.begin("m3log", true)) return false;
  const uint16_t head = prefs.getUShort("head", 0);
  const uint16_t count = prefs.getUShort("count", 0);
  const size_t got = prefs.getBytes("records", g_strikes, sizeof(g_strikes));
  prefs.end();
  if (head >= STRIKE_MAX || count > STRIKE_MAX) return false;
  if (got != sizeof(g_strikes) && got != 0) return false;
  g_strike_head = head;
  g_strike_count = count;
  if (got == 0) {
    memset(g_strikes, 0, sizeof(g_strikes));
    g_strike_head = 0;
    g_strike_count = 0;
  }
  return true;
}

bool maybeSyncTime(uint32_t timeout_ms) {
  if (WiFi.status() != WL_CONNECTED) return false;
  configTime(TZ_OFFSET_SEC, DST_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
  bootTermAdd("NTP %s", NTP_SERVER_1);
  const uint32_t start = millis();
  while ((millis() - start) < timeout_ms) {
    time_t now = time(nullptr);
    if (now > 1700000000) {  // sanity threshold
      g_time_synced = true;
      char ts[32];
      formatIsoTime(static_cast<uint32_t>(now), ts, sizeof(ts));
      bootTermAdd("TIME OK %.20s", ts);
      return true;
    }
    delay(100);
  }
  bootTermAdd("TIME FAIL");
  return false;
}

void handleRoot() {
  String html;
  html.reserve(2200);
  html += F("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>");
  html += F("<title>Lightning Box M3</title><style>body{font-family:ui-monospace,monospace;background:#0f172a;color:#e2e8f0;padding:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #334155;padding:6px;text-align:left}a{color:#7dd3fc}</style></head><body>");
  html += F("<h2>Lightning Box M3</h2>");
  html += F("<p><a href='/api/status'>/api/status</a> | <a href='/api/strikes'>/api/strikes</a></p>");
  html += F("<table><tr><th>#</th><th>Time (UTC)</th><th>Dist (km)</th><th>Energy</th></tr>");

  for (uint16_t i = 0; i < g_strike_count; i++) {
    int idx = static_cast<int>(g_strike_head) - 1 - static_cast<int>(i);
    while (idx < 0) idx += STRIKE_MAX;
    char ts[32];
    formatIsoTime(g_strikes[idx].epoch_s, ts, sizeof(ts));
    html += "<tr><td>" + String(i + 1) + "</td><td>" + String(ts) + "</td><td>" +
            String(g_strikes[idx].distance_km) + "</td><td>" + String(g_strikes[idx].energy) + "</td></tr>";
  }
  html += F("</table></body></html>");
  web.send(200, "text/html", html);
}

void handleStatusApi() {
  char now_iso[32];
  time_t now_epoch = time(nullptr);
  formatIsoTime(now_epoch > 1700000000 ? static_cast<uint32_t>(now_epoch) : 0, now_iso, sizeof(now_iso));
  String json;
  json.reserve(512);
  json += "{";
  json += "\"fw\":\"" + String(FW_REV) + "\",";
  json += "\"profile\":\"" + String(g_sensor.name) + "\",";
  json += "\"wifi\":" + String(g_wifi_ok ? "true" : "false") + ",";
  json += "\"time_synced\":" + String(g_time_synced ? "true" : "false") + ",";
  json += "\"now_utc\":\"" + String(now_iso) + "\",";
  json += "\"counts\":{\"lightning\":" + String(g_count_lightning) + ",\"disturber\":" +
          String(g_count_disturber) + ",\"noise\":" + String(g_count_noise) + "},";
  json += "\"strike_log_count\":" + String(g_strike_count);
  json += "}";
  web.send(200, "application/json", json);
}

void handleStrikesApi() {
  String json;
  json.reserve(2400);
  json += "{\"count\":";
  json += String(g_strike_count);
  json += ",\"items\":[";
  for (uint16_t i = 0; i < g_strike_count; i++) {
    int idx = static_cast<int>(g_strike_head) - 1 - static_cast<int>(i);
    while (idx < 0) idx += STRIKE_MAX;
    char ts[32];
    formatIsoTime(g_strikes[idx].epoch_s, ts, sizeof(ts));
    if (i) json += ",";
    json += "{\"n\":";
    json += String(i + 1);
    json += ",\"epoch\":";
    json += String(g_strikes[idx].epoch_s);
    json += ",\"utc\":\"";
    json += String(ts);
    json += "\",\"distance_km\":";
    json += String(g_strikes[idx].distance_km);
    json += ",\"energy\":";
    json += String(g_strikes[idx].energy);
    json += "}";
  }
  json += "]}";
  web.send(200, "application/json", json);
}

void setupWebServer() {
  web.on("/", HTTP_GET, handleRoot);
  web.on("/api/status", HTTP_GET, handleStatusApi);
  web.on("/api/strikes", HTTP_GET, handleStrikesApi);
  web.begin();
}

void setupWiFiAndTime() {
  if (strlen(WIFI_SSID) == 0) {
    Serial.println(F("wifi=SKIPPED (WIFI_SSID empty)"));
    bootTermAdd("WIFI OFFLINE");
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print(F("wifi=CONNECTING ssid="));
  Serial.println(WIFI_SSID);
  bootTermAdd("WIFI %s", WIFI_SSID);
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 12000) {
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    g_wifi_ok = true;
    strncpy(g_wifi_ip, WiFi.localIP().toString().c_str(), sizeof(g_wifi_ip) - 1);
    g_wifi_ip[sizeof(g_wifi_ip) - 1] = '\0';
    Serial.print(F("wifi=OK ip="));
    Serial.println(WiFi.localIP());
    bootTermAdd("IP %s", WiFi.localIP().toString().c_str());
    if (maybeSyncTime(6000)) {
      Serial.println(F("time_sync=OK"));
    } else {
      Serial.println(F("time_sync=FAIL"));
    }
  } else {
    Serial.println(F("wifi=FAIL"));
    bootTermAdd("WIFI FAIL");
  }
}

void updateWiFiAndTimeRetry(uint32_t now_ms) {
  if (strlen(WIFI_SSID) == 0) return;
  if (g_wifi_ok && g_time_synced) return;
  if ((now_ms - g_last_wifi_retry_ms) < 15000) return;
  g_last_wifi_retry_ms = now_ms;

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    Serial.println(F("wifi=RETRY"));
    bootTermAdd("WIFI RETRY");
    return;
  }
  g_wifi_ok = true;
  strncpy(g_wifi_ip, WiFi.localIP().toString().c_str(), sizeof(g_wifi_ip) - 1);
  g_wifi_ip[sizeof(g_wifi_ip) - 1] = '\0';
  if (!g_time_synced && maybeSyncTime(2000)) {
    Serial.println(F("time_sync=OK (retry)"));
  }
}

void startupBuzzerTest(bool muted_at_boot) {
  if (muted_at_boot) {
    Serial.println(F("buzzer_test=SKIPPED (mute ON at boot)"));
    return;
  }
  Serial.println(F("buzzer_test=START"));
  const uint16_t freq_hz[] = {1568, 1976, 2637, 3136};
  for (size_t i = 0; i < 4; i++) {
    tone(PIN_BUZZER, freq_hz[i], 120);
    delay(150);
  }
  noTone(PIN_BUZZER);
  Serial.println(F("buzzer_test=PASS"));
}

void playStormBootSplash(bool muted_at_boot) {
  if (!g_oled_ok) return;
  if (OLED_SAFE_MODE) {
    oled().clearDisplay();
    oled().setTextSize(1);
    oled().setTextColor(SSD1306_WHITE);
    oled().setCursor(0, 0);
    oled().println(F("Lightning Box M3"));
    oled().println(F("Boot sequence..."));
    oled().println(F("Storm audio only"));
    oled().display();
  }
  Serial.println(F("boot_splash=START"));

  struct NoteStep {
    uint16_t f;
    uint16_t d;
  };
  static const NoteStep seq[] = {
      {659, 140}, {784, 140}, {988, 180}, {784, 120}, {659, 120}, {0, 60},
      {659, 140}, {784, 140}, {1047, 200}, {784, 120}, {659, 120}, {0, 80},
      {523, 180}, {659, 180}, {784, 220}, {659, 140}, {523, 140}, {0, 120},
  };
  const uint32_t start = millis();
  uint32_t next_note_ms = start;
  uint16_t note_idx = 0;
  uint16_t frame = 0;

  while ((millis() - start) < STORM_SPLASH_MS) {
    const uint32_t now = millis();
    if (!muted_at_boot && now >= next_note_ms) {
      const NoteStep& n = seq[note_idx];
      if (n.f > 0) tone(PIN_BUZZER, n.f, n.d);
      else noTone(PIN_BUZZER);
      next_note_ms = now + n.d + 20;
      note_idx = (note_idx + 1) % (sizeof(seq) / sizeof(seq[0]));
    }

    if (!OLED_SAFE_MODE) {
      oled().clearDisplay();
      oled().setTextSize(1);
      oled().setTextColor(SSD1306_WHITE);
      oled().setCursor(20, 0);
      oled().print(F("LIGHTNING BOX"));
      oled().setCursor(28, 10);
      oled().print(F("Storm Boot..."));
      oled().fillCircle(20, 24, 5, SSD1306_WHITE);
      oled().fillCircle(30, 22, 6, SSD1306_WHITE);
      oled().fillCircle(40, 24, 5, SSD1306_WHITE);
      oled().fillRect(16, 24, 28, 5, SSD1306_WHITE);
      for (uint8_t i = 0; i < 8; i++) {
        uint8_t x = static_cast<uint8_t>(50 + i * 8);
        uint8_t y = static_cast<uint8_t>(18 + ((frame + i * 3) % 10));
        oled().drawPixel(x, y, SSD1306_WHITE);
        oled().drawPixel(x, y + 1, SSD1306_WHITE);
      }
      if (((frame / 2) % 2) == 0) {
        static const uint8_t bolt_bmp[] = {
            0b00011000, 0b00111000, 0b00110000, 0b01111100,
            0b00011100, 0b00011000, 0b00110000, 0b01100000};
        oled().drawBitmap(102, 18, bolt_bmp, 8, 8, SSD1306_WHITE);
      }
      oled().display();
    }
    frame++;
    delay(90);
  }
  noTone(PIN_BUZZER);
  Serial.println(F("boot_splash=END"));
}

void sensorConfigure(const SensorParams& p) {
  lightning.setIndoorOutdoor(p.afe_mode);
  lightning.tuneCap(SENSOR_TUNE_CAP_BITS * 8);
  lightning.setNoiseLevel(p.noise_floor);
  lightning.watchdogThreshold(p.watchdog);
  lightning.spikeRejection(p.spike);
  lightning.lightningThreshold(p.min_lightnings);
  lightning.maskDisturber(false);
}

uint8_t profileCode() { return (g_sensor.name[0] == 'N') ? 1 : 0; }

void applyProfileRuntime(SensorProfile profile, bool runtime_switch) {
  g_sensor = (profile == PROFILE_NOISY) ? PARAM_NOISY : PARAM_SENSITIVE;
  sensorConfigure(g_sensor);
  // Clear pending IRQ state and hold event processing briefly to avoid transients
  // during/after profile register writes.
  (void)lightning.readInterruptReg();
  g_irq_flag = false;
  g_profile_quiet_until_ms = millis() + PROFILE_SWITCH_QUIET_MS;
  Serial.printf("[%lu] profile=%s (runtime_switch=%d)\n", millis(), g_sensor.name, runtime_switch ? 1 : 0);
  pushEventLine("PROFILE %s", g_sensor.name[0] == 'N' ? "NOISY" : "SENS");
}

void maybeApplyBootProfileAssist(uint32_t now_ms) {
  if (g_boot_profile_assist_done) return;
  if ((now_ms - g_boot_ms) > BOOT_PROFILE_ASSIST_MS) {
    g_boot_profile_assist_done = true;
    return;
  }

  // If MUTE becomes active shortly after boot, honor NOISY profile intent.
  if (g_in_mute.stable_active && profileCode() == 0) {
    applyProfileRuntime(PROFILE_NOISY, true);
    Serial.printf("[%lu] action=BOOT_PROFILE_ASSIST mute=ON window_ms=%lu\n", now_ms,
                  static_cast<unsigned long>(BOOT_PROFILE_ASSIST_MS));
    g_boot_profile_assist_done = true;
  }
}

void maybeEnableAs3935Events(uint32_t now_ms) {
  if (g_event_logging_enabled) return;
  if ((now_ms - g_boot_ms) < STARTUP_STABILIZE_MS) return;

  if (!g_irq_attached) {
    const int irq_num = digitalPinToInterrupt(PIN_AS3935_IRQ);
    if (irq_num == NOT_AN_INTERRUPT) {
      faultHalt(FAULT_AS3935_IRQ_ATTACH, "Invalid IRQ pin for attachInterrupt");
    }
    attachInterrupt(irq_num, onAs3935Irq, RISING);
    g_irq_attached = true;
  }

  // Clear any stale pending IRQ status before opening event logging.
  (void)lightning.readInterruptReg();
  g_irq_flag = false;
  g_event_logging_enabled = true;
  Serial.printf("[%lu] startup_guard=END events_enabled=1 stabilize_ms=%lu\n", now_ms,
                static_cast<unsigned long>(STARTUP_STABILIZE_MS));
  pushEventLine("EVENTS ENABLED");
  bootTermAdd("EVENTS ENABLED");
}

void i2cScan() {
  uint8_t found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    if (i2cPing(addr)) {
      Serial.printf("i2c_found=0x%02X\n", addr);
      found++;
    }
  }
  if (!found) {
    Serial.println(F("i2c_found=NONE"));
  }
}

bool tryOledInit(Adafruit_SSD1306& panel, uint8_t addr, uint8_t height) {
  if (!panel.begin(SSD1306_SWITCHCAPVCC, addr)) return false;
  if (!i2cPing(addr)) return false;
  g_display = &panel;
  g_oled_addr = addr;
  g_oled_h = height;
  return true;
}

void oledPanelFlash() {
  if (!g_oled_ok) return;
  oled().clearDisplay();
  oled().fillRect(0, 0, OLED_W, g_oled_h, SSD1306_WHITE);
  oled().display();
  delay(120);
  oled().clearDisplay();
  oled().display();
}

void oledBoot(const char* line1, const char* line2) {
  if (!g_oled_ok) return;
  oled().clearDisplay();
  oled().setTextSize(1);
  oled().setTextColor(SSD1306_WHITE);
  oled().setCursor(0, 0);
  oled().println(F("Lightning M3"));
  oled().println(line1);
  if (line2 && line2[0]) oled().println(line2);
  oled().display();
}

void oledLive(uint32_t now_ms) {
  if (!g_oled_ok) return;
  if (OLED_SAFE_MODE) {
    oled().clearDisplay();
    oled().setTextSize(1);
    oled().setTextColor(SSD1306_WHITE);
    char status_line[48];
    buildStatusLine(status_line, sizeof(status_line));
    oled().setCursor(0, 0);
    oled().print(status_line);
    oled().setCursor(0, 8);
    oled().printf("L:%lu D:%lu N:%lu", g_count_lightning, g_count_disturber, g_count_noise);
    oled().setCursor(0, 16);
    if (g_count_lightning > 0) {
      oled().printf("LTG:%lus %uk", (now_ms - g_last_lightning_ms) / 1000UL, g_last_distance);
    } else {
      oled().print(F("LTG:none"));
    }
    oled().setCursor(0, 24);
    oled().print(getRecentDisplayEvent(g_oled_roll_offset));
    oled().display();
    return;
  }
  if ((int32_t)(now_ms - g_lightning_alert_until_ms) < 0) {
    static const uint8_t bolt_bmp[] = {
        0b00011000, 0b00111000, 0b00110000, 0b01111100,
        0b00011100, 0b00011000, 0b00110000, 0b01100000};
    const bool on = ((now_ms / 250UL) % 2UL) == 0UL;
    oled().clearDisplay();
    if (on) {
      oled().drawBitmap(4, 10, bolt_bmp, 8, 8, SSD1306_WHITE);
      oled().drawBitmap(116, 10, bolt_bmp, 8, 8, SSD1306_WHITE);
      oled().setTextSize(1);
      oled().setTextColor(SSD1306_WHITE);
      oled().setCursor(22, 12);
      oled().print(F("LIGHTNING!!"));
    }
    oled().display();
    return;
  }
  if ((now_ms - g_last_oled_roll_ms) >= 1200) {
    g_last_oled_roll_ms = now_ms;
    if (g_event_count > 0) {
      g_oled_roll_offset = (g_oled_roll_offset + 1) % g_event_count;
    } else {
      g_oled_roll_offset = 0;
    }
  }
  bool scroll_tick = false;
  if ((now_ms - g_status_scroll_last_ms) >= STATUS_SCROLL_STEP_MS) {
    g_status_scroll_last_ms = now_ms;
    scroll_tick = true;
  }

  oled().clearDisplay();
  oled().setTextSize(1);
  oled().setTextColor(SSD1306_WHITE);
  char status_line[48];
  buildStatusLine(status_line, sizeof(status_line));
  renderScrollingLine(0, status_line, scroll_tick);

  char line2[40];
  snprintf(line2, sizeof(line2), "L:%lu D:%lu N:%lu", g_count_lightning, g_count_disturber, g_count_noise);
  renderTruncatedLine(8, line2);

  char line3[48];
  if (g_count_lightning > 0) {
    snprintf(line3, sizeof(line3), "LTG:%lus %uk e%lu", (now_ms - g_last_lightning_ms) / 1000UL,
             g_last_distance, g_last_energy);
  } else {
    snprintf(line3, sizeof(line3), "LTG:none");
  }
  renderTruncatedLine(16, line3);

  char line4[48];
  snprintf(line4, sizeof(line4), "EV:%s", getRecentDisplayEvent(g_oled_roll_offset));
  renderTruncatedLine(24, line4);
  oled().display();
}

void oledBootDiag(uint32_t now_ms) {
  if (!g_oled_ok) return;
  if (OLED_SAFE_MODE) {
    const uint32_t elapsed = now_ms - g_boot_ms;
    const uint32_t remain = (elapsed >= STARTUP_STABILIZE_MS) ? 0 : (STARTUP_STABILIZE_MS - elapsed);
    oled().clearDisplay();
    oled().setTextSize(1);
    oled().setTextColor(SSD1306_WHITE);
    oled().setCursor(0, 0);
    oled().printf("G:%lus P:%d", remain / 1000UL, profileCode());
    oled().setCursor(0, 8);
    if (g_wifi_ok && g_wifi_ip[0] != '\0') oled().print(g_wifi_ip);
    else oled().print(F("WiFi pending"));
    oled().setCursor(0, 16);
    oled().printf("T:%d Log:%u", g_time_synced ? 1 : 0, g_strike_count);
    oled().setCursor(0, 24);
    oled().print(F("Boot guard active"));
    oled().display();
    return;
  }
  const uint32_t elapsed = now_ms - g_boot_ms;
  const uint32_t remain = (elapsed >= STARTUP_STABILIZE_MS) ? 0 : (STARTUP_STABILIZE_MS - elapsed);
  if (g_boot_term_anim && (now_ms - g_boot_term_last_ms) >= BOOT_TERM_TYPE_MS) {
    g_boot_term_last_ms = now_ms;
    const char* newest = getBootTermRecent(0);
    const uint8_t newest_len = static_cast<uint8_t>(strlen(newest));
    if (g_boot_term_reveal < newest_len) {
      g_boot_term_reveal++;
    } else {
      g_boot_term_anim = false;
    }
  }

  char l1[BOOT_TERM_LINE_LEN];
  char l2[BOOT_TERM_LINE_LEN];
  char l3[BOOT_TERM_LINE_LEN];
  strncpy(l1, getBootTermRecent(2), sizeof(l1) - 1);
  l1[sizeof(l1) - 1] = '\0';
  strncpy(l2, getBootTermRecent(1), sizeof(l2) - 1);
  l2[sizeof(l2) - 1] = '\0';
  strncpy(l3, getBootTermRecent(0), sizeof(l3) - 1);
  l3[sizeof(l3) - 1] = '\0';
  if (g_boot_term_anim) {
    const uint8_t n = (g_boot_term_reveal < strlen(l3)) ? g_boot_term_reveal : strlen(l3);
    l3[n] = '\0';
  }

  oled().clearDisplay();
  oled().setTextSize(1);
  oled().setTextColor(SSD1306_WHITE);
  oled().setCursor(0, 0);
  oled().printf("G:%lus P:%d\n", remain / 1000UL, profileCode());
  if (g_wifi_ok && g_wifi_ip[0] != '\0') {
    oled().println(g_wifi_ip);
  } else {
    oled().println(l1);
  }
  oled().println(l2);
  oled().print(l3);
  if (g_boot_term_anim && ((now_ms / 250UL) % 2UL == 0UL)) oled().print("_");
  oled().display();
}

void handleAs3935Event(uint32_t now_ms) {
  if (!g_irq_flag || (uint32_t)(now_ms - g_irq_seen_ms) < 2) return;
  g_irq_flag = false;

  const int intVal = lightning.readInterruptReg();
  g_last_event_ms = now_ms;

  if (intVal == NOISE_INT) {
    g_count_noise++;
    strncpy(g_last_event_name, "NOISE", sizeof(g_last_event_name) - 1);
    Serial.printf("[%lu] event=NOISE count=%lu\r\n", now_ms, g_count_noise);
    pushEventLine("NOISE #%lu", g_count_noise);
  } else if (intVal == DISTURBER_INT) {
    g_count_disturber++;
    strncpy(g_last_event_name, "DISTURBER", sizeof(g_last_event_name) - 1);
    Serial.printf("[%lu] event=DISTURBER count=%lu\r\n", now_ms, g_count_disturber);
    pushEventLine("DIST #%lu", g_count_disturber);
  } else if (intVal == LIGHTNING_INT) {
    g_count_lightning++;
    g_latched_lightning = true;
    g_last_distance = lightning.distanceToStorm();
    g_last_energy = lightning.lightningEnergy();
    g_last_lightning_ms = now_ms;
    g_lightning_alert_until_ms = now_ms + LIGHTNING_ALERT_MS;
    const time_t now_epoch = time(nullptr);
    const uint32_t ts_epoch = (now_epoch > 1700000000) ? static_cast<uint32_t>(now_epoch) : 0;
    addStrikeRecord(ts_epoch, g_last_distance, g_last_energy);
    if (!saveStrikeStore()) {
      Serial.println(F("warn: strike_store_save_failed"));
    }
    strncpy(g_last_event_name, "LIGHTNING", sizeof(g_last_event_name) - 1);
    Serial.printf("[%lu] event=LIGHTNING count=%lu distance_km=%u energy=%lu arm=%d mute=%d\r\n",
                  now_ms, g_count_lightning, g_last_distance, g_last_energy,
                  g_in_arm.stable_active ? 1 : 0, g_in_mute.stable_active ? 1 : 0);
    pushEventLine("LTG #%lu %uk", g_count_lightning, g_last_distance);
    if (!g_in_mute.stable_active) startBuzzer(130, 2400);
  } else {
    strncpy(g_last_event_name, "OTHER", sizeof(g_last_event_name) - 1);
    Serial.printf("[%lu] event=OTHER int=0x%02X\r\n", now_ms, intVal);
    pushEventLine("OTHER 0x%02X", intVal);
  }
}

void setup() {
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  buzzerOff();

  pinMode(PIN_ARM_SW, INPUT_PULLUP);
  pinMode(PIN_MUTE_SW, INPUT_PULLUP);
  pinMode(PIN_RESET_BTN, INPUT_PULLUP);
  pinMode(PIN_AS3935_IRQ, INPUT);

  Serial.begin(115200);
  const uint32_t serial_wait_start = millis();
  while (!Serial && (millis() - serial_wait_start) < 2500) {
    delay(10);
  }
  delay(120);
  g_boot_ms = millis();
  printBanner();
  //Serial.flush();
  bootTermAdd("FW %s", FW_REV);

  if (!loadStrikeStore()) {
    Serial.println(F("warn: strike_store_load_failed"));
    memset(g_strikes, 0, sizeof(g_strikes));
    g_strike_head = 0;
    g_strike_count = 0;
    bootTermAdd("LOG LOAD FAIL");
  } else {
    Serial.printf("strike_store_loaded count=%u\n", g_strike_count);
    bootTermAdd("LOG %u", g_strike_count);
  }

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  Wire.setClock(100000);
  delay(30);
  Serial.printf("oled_i2c_pins sda=D4 scl=D5 (gpio=%u,%u)\n", PIN_OLED_SDA, PIN_OLED_SCL);
  i2cScan();
  const bool have_3c = i2cPing(OLED_ADDR_A);
  const bool have_3d = i2cPing(OLED_ADDR_B);
  if (!have_3c && !have_3d) {
    Serial.println(F("warn: no OLED address responded on I2C (0x3C/0x3D)"));
    g_oled_ok = false;
  } else {
    g_oled_ok = tryOledInit(display32, OLED_ADDR_A, OLED_H_32) ||
                tryOledInit(display32, OLED_ADDR_B, OLED_H_32) ||
                tryOledInit(display64, OLED_ADDR_A, OLED_H_64) ||
                tryOledInit(display64, OLED_ADDR_B, OLED_H_64);
  }
  if (!g_oled_ok) {
    Serial.println(F("warn: OLED init failed (tried 0x3C/0x3D, 128x32/128x64), continuing headless"));
  } else {
    Serial.printf("oled=ok addr=0x%02X size=128x%u\n", g_oled_addr, g_oled_h);
    oledPanelFlash();
    oledBoot("OLED init OK", "");
    bootTermAdd("OLED 0x%02X", g_oled_addr);
  }

  initDebounce(g_in_arm, millis());
  initDebounce(g_in_mute, millis());
  initDebounce(g_in_reset, millis());
  Serial.printf("startup arm=%d mute=%d reset=%d\n", g_in_arm.stable_active ? 1 : 0,
                g_in_mute.stable_active ? 1 : 0, g_in_reset.stable_active ? 1 : 0);
  startupBuzzerTest(g_in_mute.stable_active);
  playStormBootSplash(g_in_mute.stable_active);

  SensorProfile profile = SENSOR_PROFILE_DEFAULT;
  if (ENABLE_PROFILE_SELECT_SWITCH && g_in_mute.stable_active) profile = PROFILE_NOISY;
  g_sensor = (profile == PROFILE_NOISY) ? PARAM_NOISY : PARAM_SENSITIVE;
  Serial.printf("profile=%s (switch_select=%d)\n", g_sensor.name,
                ENABLE_PROFILE_SELECT_SWITCH ? 1 : 0);
  if (ENABLE_PROFILE_SELECT_SWITCH) {
    Serial.println(F("profile_hint: set MUTE ON before boot to force NOISY"));
  }
  pushEventLine("BOOT %s", g_sensor.name);
  bootTermAdd("PROFILE %s", g_sensor.name);
  setupWiFiAndTime();
  setupWebServer();
  if (g_wifi_ok) {
    Serial.println(F("web=READY port=80"));
    bootTermAdd("%s", WiFi.localIP().toString().c_str());
    pushEventLine("WEB %s", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("web=READY (local/offline)"));
    bootTermAdd("WEB LOCAL");
  }

  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_AS3935_CS);
  if (!lightning.beginSPI(PIN_AS3935_CS, 2000000)) {
    faultHalt(FAULT_AS3935_INIT, "AS3935 beginSPI failed");
  }
  sensorConfigure(g_sensor);
  if (!lightning.calibrateOsc()) {
    faultHalt(FAULT_AS3935_CONFIG, "AS3935 calibrateOsc failed");
  }

  Serial.printf(
      "AS3935 cfg: profile=%s afe=%s tuneCap_bits=%u tuneCap_pf=%u noise=%u watchdog=%u spike=%u minLight=%u\n",
      g_sensor.name, (g_sensor.afe_mode == INDOOR) ? "INDOOR" : "OUTDOOR",
      SENSOR_TUNE_CAP_BITS, lightning.readTuneCap(), g_sensor.noise_floor,
      g_sensor.watchdog, g_sensor.spike, g_sensor.min_lightnings);

  Serial.printf("startup_guard=ACTIVE stabilize_ms=%lu\n", static_cast<unsigned long>(STARTUP_STABILIZE_MS));
  bootTermAdd("GUARD %lus", STARTUP_STABILIZE_MS / 1000UL);
  Serial.println(F("M3 init complete. Waiting for startup guard..."));
  oledBoot("M3 init complete", "Startup guard...");
  pushEventLine("M3 READY");
  g_boot_profile_assist_done = false;
  // Start guard timing after splash sequence so full guard window is preserved.
  g_boot_ms = millis();
  delay(400);
}

void loop() {
  const uint32_t now_ms = millis();
  const uint32_t debounce_ms = 25;

  if (updateDebounce(g_in_arm, now_ms, debounce_ms)) {
    Serial.printf("[%lu] switch=ARM state=%s\n", now_ms, g_in_arm.stable_active ? "ON" : "OFF");
    pushEventLine("ARM %s", g_in_arm.stable_active ? "ON" : "OFF");
  }
  if (updateDebounce(g_in_mute, now_ms, debounce_ms)) {
    Serial.printf("[%lu] switch=MUTE state=%s\n", now_ms, g_in_mute.stable_active ? "ON" : "OFF");
    pushEventLine("MUTE %s", g_in_mute.stable_active ? "ON" : "OFF");
  }
  if (updateDebounce(g_in_reset, now_ms, debounce_ms)) {
    Serial.printf("[%lu] switch=RESET state=%s\n", now_ms,
                  g_in_reset.stable_active ? "DOWN" : "UP");
    pushEventLine("RESET %s", g_in_reset.stable_active ? "DN" : "UP");
    if (g_in_reset.stable_active) {
      g_reset_press_active = true;
      g_reset_long_handled = false;
      g_reset_press_start_ms = now_ms;
    } else if (g_reset_press_active) {
      g_reset_press_active = false;
      if (!g_reset_long_handled) {
        g_latched_lightning = false;
        g_count_lightning = 0;
        g_count_noise = 0;
        g_count_disturber = 0;
        strncpy(g_last_event_name, "RESET", sizeof(g_last_event_name) - 1);
        g_last_lightning_ms = 0;
        Serial.printf("[%lu] action=RESET_ACK counters_cleared\r\n", now_ms);
        pushEventLine("COUNTERS CLR");
        if (!g_in_mute.stable_active) startBuzzer(180, 2200);
      }
    }
  }

  if (g_reset_press_active && g_in_reset.stable_active && !g_reset_long_handled &&
      (now_ms - g_reset_press_start_ms) >= RESET_LONG_PRESS_MS) {
    g_reset_long_handled = true;
    const SensorProfile new_profile = (profileCode() == 1) ? PROFILE_SENSITIVE : PROFILE_NOISY;
    applyProfileRuntime(new_profile, true);
    Serial.printf("[%lu] action=PROFILE_TOGGLE via_reset_long_press_ms=%lu\n", now_ms,
                  static_cast<unsigned long>(RESET_LONG_PRESS_MS));
    if (!g_in_mute.stable_active) {
      startBuzzer(130, (profileCode() == 1) ? 2800 : 1800);
    }
  }

  if ((now_ms - g_last_heartbeat_ms) >= 500) {
    g_last_heartbeat_ms = now_ms;
    if (g_in_arm.stable_active) {
      digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    } else {
      digitalWrite(PIN_STATUS_LED, LOW);
    }
  }

  maybeEnableAs3935Events(now_ms);

  const bool event_path_allowed = g_event_logging_enabled && g_in_arm.stable_active &&
                                  !g_in_reset.stable_active &&
                                  (int32_t)(now_ms - g_profile_quiet_until_ms) >= 0;
  if (event_path_allowed) {
    handleAs3935Event(now_ms);
  }

  web.handleClient();
  updateWiFiAndTimeRetry(now_ms);
  maybeApplyBootProfileAssist(now_ms);
  updateBuzzer(now_ms);

  if ((now_ms - g_last_oled_ms) >= 180) {
    g_last_oled_ms = now_ms;
    if (g_event_logging_enabled) {
      oledLive(now_ms);
    } else {
      oledBootDiag(now_ms);
    }
  }
}
