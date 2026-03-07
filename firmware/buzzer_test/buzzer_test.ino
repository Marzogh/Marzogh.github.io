#include <Arduino.h>

// Buzzer test sketch for XIAO ESP32-C6
// Change these two flags only if needed.
static constexpr uint8_t PIN_BUZZER = D6;
static constexpr bool BUZZER_IS_PASSIVE = true;
static constexpr bool BUZZER_ACTIVE_HIGH = true;

void buzzerOff() {
  if (BUZZER_IS_PASSIVE) {
    noTone(PIN_BUZZER);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
  }
}

void chirp(uint16_t freq_hz, uint16_t ms_on, uint16_t ms_off) {
  if (BUZZER_IS_PASSIVE) {
    tone(PIN_BUZZER, freq_hz, ms_on);
    delay(ms_on + 5);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
    delay(ms_on);
    buzzerOff();
  }
  if (ms_off > 0) {
    delay(ms_off);
  }
}

void runStartupTune() {
  Serial.println(F("test=startup_tune"));
  chirp(1568, 140, 40);
  chirp(1976, 140, 40);
  chirp(2637, 180, 40);
  chirp(3136, 260, 0);
  buzzerOff();
  Serial.println(F("test=startup_tune_done"));
}

void runFastBeep() {
  Serial.println(F("test=fast_beep"));
  for (int i = 0; i < 4; i++) {
    chirp(2400, 90, 80);
  }
  buzzerOff();
  Serial.println(F("test=fast_beep_done"));
}

void runLongTone() {
  Serial.println(F("test=long_tone"));
  if (BUZZER_IS_PASSIVE) {
    tone(PIN_BUZZER, 2200);
    delay(1200);
    noTone(PIN_BUZZER);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
    delay(1200);
    buzzerOff();
  }
  Serial.println(F("test=long_tone_done"));
}

void setDriveLevel(bool on) {
  if (on) {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? HIGH : LOW);
  } else {
    digitalWrite(PIN_BUZZER, BUZZER_ACTIVE_HIGH ? LOW : HIGH);
  }
}

void runTransistorProbe() {
  Serial.println(F("probe=start"));
  Serial.println(F("probe=Measure with DMM:"));
  Serial.println(F("probe=1) Emitter to GND (should be ~0V always)"));
  Serial.println(F("probe=2) Base to GND  (OFF~0V, ON~0.6-0.9V via 1k)"));
  Serial.println(F("probe=3) Collector to GND (OFF~buzzer rail, ON~near 0V)"));

  // OFF window
  setDriveLevel(false);
  Serial.println(F("probe=OFF window 4s"));
  delay(4000);

  // ON window (DC drive for clear transistor-state probing)
  setDriveLevel(true);
  Serial.println(F("probe=ON window 10s"));
  delay(60000);

  // OFF again
  setDriveLevel(false);
  Serial.println(F("probe=end"));
}

void printHelp() {
  Serial.println();
  Serial.println(F("Buzzer Test Commands:"));
  Serial.println(F("  t -> startup tune"));
  Serial.println(F("  b -> fast beeps"));
  Serial.println(F("  l -> long tone"));
  Serial.println(F("  p -> transistor probe (4s OFF, 10s ON, 4s OFF)"));
  Serial.println(F("  o -> buzzer off"));
  Serial.println(F("  h -> help"));
  Serial.println();
}

void setup() {
  pinMode(PIN_BUZZER, OUTPUT);
  buzzerOff();

  Serial.begin(115200);
  delay(200);

  Serial.println();
  Serial.println(F("=== Buzzer Only Test ==="));
  Serial.printf("pin=%u passive=%d active_high=%d\n", PIN_BUZZER,
                BUZZER_IS_PASSIVE ? 1 : 0, BUZZER_ACTIVE_HIGH ? 1 : 0);
  Serial.println(F("Wiring: D6 -> 1k -> base, base->100k->GND, emitter->GND, collector->buzzer-, buzzer+->V+"));

  runStartupTune();
  printHelp();
}

void loop() {
  if (Serial.available() > 0) {
    const char c = (char)Serial.read();
    if (c == 't') {
      runStartupTune();
    } else if (c == 'b') {
      runFastBeep();
    } else if (c == 'l') {
      runLongTone();
    } else if (c == 'p') {
      runTransistorProbe();
    } else if (c == 'o') {
      buzzerOff();
      Serial.println(F("test=off"));
    } else if (c == 'h') {
      printHelp();
    }
  }
}
