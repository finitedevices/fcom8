#include <stdio.h>
#include <emscripten.h>
#include <emscripten/bind.h>

#include "vrEmu6502.h"
#include "vrEmu6522.h"

#define INSTANCES 4
#define BANKED_ADDR(addr) (((active_instance->system_dips & 0b1000) ? 0x10000 : 0) | addr)

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
    mode_t mode = MODE_OFF;
    uint8_t system_dips = 0;
    uint8_t addr_dips = 0;
    uint8_t data_dips = 0;
};

struct aletheia instances[INSTANCES];
struct aletheia* active_instance = 0;

uint8_t ram_read(uint16_t addr, bool is_debug) {
    if ((addr & 0xFF00) == 0xFE00) {
        return vrEmu6522Read(active_instance->via, addr);
    }

    return active_instance->ram[BANKED_ADDR(addr)];
}

void ram_write(uint16_t addr, uint8_t data) {
    if ((addr & 0xFF00) == 0xFE00) {
        return vrEmu6522Write(active_instance->via, addr, data);
    }

    active_instance->ram[BANKED_ADDR(addr)] = data;
}

void setup() {
    for (instanceid_t i = 0; i < INSTANCES; i++) {
        active_instance = &instances[i];
        active_instance->cpu = vrEmu6502New(CPU_W65C02, ram_read, ram_write);
        active_instance->via = vrEmu6522New(VIA_65C22);
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
    }
}

void set_mode(instanceid_t instance, mode_t new_mode) {
    if (instance >= INSTANCES) {
        return;
    }

    active_instance = &instances[instance];

    if (active_instance->mode != MODE_CPU_RUN && new_mode == MODE_CPU_RUN) {
        vrEmu6502Reset(active_instance->cpu);
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

EMSCRIPTEN_BINDINGS(aletheia) {
    emscripten::function("setup", &setup);
    emscripten::function("loop", &loop);
    emscripten::function("setMode", &set_mode);
    emscripten::function("setDips", &set_dips);
    emscripten::function("getCustomLed", &get_custom_led);
}