const SYSTEM_DIPS = [
    {name: "RAM bank", class: "ramBank"},
    {name: "Backlight", class: "backlight"},
    {name: "Custom A", class: "customA"},
    {name: "Custom B", class: "customB"}
];

const INSTANCES = 4;
const LCD_WIDTH = (20 * 6) - 1;
const LCD_HEIGHT = (4 * 9) - 1;
const LCD_PIXELS_PER_DOT = 3;

var instances = [];
var displayContexts = {};

class Instance {
    constructor(id) {
        var thisScope = this;

        this.id = id;
        this._mode = null;

        var element = this.element = document.createElement("div");
        var displayCanvas = this.displayCanvas = document.createElement("canvas");
        var displayContext = this.displayContext = displayCanvas.getContext("2d");

        element.id = `instance${id}`;
        element.className = "instance";
        element.hidden = id != 0;

        element.setAttribute("data-instanceid", id);

        displayCanvas.width = LCD_WIDTH * LCD_PIXELS_PER_DOT;
        displayCanvas.height = LCD_HEIGHT * LCD_PIXELS_PER_DOT;

        element.innerHTML = `
            <div class="display"></div>
            <fieldset class="dips system">
                <legend>System DIPs</legend>
                ${SYSTEM_DIPS.map((dip, i) => `
                    <input type="checkbox" title="${dip.name}" class="${dip.class}" aria-label="${dip.name}" dip-pos="${i + 1}">
                `).join("")}
            </fieldset>
            <fieldset class="dips addr">
                <legend>Address DIPs</legend>
                ${[...Array(8).keys()].reverse().map((i) => `
                    <input type="checkbox" title="${2 ** i}" aria-label="${2 ** i}" dip-pos="${8 - i}">
                `).join("")}
            </fieldset>
            <fieldset class="dips data">
                <legend>Data DIPs</legend>
                ${[...Array(8).keys()].reverse().map((i) => `
                    <input type="checkbox" title="${2 ** i}" aria-label="${2 ** i}" dip-pos="${8 - i}">
                `).join("")}
            </fieldset>
            <fieldset class="mode">
                <legend>Mode</legend>
                <input type="radio" title="CPU run" name="mode${id}" value="cpuRun" aria-label="CPU run">
                <input type="radio" title="Off" name="mode${id}" value="off" checked aria-label="Off">
                <input type="radio" title="RAM write" name="mode${id}" value="ramWrite" aria-label="RAM write">
            </fieldset>
            <div class="led cpuRun"></div>
            <div class="led ramWrite"></div>
            <div class="led custom"></div>
        `;

        element.querySelectorAll(".dips input").forEach(function(dipSwitch) {
            dipSwitch.addEventListener("change", function() {
                Module.setDips(id, thisScope.getDipsValue("system"), thisScope.getDipsValue("addr"), thisScope.getDipsValue("data"));
            });
        });

        element.querySelectorAll(".mode input").forEach(function(modeState) {
            modeState.addEventListener("change", function() {
                thisScope.mode = element.querySelector(".mode input:checked").value;

                if (thisScope.mode == "ramWrite") {
                    thisScope.mode = "off";
                }
            });
        });
        
        requestAnimationFrame(function render() {
            if (thisScope.mode == "cpuRun" && Module.getCustomLed(id)) {
                element.querySelector(".led.custom").classList.add("on");
            } else {
                element.querySelector(".led.custom").classList.remove("on");
            }
            
            requestAnimationFrame(render);
        });
        
        this.mode = "off";
        
        element.querySelector(".display").append(displayCanvas);
        
        document.querySelector("#instances").append(element);
        document.querySelector("#applyInstances").append(this.createInstanceApplyCheckbox(id));
    }
    
    get mode() {
        return this._mode;
    }
    
    set mode(value) {
        this._mode = value;

        this.element.setAttribute("data-mode", value);
        this.element.querySelector(`.mode input[value='${value}']`).checked = true;

        Module.setMode(this.id, ["off", "ramWrite", "cpuRun"].indexOf(value));
        Module.loop();

        this.displayCanvas.width = this.displayCanvas.width;
        this.displayCanvas.height = this.displayCanvas.height;
    }

    getDipsValue(type) {
        var value = 0;

        this.element.querySelectorAll(`.dips.${type} input`).forEach(function(dipSwitch) {
            value <<= 1;
            value |= dipSwitch.checked ? 1 : 0;
        });

        return value;
    }

    renderLcdBitmap(buffer) {
        var context = this.displayContext;

        if (this.mode != "cpuRun") {
            return;
        }

        for (var y = 0; y < LCD_HEIGHT; y++) {
            if (y % 9 == 8) {
                continue;
            }

            var rowSize = Math.ceil(LCD_WIDTH / 8);

            for (var xByte = 0; xByte < rowSize; xByte++) {
                var byte = buffer[(y * rowSize) + xByte];

                for (var x = xByte * 8; x < (xByte + 1) * 8; x++) {
                    if (x % 6 == 5) {
                        continue;
                    }

                    context.fillStyle = ((byte >> (x % 8)) & 0x01) ? "#eeeeff66" : "#0000ff22";

                    context.fillRect(
                        x * LCD_PIXELS_PER_DOT,
                        y * LCD_PIXELS_PER_DOT,
                        LCD_PIXELS_PER_DOT - 1,
                        LCD_PIXELS_PER_DOT - 1
                    );
                }
            }
        }
    }

    createInstanceApplyCheckbox() {
        var container = document.createElement("div");
        var checkbox = document.createElement("input");
        var label = document.createElement("label");

        checkbox.type = "checkbox";
        checkbox.id = `applyInstance${this.id}`;
        checkbox.checked = this.id == 0;

        label.htmlFor = checkbox.id;
        label.textContent = this.id;

        container.append(checkbox);
        container.append(label);

        return container;
    }
}

var loadCode = Module.cwrap("load_code", null, ["number", "number", "number", "number"]);

function applyProperties(id) {
    var instance = document.getElementById(`instance${id}`);

    instance.hidden = !document.querySelector("#showInstance").checked;

    if (document.querySelector("#loadCode").checked) {
        var bytes = new Uint8Array(document.querySelector("#codeInput").value.match(/[0-9a-fA-F][0-9a-fA-F]\s*/g).map((value) => parseInt(value, 16)));

        var buffer = Module._malloc(bytes.length);

        Module.HEAPU8.set(bytes, buffer);

        loadCode(id, buffer, 0xFF00, bytes.length);

        Module._free(buffer);
    }
}

function renderLcdBitmap(id, buffer) {
    instances.find((instance) => instance.id == id)?.renderLcdBitmap(buffer);
}

Module.onRuntimeInitialized = function() {
    console.log("Runtime initialised");
    
    Module.setup();
    
    for (var i = 0; i < INSTANCES; i++) {
        instances.push(new Instance(i));
    }
    
    document.querySelector("#codeInput").addEventListener("input", function() {
        document.querySelector("#loadCode").checked = true;
    });
    
    document.querySelector("#applyButton").addEventListener("click", function() {
        for (var i = 0; i < INSTANCES; i++) {
            if (document.getElementById(`applyInstance${i}`).checked) {
                applyProperties(i);
            }
        }

        document.querySelector("#loadCode").checked = false;
    });

    requestAnimationFrame(function render() {
        Module.loop();

        requestAnimationFrame(render);
    });
};