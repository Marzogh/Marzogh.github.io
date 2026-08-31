export type AvrDipFamily = 'ATmega' | 'ATtiny';

export interface AvrDipPinout {
  id: string;
  family: AvrDipFamily;
  package: string;
  pins: number;
  name: string;
  devices: string[];
  lifecycle: 'Current and legacy' | 'Legacy';
  summary: string;
  note: string;
  sourceLabel: string;
  source: string;
  ascii: string;
}

export const avrDipPinouts: AvrDipPinout[] = [
  {
    id: 'tiny-classic-8',
    family: 'ATtiny',
    package: '8-pin PDIP',
    pins: 8,
    name: 'Classic 8-pin ATtiny layout',
    devices: [
      'ATtiny11', 'ATtiny11L', 'ATtiny12', 'ATtiny12L', 'ATtiny12V',
      'ATtiny13', 'ATtiny13V', 'ATtiny13A', 'ATtiny22', 'ATtiny22L',
      'ATtiny25', 'ATtiny25V', 'ATtiny45', 'ATtiny45V', 'ATtiny85', 'ATtiny85V',
    ],
    lifecycle: 'Current and legacy',
    summary: 'The familiar six-I/O ATtiny footprint used by several generations of 8-pin devices.',
    note: 'The port positions are pin-compatible. Peripheral names, reset/clock options and programming behaviour vary by device, so check the selected part before treating an alternate function as interchangeable.',
    sourceLabel: 'ATtiny11/12 reference datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/1006S.pdf',
    ascii: `             +---\\/---+
 RESET / PB5 |1       8| VCC
        PB3  |2       7| PB2
        PB4  |3       6| PB1
        GND  |4       5| PB0
             +--------+`,
  },
  {
    id: 'tiny15-8',
    family: 'ATtiny',
    package: '8-pin PDIP',
    pins: 8,
    name: 'ATtiny15 layout',
    devices: ['ATtiny15', 'ATtiny15L'],
    lifecycle: 'Legacy',
    summary: 'The ATtiny15 looks deceptively similar to the later 8-pin family, but PB3 and PB4 trade places.',
    note: 'Do not substitute it blindly into an ATtiny13/25/45/85 socket: pins 2 and 3 are reversed at the port-name level.',
    sourceLabel: 'ATtiny15/L datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/doc1187.pdf',
    ascii: `             +---\\/---+
 RESET / PB5 |1       8| VCC
        PB4  |2       7| PB2
        PB3  |3       6| PB1
        GND  |4       5| PB0
             +--------+`,
  },
  {
    id: 'tiny-x4-14',
    family: 'ATtiny',
    package: '14-pin PDIP',
    pins: 14,
    name: 'ATtiny x4 family',
    devices: ['ATtiny24', 'ATtiny24V', 'ATtiny24A', 'ATtiny44', 'ATtiny44V', 'ATtiny44A', 'ATtiny84', 'ATtiny84V', 'ATtiny84A'],
    lifecycle: 'Current and legacy',
    summary: 'The pin-compatible 14-pin ATtiny family spanning 2 KB, 4 KB and 8 KB Flash variants.',
    note: 'The A and historical V suffixes change silicon generation or voltage/speed grade, not the PDIP port positions shown here.',
    sourceLabel: 'ATtiny24A/44A/84A datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATtiny24A-44A-84A-DataSheet-DS40002269A.pdf',
    ascii: `             +---\\/---+
        VCC  |1      14| GND
        PB0  |2      13| PA0
        PB1  |3      12| PA1
 RESET / PB3 |4      11| PA2
        PB2  |5      10| PA3
        PA7  |6       9| PA4
        PA6  |7       8| PA5
             +--------+`,
  },
  {
    id: 'tiny-x313-20',
    family: 'ATtiny',
    package: '20-pin PDIP',
    pins: 20,
    name: 'ATtiny 2313 / 4313 family',
    devices: ['ATtiny2313', 'ATtiny2313V', 'ATtiny2313A', 'ATtiny4313'],
    lifecycle: 'Current and legacy',
    summary: 'A compact 20-pin layout with a full Port B, most of Port D and two crystal pins on Port A.',
    note: 'These closely related devices share the physical PDIP layout. Available memory and some peripheral details differ.',
    sourceLabel: 'ATtiny2313A/4313 datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/doc8246.pdf',
    ascii: `             +---\\/---+
 RESET / PA2 |1      20| VCC
        PD0  |2      19| PB7
        PD1  |3      18| PB6
 XTAL2 / PA1 |4      17| PB5
 XTAL1 / PA0 |5      16| PB4
        PD2  |6      15| PB3
        PD3  |7      14| PB2
        PD4  |8      13| PB1
        PD5  |9      12| PB0
        GND  |10     11| PD6
             +--------+`,
  },
  {
    id: 'tiny-x6-20',
    family: 'ATtiny',
    package: '20-pin PDIP',
    pins: 20,
    name: 'ATtiny 26 / x61 family',
    devices: ['ATtiny26', 'ATtiny26L', 'ATtiny261', 'ATtiny261V', 'ATtiny261A', 'ATtiny461', 'ATtiny461V', 'ATtiny461A', 'ATtiny861', 'ATtiny861V', 'ATtiny861A'],
    lifecycle: 'Current and legacy',
    summary: 'The analogue- and timer-heavy 20-pin ATtiny layout used by the ATtiny26 and later x61 line.',
    note: 'The base PA/PB positions are shared. Alternate functions evolved substantially between the ATtiny26 and x61 generations.',
    sourceLabel: 'ATtiny261A/461A/861A datasheet',
    source: 'https://ww1.microchip.com/downloads/en/devicedoc/8197s.pdf',
    ascii: `             +---\\/---+
        PB0  |1      20| PA0
        PB1  |2      19| PA1
        PB2  |3      18| PA2
        PB3  |4      17| PA3 / AREF
        VCC  |5      16| GND
        GND  |6      15| AVCC
        PB4  |7      14| PA4
        PB5  |8      13| PA5
        PB6  |9      12| PA6
 RESET / PB7 |10     11| PA7
             +--------+`,
  },
  {
    id: 'tiny28-28',
    family: 'ATtiny',
    package: '28-pin PDIP',
    pins: 28,
    name: 'ATtiny28 layout',
    devices: ['ATtiny28L', 'ATtiny28V'],
    lifecycle: 'Legacy',
    summary: 'An unusual early ATtiny: 11 programmable I/O lines, eight input-only Port B lines and a dedicated high-current output.',
    note: 'Port B is input-only on this device. PA2 is output-only and doubles as the high-current IR/LED driver; pin 20 is not connected.',
    sourceLabel: 'ATtiny28L/V datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/doc1062.pdf',
    ascii: `             +---\\/---+
       RESET |1      28| PA0
         PD0 |2      27| PA1
         PD1 |3      26| PA3
         PD2 |4      25| PA2 / IR
         PD3 |5      24| PB7 (input)
         PD4 |6      23| PB6 (input)
         VCC |7      22| GND
         GND |8      21| NC
       XTAL1 |9      20| VCC
       XTAL2 |10     19| PB5 (input)
         PD5 |11     18| PB4 (input)
         PD6 |12     17| PB3 (input)
         PD7 |13     16| PB2 (input)
         PB0 |14     15| PB1 (input)
             +--------+`,
  },
  {
    id: 'tiny48-88-28',
    family: 'ATtiny',
    package: '28-pin PDIP',
    pins: 28,
    name: 'ATtiny48 / ATtiny88 layout',
    devices: ['ATtiny48', 'ATtiny88'],
    lifecycle: 'Legacy',
    summary: 'The largest classic ATtiny PDIP footprint, physically aligned with the familiar 28-pin AVR port layout.',
    note: 'This is the ATtiny48/88 base-port map. Do not infer ATmega peripheral compatibility merely because the package positions look familiar.',
    sourceLabel: 'ATtiny48/88 datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/doc8008.pdf',
    ascii: `             +---\\/---+
 RESET / PC6 |1      28| PC5
         PD0 |2      27| PC4
         PD1 |3      26| PC3
         PD2 |4      25| PC2
         PD3 |5      24| PC1
         PD4 |6      23| PC0
         VCC |7      22| GND
         GND |8      21| AREF
 XTAL1 / PB6 |9      20| AVCC
 XTAL2 / PB7 |10     19| PB5
         PD5 |11     18| PB4
         PD6 |12     17| PB3
         PD7 |13     16| PB2
         PB0 |14     15| PB1
             +--------+`,
  },
  {
    id: 'mega-classic-28',
    family: 'ATmega',
    package: '28-pin PDIP/SPDIP',
    pins: 28,
    name: 'Classic 28-pin ATmega layout',
    devices: [
      'ATmega8', 'ATmega8L', 'ATmega8A',
      'ATmega48', 'ATmega48V', 'ATmega48A', 'ATmega48P', 'ATmega48PA',
      'ATmega88', 'ATmega88V', 'ATmega88A', 'ATmega88P', 'ATmega88PA',
      'ATmega168', 'ATmega168V', 'ATmega168A', 'ATmega168P', 'ATmega168PA',
      'ATmega328', 'ATmega328P',
    ],
    lifecycle: 'Current and legacy',
    summary: 'The long-lived 28-pin AVR footprint shared by the ATmega8 and the ATmega48/88/168/328 lineage.',
    note: 'The base port and power-pin positions match. Alternate functions, interrupt maps and peripheral sets do not remain identical across every generation.',
    sourceLabel: 'ATmega48A/PA/88A/PA/168A/PA/328/P datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf',
    ascii: `             +---\\/---+
 RESET / PC6 |1      28| PC5
         PD0 |2      27| PC4
         PD1 |3      26| PC3
         PD2 |4      25| PC2
         PD3 |5      24| PC1
         PD4 |6      23| PC0
         VCC |7      22| GND
         GND |8      21| AREF
 XTAL1 / PB6 |9      20| AVCC
 XTAL2 / PB7 |10     19| PB5
         PD5 |11     18| PB4
         PD6 |12     17| PB3
         PD7 |13     16| PB2
         PB0 |14     15| PB1
             +--------+`,
  },
  {
    id: 'mega-external-bus-40',
    family: 'ATmega',
    package: '40-pin PDIP',
    pins: 40,
    name: '40-pin external-bus ATmega layout',
    devices: ['ATmega161', 'ATmega161L', 'ATmega162', 'ATmega162V', 'ATmega8515', 'ATmega8515L'],
    lifecycle: 'Legacy',
    summary: 'The 40-pin external-memory-oriented layout shared by the ATmega161/162 and ATmega8515.',
    note: 'Port A carries multiplexed address/data, Port C carries the high address byte, and Port E occupies pins 29–31. Peripheral aliases differ by generation.',
    sourceLabel: 'ATmega161/L datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/doc1228.pdf',
    ascii: `             +---\\/---+
         PB0 |1      40| VCC
         PB1 |2      39| PA0 / AD0
         PB2 |3      38| PA1 / AD1
         PB3 |4      37| PA2 / AD2
         PB4 |5      36| PA3 / AD3
         PB5 |6      35| PA4 / AD4
         PB6 |7      34| PA5 / AD5
         PB7 |8      33| PA6 / AD6
       RESET |9      32| PA7 / AD7
         PD0 |10     31| PE0
         PD1 |11     30| PE1 / ALE
         PD2 |12     29| PE2
         PD3 |13     28| PC7 / A15
         PD4 |14     27| PC6 / A14
         PD5 |15     26| PC5 / A13
    PD6 / WR |16     25| PC4 / A12
    PD7 / RD |17     24| PC3 / A11
       XTAL2 |18     23| PC2 / A10
       XTAL1 |19     22| PC1 / A9
         GND |20     21| PC0 / A8
             +--------+`,
  },
  {
    id: 'mega-general-40',
    family: 'ATmega',
    package: '40-pin PDIP',
    pins: 40,
    name: 'General-purpose 40-pin ATmega layout',
    devices: [
      'ATmega16', 'ATmega16L', 'ATmega16A', 'ATmega32', 'ATmega32L', 'ATmega32A',
      'ATmega163', 'ATmega163L', 'ATmega323', 'ATmega323L', 'ATmega8535', 'ATmega8535L',
      'ATmega164A', 'ATmega164P', 'ATmega164PA', 'ATmega324A', 'ATmega324P', 'ATmega324PA',
      'ATmega644', 'ATmega644A', 'ATmega644P', 'ATmega644PA', 'ATmega1284', 'ATmega1284P',
    ],
    lifecycle: 'Current and legacy',
    summary: 'The enduring four-port 40-pin AVR arrangement used from early ATmega parts through the ATmega1284P.',
    note: 'The base port positions are compatible. Pin 31 is labelled AGND on some early devices and GND on later ones; either way it is the analogue-side ground connection in this footprint.',
    sourceLabel: 'ATmega164A/324A/644A/1284 family datasheet',
    source: 'https://ww1.microchip.com/downloads/en/devicedoc/atmega164a_pa-324a_pa-644a_pa-1284_p_data-sheet-40002070a.pdf',
    ascii: `             +---\\/---+
         PB0 |1      40| PA0 / ADC0
         PB1 |2      39| PA1 / ADC1
         PB2 |3      38| PA2 / ADC2
         PB3 |4      37| PA3 / ADC3
         PB4 |5      36| PA4 / ADC4
         PB5 |6      35| PA5 / ADC5
         PB6 |7      34| PA6 / ADC6
         PB7 |8      33| PA7 / ADC7
       RESET |9      32| AREF
         VCC |10     31| GND / AGND
         GND |11     30| AVCC
       XTAL2 |12     29| PC7
       XTAL1 |13     28| PC6
         PD0 |14     27| PC5
         PD1 |15     26| PC4
         PD2 |16     25| PC3
         PD3 |17     24| PC2
         PD4 |18     23| PC1
         PD5 |19     22| PC0
         PD6 |20     21| PD7
             +--------+`,
  },
  {
    id: 'mega-0-series-x09-40',
    family: 'ATmega',
    package: '40-pin PDIP',
    pins: 40,
    name: 'ATmega4809 40-pin layout',
    devices: ['ATmega4809'],
    lifecycle: 'Current and legacy',
    summary: 'The modern megaAVR 0-series through-hole layout, using UPDI and the newer port-multiplexing architecture.',
    note: 'This is not pin-compatible with the classic 40-pin ATmega family. Note the dedicated UPDI pin, split supply pins and completely different port order.',
    sourceLabel: 'ATmega4809 40-pin PDIP datasheet',
    source: 'https://ww1.microchip.com/downloads/en/DeviceDoc/ATmega4809-40-Pin-40002104B.pdf',
    ascii: `             +---\\/---+
         PC0 |1      40| PA7
         PC1 |2      39| PA6
         PC2 |3      38| PA5
         PC3 |4      37| PA4
         VDD |5      36| PA3
         GND |6      35| PA2
         PC4 |7      34| PA1
         PC5 |8      33| PA0 / EXTCLK
         PD0 |9      32| GND
         PD1 |10     31| VDD
         PD2 |11     30| UPDI
         PD3 |12     29| PF6 / RESET
         PD4 |13     28| PF5
         PD5 |14     27| PF4
         PD6 |15     26| PF3
         PD7 |16     25| PF2
        AVDD |17     24| PF1 / TOSC2
         GND |18     23| PF0 / TOSC1
         PE0 |19     22| PE3
         PE1 |20     21| PE2
             +--------+`,
  },
];

export const avrDipDeviceCount = new Set(avrDipPinouts.flatMap((pinout) => pinout.devices)).size;
