#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include "SparkFun_AS3935.h"

// AS3935 event bits
#define LIGHTNING_INT 0x08
#define DISTURBER_INT 0x04
#define NOISE_INT 0x01
#define INDOOR 0x12
#define OUTDOOR 0x0E
// MOD-1016 documentation provides a factory calibration number as TUNE_CAP bits
// (Register 0x08 bits [3:0]), typically noted on the anti-static package.
// Valid range: 0..15, where pF value = bits * 8.
static constexpr uint8_t SENSOR_TUNE_CAP_BITS = 7;  // manufacturer-provided value

// Optional boot-time profile select:
// false = always use default profile below
// true  = if MUTE switch is ON at boot, use noisy-bench profile
static constexpr bool ENABLE_PROFILE_SELECT_SWITCH = true;

enum SensorProfile : uint8_t {
  PROFILE_SENSITIVE = 0,  // preferred for detecting weak nearby bench triggers
  PROFILE_NOISY = 1       // preferred when ambient EMI is flooding NOISE IRQ
};

// Default deployment profile (no switch required).
static constexpr SensorProfile SENSOR_PROFILE_DEFAULT = PROFILE_SENSITIVE;

struct SensorParams {
  uint8_t afe_mode;
  uint8_t noise_floor;
  uint8_t watchdog;
  uint8_t spike;
  uint8_t min_lightnings;
  const char* name;
};

const SensorParams PARAM_SENSITIVE = {
    INDOOR,  // higher gain
    2,       // lower threshold
    1,       // higher sensitivity
    1,       // higher sensitivity
    1,       // fastest trigger
    "SENSITIVE"};

const SensorParams PARAM_NOISY = {
    OUTDOOR,  // lower gain
    7,        // tolerate ambient noise
    6,        // stricter
    6,        // stricter
    1,        // keep single-event trigger for now
    "NOISY"};

SensorParams g_sensor = PARAM_SENSITIVE;

// Pin map (XIAO ESP32-C6 lean SPI build)
static constexpr uint8_t PIN_ARM_SW = D0;      // INPUT_PULLUP, ON = GND
static constexpr uint8_t PIN_MUTE_SW = D1;     // INPUT_PULLUP, ON = GND
static constexpr uint8_t PIN_AS3935_IRQ = D2;  // external interrupt pin
static constexpr uint8_t PIN_AS3935_CS = D3;   // SPI CS
static constexpr uint8_t PIN_BUZZER = D6;      // PN2222A base via resistor
static constexpr uint8_t PIN_RESET_BTN = D7;   // INPUT_PULLUP, pressed = GND
static constexpr uint8_t PIN_SPI_SCK = D8;     // SPI SCK
static constexpr uint8_t PIN_SPI_MISO = D9;    // SPI MISO
static constexpr uint8_t PIN_SPI_MOSI = D10;   // SPI MOSI
static constexpr uint8_t PIN_STATUS_LED = LED_BUILTIN;  // onboard LED
static constexpr bool BUZZER_ACTIVE_HIGH = true;
static constexpr bool BUZZER_IS_PASSIVE = true;

enum FaultHex : uint16_t {
  FAULT_NONE = 0x000,
  FAULT_AS3935_INIT = 0x101,
  FAULT_AS3935_CONFIG = 0x102,
  FAULT_AS3935_IRQ_ATTACH = 0x103
};

SparkFun_AS3935 lightning;

volatile bool g_irq_flag = false;
volatile uint32_t g_irq_seen_ms = 0;

uint32_t g_last_heartbeat_ms = 0;
uint32_t g_buzzer_off_ms = 0;
uint32_t g_last_event_ms = 0;

uint32_t g_count_lightning = 0;
uint32_t g_count_noise = 0;
uint32_t g_count_disturber = 0;

bool g_latched_lightning = false;
FaultHex g_fault = FAULT_NONE;
bool g_prev_arm = false;
bool g_prev_mute = false;
bool g_prev_reset_pressed = false;

static inline bool armEnabled() {
  return digitalRead(PIN_ARM_SW) == LOW;
}

static inline bool muteEnabled() {
  return digitalRead(PIN_MUTE_SW) == LOW;
}

void startBuzzer(uint32_t duration_ms) {
  if (BUZZER_IS_PASSIVE) {
    tone(PIN_BUZZER, 2400);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
  }
  g_buzzer_off_ms = millis() + duration_ms;
}

