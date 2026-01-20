#include <stdio.h>
#include <emscripten.h>
#include <emscripten/bind.h>

#include "vrEmu6502.h"
#include "vrEmu6522.h"
#include "vrEmuLcd.h"

#define INSTANCES 4
#define BANKED_ADDR(addr) (((active_instance->system_dips & 0x04) ? 0x10000 : 0) | addr)

enum {
    MODE_OFF = 0,
    MODE_RAM_WRITE = 1,
    MODE_CPU_RUN = 2
};

typedef uint8_t mode_t;
typedef size_t instanceid_t;

struct aletheia {
    uint8_t ram[0x20000]; // 128 KiB
    VrEmu6502* cpu;
    VrEmu6522* via;
    VrEmuLcd* lcd;
    mode_t mode = MODE_OFF;
    uint8_t system_dips = 0;
    uint8_t addr_dips = 0;
    uint8_t data_dips = 0;
};

struct aletheia instances[INSTANCES];
struct aletheia* active_instance = 0;
const unsigned int lcd_buffer_row_size = (20 * 6) / 8;
uint8_t current_lcd_buffer[lcd_buffer_row_size * (4 * 9)];

EM_JS(void, send_lcd_bitmap, (instanceid_t instance, uint8_t* data, uint32_t size), {
    renderLcdBitmap(instance, new Uint8ClampedArray(HEAPU8.buffer.slice(data), 0, size));
});

uint8_t ram_read(uint16_t addr, bool is_debug) {
    if ((addr & 0xFF00) == 0xFE00) {
        return vrEmu6522Read(active_instance->via, addr);
    }

    return active_instance->ram[BANKED_ADDR(addr)];
}

void ram_write(uint16_t addr, uint8_t data) {
    if ((addr & 0xFF00) == 0xFE00) {
        bool orig_lcd_enable = vrEmu6522ReadDbg(active_instance->via, 0) & 0x08;

        vrEmu6522Write(active_instance->via, addr, data);

        uint8_t paState = vrEmu6522ReadDbg(active_instance->via, 1);
        uint8_t pbState = vrEmu6522ReadDbg(active_instance->via, 0);

        if (!orig_lcd_enable && pbState & 0x08) {
            if (pbState & 0x04) { // If reading
                vrEmu6522Write(active_instance->via, 1, vrEmuLcdReadByteNoInc(active_instance->lcd));
            } else if (pbState & 0x02) { // If register selected
                vrEmuLcdSendCommand(active_instance->lcd, paState);
            } else {
                vrEmuLcdWriteByte(active_instance->lcd, paState);
            }
        }

        return;
    }

    active_instance->ram[BANKED_ADDR(addr)] = data;
}

void setup() {
    for (instanceid_t i = 0; i < INSTANCES; i++) {
        active_instance = &instances[i];
        active_instance->cpu = vrEmu6502New(CPU_W65C02, ram_read, ram_write);
        active_instance->via = vrEmu6522New(VIA_65C22);
        active_instance->lcd = vrEmuLcdNew(20, 4, EmuLcdRomA00);
    }
}

void loop() {
    for (instanceid_t i = 0; i < INSTANCES; i++) {
        active_instance = &instances[i];

        if (active_instance->mode == MODE_RAM_WRITE) {
            active_instance->ram[BANKED_ADDR(active_instance->addr_dips) | 0xFF00] = active_instance->data_dips;
        }

        if (active_instance->mode == MODE_CPU_RUN) {
            for (unsigned int j = 0; j < 256; j++) {
                vrEmu6502Tick(active_instance->cpu);
                vrEmu6522Tick(active_instance->via);

                *vrEmu6502Int(active_instance->cpu) = *vrEmu6522Int(active_instance->via);
            }
        }

        VrEmuLcd* lcd = active_instance->lcd;

        vrEmuLcdUpdatePixels(lcd);

        for (unsigned int y = 0; y < sizeof(current_lcd_buffer) / lcd_buffer_row_size; y++) {
            for (unsigned int xByte = 0; xByte < lcd_buffer_row_size; xByte++) {
                uint8_t byte = 0;

                for (unsigned int x = xByte * 8; x < (xByte + 1) * 8; x++) {
                    int8_t pixel = vrEmuLcdPixelState(lcd, x, y);

                    byte >>= 1;
                    byte |= pixel == 1 ? 0x80 : 0;
                }

                current_lcd_buffer[(y * lcd_buffer_row_size) + xByte] = byte;
            }
        }

        send_lcd_bitmap(i, current_lcd_buffer, sizeof(current_lcd_buffer));
    }
}

void set_mode(instanceid_t instance, mode_t new_mode) {
    if (instance >= INSTANCES) {
        return;
    }

    active_instance = &instances[instance];

    if (active_instance->mode != MODE_CPU_RUN && new_mode == MODE_CPU_RUN) {
        vrEmu6502Reset(active_instance->cpu);
        vrEmu6522Reset(active_instance->via);

        if (active_instance->lcd) {
            vrEmuLcdDestroy(active_instance->lcd);
        }

        active_instance->lcd = vrEmuLcdNew(20, 4, EmuLcdRomA00);
    }

    active_instance->mode = new_mode;
}

void set_dips(instanceid_t instance, uint8_t system, uint8_t addr, uint8_t data) {
    if (instance >= INSTANCES) {
        return;
    }

    active_instance = &instances[instance];

    active_instance->system_dips = system;
    active_instance->addr_dips = addr;
    active_instance->data_dips = data;
}

bool get_custom_led(instanceid_t instance) {
    if (instance >= INSTANCES) {
        return 0;
    }

    return vrEmu6522ReadDbg(instances[instance].via, 0) & 0x01;
}

extern "C" void load_code(instanceid_t instance, uint8_t* code, uint16_t offset, uint16_t length) {
    if (instance >= INSTANCES) {
        return;
    }

    active_instance = &instances[instance];

    for (uint16_t i = 0; i < length; i++) {
        ram_write(offset + i, code[i]);
    }
}

EMSCRIPTEN_BINDINGS(aletheia) {
    emscripten::function("setup", &setup);
    emscripten::function("loop", &loop);
    emscripten::function("setMode", &set_mode);
    emscripten::function("setDips", &set_dips);
    emscripten::function("getCustomLed", &get_custom_led);
}