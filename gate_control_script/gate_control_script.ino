#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_NeoPixel.h>
#include <Servo.h>

#define RFID_SS_PIN   10
#define RFID_RST_PIN  9

#define LED_PIN       6
#define NUM_LEDS      1

#define SERVO_PIN     5

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
MFRC522::MIFARE_Key key;

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
Servo gateServo;

byte blockNum = 4;

const unsigned long RFID_CHECK_INTERVAL = 1000;
const unsigned long REMOVE_TIMEOUT = 3000;

String last_scanned = "";
bool gateOpen = false;

unsigned long lastRfidCheckTime = 0;
unsigned long lastCardSeenTime = 0;

void setup() {
  Serial.begin(9600);

  SPI.begin();
  rfid.PCD_Init();

  for (byte i = 0; i < 6; i++) {
    key.keyByte[i] = 0xFF;
  }

  strip.begin();
  strip.show();

  gateServo.attach(SERVO_PIN);
  closeGate();

  Serial.println("EVT:SYSTEM_READY");
}

void loop() {
  handlePythonCommand();

  unsigned long now = millis();

  if (now - lastRfidCheckTime >= RFID_CHECK_INTERVAL) {
    lastRfidCheckTime = now;

    String scanned = readRFIDTagContinuous();

    if (scanned.length() > 0) {
      lastCardSeenTime = now;

      if (scanned != last_scanned) {
        if (gateOpen && last_scanned.length() > 0) {
          closeGate();
        }

        last_scanned = scanned;

        Serial.println(last_scanned);
      }
    }
  }

  if (gateOpen && lastCardSeenTime > 0) {
    if (now - lastCardSeenTime >= REMOVE_TIMEOUT) {
      closeGate();
      last_scanned = "";
      lastCardSeenTime = 0;
    }
  }
}

void handlePythonCommand() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();

    if (cmd == "open_gate") {
      openGate();
    }
  }
}

String readRFIDTagContinuous() {
  byte bufferATQA[2];
  byte bufferSize = sizeof(bufferATQA);

  // Wake up card even if it was already halted
  MFRC522::StatusCode wakeStatus = rfid.PICC_WakeupA(bufferATQA, &bufferSize);

  if (wakeStatus != MFRC522::STATUS_OK) {
    return "";
  }

  if (!rfid.PICC_ReadCardSerial()) {
    return "";
  }

  MFRC522::PICC_Type type = rfid.PICC_GetType(rfid.uid.sak);

  if (type != MFRC522::PICC_TYPE_MIFARE_1K &&
      type != MFRC522::PICC_TYPE_MIFARE_4K &&
      type != MFRC522::PICC_TYPE_MIFARE_MINI) {
    stopRFID();
    return "";
  }

  MFRC522::StatusCode status;

  status = rfid.PCD_Authenticate(
    MFRC522::PICC_CMD_MF_AUTH_KEY_A,
    blockNum,
    &key,
    &(rfid.uid)
  );

  if (status != MFRC522::STATUS_OK) {
    stopRFID();
    return "";
  }

  byte buffer[18];
  byte size = sizeof(buffer);

  status = rfid.MIFARE_Read(blockNum, buffer, &size);

  if (status != MFRC522::STATUS_OK) {
    stopRFID();
    return "";
  }

  char text[17];

  for (byte i = 0; i < 16; i++) {
    text[i] = (char)buffer[i];
  }

  text[16] = '\0';

  String tagData = String(text);
  tagData.trim();

  stopRFID();

  return tagData;
}

void openGate() {
  gateOpen = true;
  lastCardSeenTime = millis();

  gateServo.write(90);
  setGreen();

  Serial.println("EVT:GATE_OPENED");
}

void closeGate() {
  gateOpen = false;

  gateServo.write(0);
  setRed();

  Serial.println("EVT:GATE_CLOSED");
}

void setGreen() {
  strip.setPixelColor(0, strip.Color(0, 255, 0));
  strip.show();
}

void setRed() {
  strip.setPixelColor(0, strip.Color(255, 0, 0));
  strip.show();
}

void stopRFID() {
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}