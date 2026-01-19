const SYSTEM_DIPS = [
    {name: "RAM bank", class: "ramBank"},
    {name: "Backlight", class: "backlight"},
    {name: "Custom A", class: "customA"},
    {name: "Custom B", class: "customB"}
];

const INSTANCES = 4;

function createInstanceApplyCheckbox(id) {
    var container = document.createElement("div");
    var checkbox = document.createElement("input");
    var label = document.createElement("label");

    checkbox.type = "checkbox";
    checkbox.id = `applyInstance${id}`;
    checkbox.checked = id == 0;

    label.htmlFor = checkbox.id;
    label.textContent = id;

    container.append(checkbox);
    container.append(label);

    return container;
}

function createInstance(id) {
    var instance = document.createElement("div");
    var mode = "off";

    instance.id = `instance${id}`;
    instance.className = "instance";
    instance.hidden = id != 0;

    instance.setAttribute("data-instanceid", id);

    instance.innerHTML = `
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
            <input type="radio" title="CPU run" name="mode" value="cpuRun" aria-label="CPU run">
            <input type="radio" title="Off" name="mode" value="off" checked aria-label="Off">
            <input type="radio" title="RAM write" name="mode" value="ramWrite" aria-label="RAM write">
        </fieldset>
        <div class="led cpuRun"></div>
        <div class="led ramWrite"></div>
        <div class="led custom"></div>
    `;

    function getDipsValue(type) {
        var value = 0;

        instance.querySelectorAll(`.dips.${type} input`).forEach(function(dipSwitch) {
            value <<= 1;
            value |= dipSwitch.checked ? 1 : 0;
        });

        return value;
    }

    instance.querySelectorAll(".dips input").forEach(function(dipSwitch) {
        dipSwitch.addEventListener("change", function() {
            Module.setDips(id, getDipsValue("system"), getDipsValue("addr"), getDipsValue("data"));
        })
    });

    instance.querySelectorAll(".mode input").forEach(function(modeState) {
        modeState.addEventListener("change", function() {
            mode = document.querySelector(".mode input:checked").value;

            Module.setMode(id, ["off", "ramWrite", "cpuRun"].indexOf(mode));
            Module.loop();

            if (mode == "ramWrite") {
                document.querySelector(".mode input[value='off']").checked = true;
                mode = "off";

                Module.setMode(id, 0);
            }
        });
    });

    requestAnimationFrame(function render() {
        if (mode == "cpuRun" && Module.getCustomLed(id)) {
            instance.querySelector(".led.custom").classList.add("on");
        } else {
            instance.querySelector(".led.custom").classList.remove("on");
        }

        requestAnimationFrame(render);
    });

    document.querySelector("#instances").append(instance);
    document.querySelector("#applyInstances").append(createInstanceApplyCheckbox(id));
}

function applyProperties(id) {
    var instance = document.getElementById(`instance${id}`);

    instance.hidden = !document.querySelector("#showInstance").checked;
}

Module.onRuntimeInitialized = function() {
    console.log("Runtime initialised");

    Module.setup();

    for (var i = 0; i < INSTANCES; i++) {
        createInstance(i);
    }

    document.querySelector("#applyButton").addEventListener("click", function() {
        for (var i = 0; i < INSTANCES; i++) {
            if (document.getElementById(`applyInstance${i}`).checked) {
                applyProperties(i);
            }
        }
    });

    requestAnimationFrame(function render() {
        Module.loop();

        requestAnimationFrame(render);
    });
};