void updateBuzzer(uint32_t now_ms) {
  if (g_buzzer_off_ms != 0 && (int32_t)(now_ms - g_buzzer_off_ms) >= 0) {
    if (BUZZER_IS_PASSIVE) {
      noTone(PIN_BUZZER);
    } else {
      digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
    }
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
  Serial.println(F("=== Lightning Box M1 Bring-Up ==="));
  Serial.println(F("Board: XIAO ESP32-C6"));
  Serial.println(F("Mode: AS3935 SPI + IRQ"));
  Serial.println(F("Fault code format: hex (0x...)"));
}

void startupBuzzerTest(bool muted_at_boot) {
  if (muted_at_boot) {
    Serial.println(F("buzzer_test=SKIPPED (mute switch ON at boot)"));
    return;
  }

  Serial.println(F("buzzer_test=START"));
  if (BUZZER_IS_PASSIVE) {
    // Short audible tone sweep for passive piezo elements.
    const uint16_t freq_hz[] = {1568, 1976, 2637, 3136};
    for (size_t i = 0; i < 4; i++) {
      tone(PIN_BUZZER, freq_hz[i], 140);
      delay(170);
    }
    noTone(PIN_BUZZER);
  } else {
    // Pulse pattern for active buzzers.
    const uint16_t on_ms[] = {120, 120, 180, 240};
    const uint16_t off_ms[] = {80, 80, 100, 0};
    for (size_t i = 0; i < 4; i++) {
      digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
      delay(on_ms[i]);
      digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
      if (off_ms[i] > 0) {
        delay(off_ms[i]);
      }
    }
  }
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

void setup() {
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  if (!BUZZER_IS_PASSIVE) {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
  }

  pinMode(PIN_ARM_SW, INPUT_PULLUP);
  pinMode(PIN_MUTE_SW, INPUT_PULLUP);
  pinMode(PIN_RESET_BTN, INPUT_PULLUP);
  pinMode(PIN_AS3935_IRQ, INPUT);

  Serial.begin(115200);
  delay(200);
  printBanner();
  g_prev_arm = armEnabled();
  g_prev_mute = muteEnabled();
  g_prev_reset_pressed = (digitalRead(PIN_RESET_BTN) == LOW);
  Serial.printf("startup arm=%d mute=%d\n", g_prev_arm ? 1 : 0, g_prev_mute ? 1 : 0);
  startupBuzzerTest(g_prev_mute);

  SensorProfile profile = SENSOR_PROFILE_DEFAULT;
  if (ENABLE_PROFILE_SELECT_SWITCH && g_prev_mute) {
    profile = PROFILE_NOISY;
  }
  g_sensor = (profile == PROFILE_NOISY) ? PARAM_NOISY : PARAM_SENSITIVE;
  Serial.printf("profile=%s (switch_select=%d)\n", g_sensor.name,
                ENABLE_PROFILE_SELECT_SWITCH ? 1 : 0);
  if (ENABLE_PROFILE_SELECT_SWITCH) {
    Serial.println(F("profile_hint: set MUTE switch ON before boot to force NOISY profile"));
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

  const int irq_num = digitalPinToInterrupt(PIN_AS3935_IRQ);
  if (irq_num == NOT_AN_INTERRUPT) {
    faultHalt(FAULT_AS3935_IRQ_ATTACH, "Invalid IRQ pin for attachInterrupt");
  }
  attachInterrupt(irq_num, onAs3935Irq, RISING);

  Serial.println(F("M1 init complete. Waiting for AS3935 events..."));
}

void handleAs3935Event(uint32_t now_ms) {
  // AS3935 datasheet recommends waiting >=2ms after IRQ.
  if (!g_irq_flag || (uint32_t)(now_ms - g_irq_seen_ms) < 2) {
    return;
  }

  g_irq_flag = false;
  const int intVal = lightning.readInterruptReg();
  g_last_event_ms = now_ms;

  if (intVal == NOISE_INT) {
    g_count_noise++;
    Serial.printf("[%lu] event=NOISE count=%lu\r\n", now_ms, g_count_noise);
  } else if (intVal == DISTURBER_INT) {
    g_count_disturber++;
    Serial.printf("[%lu] event=DISTURBER count=%lu\r\n", now_ms, g_count_disturber);
  } else if (intVal == LIGHTNING_INT) {
    g_count_lightning++;
    g_latched_lightning = true;
    const byte distance = lightning.distanceToStorm();
    const long energy = lightning.lightningEnergy();

    Serial.printf(
        "[%lu] event=LIGHTNING count=%lu distance_km=%u energy=%ld arm=%d mute=%d\r\n",
        now_ms, g_count_lightning, distance, energy, armEnabled() ? 1 : 0,
        muteEnabled() ? 1 : 0);

    if (!muteEnabled()) {
      startBuzzer(80);
    }
  } else {
    // intVal can be 0 when only distance estimate changed.
    Serial.printf("[%lu] event=OTHER int=0x%02X\r\n", now_ms, intVal);
  }
}

void loop() {
  const uint32_t now_ms = millis();
  const bool arm_now = armEnabled();
  const bool mute_now = muteEnabled();
  const bool reset_pressed_now = (digitalRead(PIN_RESET_BTN) == LOW);

  if (arm_now != g_prev_arm) {
    g_prev_arm = arm_now;
    Serial.printf("[%lu] switch=ARM state=%s\n", now_ms, arm_now ? "ON" : "OFF");
  }

  if (mute_now != g_prev_mute) {
    g_prev_mute = mute_now;
    Serial.printf("[%lu] switch=MUTE state=%s\n", now_ms, mute_now ? "ON" : "OFF");
  }

  if (reset_pressed_now != g_prev_reset_pressed) {
    Serial.printf("[%lu] switch=RESET state=%s\n", now_ms,
                  reset_pressed_now ? "DOWN" : "UP");
    // Act only on press edge.
    if (reset_pressed_now) {
      g_latched_lightning = false;
      g_count_lightning = 0;
      g_count_noise = 0;
      g_count_disturber = 0;
      Serial.printf("[%lu] action=RESET_ACK counters_cleared\r\n", now_ms);
      if (!mute_now) {
        startBuzzer(180);  // manual buzzer path test
      }
    }
    g_prev_reset_pressed = reset_pressed_now;
  }

  // Heartbeat LED: slow blink when armed, off when standby.
  if ((uint32_t)(now_ms - g_last_heartbeat_ms) >= 500) {
    g_last_heartbeat_ms = now_ms;
    if (arm_now) {
      digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    } else {
      digitalWrite(PIN_STATUS_LED, LOW);
    }
  }

  if (arm_now) {
    handleAs3935Event(now_ms);
  }

  updateBuzzer(now_ms);
}
