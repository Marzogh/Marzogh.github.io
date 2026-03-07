#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <stdarg.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "SparkFun_AS3935.h"

// AS3935 event bits
#define LIGHTNING_INT 0x08
#define DISTURBER_INT 0x04
#define NOISE_INT 0x01
#define INDOOR 0x12
#define OUTDOOR 0x0E

static constexpr const char* FW_REV = "M2_CORE_R3_2026-03-07";

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
  FAULT_OLED_INIT = 0x201
};

struct DebouncedInput {
  uint8_t pin;
  bool active_low;
  bool stable_active;
  bool last_raw_active;
  uint32_t raw_changed_ms;
};

SparkFun_AS3935 lightning;
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
char g_event_buf[EVENT_BUF_SIZE][EVENT_LINE_LEN];
uint8_t g_event_head = 0;   // next write slot
uint8_t g_event_count = 0;  // number of valid entries
uint8_t g_oled_roll_offset = 0;
uint32_t g_last_oled_roll_ms = 0;

bool g_latched_lightning = false;
FaultHex g_fault = FAULT_NONE;
bool g_oled_ok = false;

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
  Serial.println(F("=== Lightning Box M2 Core ==="));
  Serial.println(F("Board: XIAO ESP32-C6"));
  Serial.println(F("Mode: AS3935 SPI + IRQ + OLED + Debounce"));
  Serial.print(F("FW: "));
  Serial.println(FW_REV);
  Serial.println(F("Fault code format: hex (0x...)"));
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

void sensorConfigure(const SensorParams& p) {
  lightning.setIndoorOutdoor(p.afe_mode);
  lightning.tuneCap(SENSOR_TUNE_CAP_BITS * 8);
  lightning.setNoiseLevel(p.noise_floor);
  lightning.watchdogThreshold(p.watchdog);
  lightning.spikeRejection(p.spike);
  lightning.lightningThreshold(p.min_lightnings);
  lightning.maskDisturber(false);
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
  oled().println(F("Lightning M2"));
  oled().println(line1);
  if (line2 && line2[0]) oled().println(line2);
  oled().display();
}

void oledLive(uint32_t now_ms) {
  if (!g_oled_ok) return;
  if ((now_ms - g_last_oled_roll_ms) >= 1200) {
    g_last_oled_roll_ms = now_ms;
    if (g_event_count > 0) {
      g_oled_roll_offset = (g_oled_roll_offset + 1) % g_event_count;
    } else {
      g_oled_roll_offset = 0;
    }
  }

  oled().clearDisplay();
  oled().setTextSize(1);
  oled().setTextColor(SSD1306_WHITE);
  oled().setCursor(0, 0);
  oled().printf("P:%c A:%d M:%d\n", (g_sensor.name[0] == 'N') ? 'N' : 'S',
                g_in_arm.stable_active ? 1 : 0, g_in_mute.stable_active ? 1 : 0);
  oled().printf("L:%lu D:%lu N:%lu\n", g_count_lightning, g_count_disturber, g_count_noise);
  if (g_count_lightning > 0) {
    oled().printf("LTG:%lus %uk e%lu\n", (now_ms - g_last_lightning_ms) / 1000UL, g_last_distance,
                  g_last_energy);
  } else {
    oled().println(F("LTG:none"));
  }
  oled().printf("EV:%s", getRecentEvent(g_oled_roll_offset));
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
  }

  initDebounce(g_in_arm, millis());
  initDebounce(g_in_mute, millis());
  initDebounce(g_in_reset, millis());
  Serial.printf("startup arm=%d mute=%d reset=%d\n", g_in_arm.stable_active ? 1 : 0,
                g_in_mute.stable_active ? 1 : 0, g_in_reset.stable_active ? 1 : 0);
  startupBuzzerTest(g_in_mute.stable_active);

  SensorProfile profile = SENSOR_PROFILE_DEFAULT;
  if (ENABLE_PROFILE_SELECT_SWITCH && g_in_mute.stable_active) profile = PROFILE_NOISY;
  g_sensor = (profile == PROFILE_NOISY) ? PARAM_NOISY : PARAM_SENSITIVE;
  Serial.printf("profile=%s (switch_select=%d)\n", g_sensor.name,
                ENABLE_PROFILE_SELECT_SWITCH ? 1 : 0);
  if (ENABLE_PROFILE_SELECT_SWITCH) {
    Serial.println(F("profile_hint: set MUTE ON before boot to force NOISY"));
  }
  pushEventLine("BOOT %s", g_sensor.name);

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

  const int irq_num = digitalPinToInterrupt(PIN_AS3935_IRQ);
  if (irq_num == NOT_AN_INTERRUPT) {
    faultHalt(FAULT_AS3935_IRQ_ATTACH, "Invalid IRQ pin for attachInterrupt");
  }
  attachInterrupt(irq_num, onAs3935Irq, RISING);

  Serial.println(F("M2 init complete. Waiting for events..."));
  oledBoot("M2 init complete", "Waiting for events");
  pushEventLine("M2 READY");
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

  if ((now_ms - g_last_heartbeat_ms) >= 500) {
    g_last_heartbeat_ms = now_ms;
    if (g_in_arm.stable_active) {
      digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    } else {
      digitalWrite(PIN_STATUS_LED, LOW);
    }
  }

  if (g_in_arm.stable_active) {
    handleAs3935Event(now_ms);
  }

  updateBuzzer(now_ms);

  if ((now_ms - g_last_oled_ms) >= 180) {
    g_last_oled_ms = now_ms;
    oledLive(now_ms);
  }
}
