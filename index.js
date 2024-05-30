import { eventSource, event_types, saveChatConditional, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
export { MODULE_NAME };

const EXTENSION_NAME = "SillyTavern-State";
const EXTENSION_FOLDER_PATH = `scripts/extensions/third-party/${EXTENSION_NAME}`;
const MODULE_NAME = 'State';
const DEBUG_PREFIX = "<State extension> ";

let CHAR_ID = null;
let IS_LOADING = true;
let IS_GENERATING = false;

//#############################//
//  Extension UI and Settings  //
//#############################//
function loadSettings() {
    const charId = SillyTavern.getContext().characterId;
    const charName = SillyTavern.getContext().characters[charId].name;
    CHAR_ID = `${charName}(${charId})`;

    IS_LOADING = true;
    console.log(DEBUG_PREFIX, `Loading ${CHAR_ID}`);

    const li = $('#state-prompt-set');
    const se = $("#state_enabled");
    const add = $("#sp--set-new");
    const lbl = $('#state_label_current_chat');

    //clear on load
    li.html('');
    se.prop('checked', false);
    lbl.empty();
    if (!extension_settings[MODULE_NAME][CHAR_ID]) {
        extension_settings[MODULE_NAME][CHAR_ID] = {
            enabled: false,
            prompts: [],
        };
    }

    if (!CHAR_ID) {
        return;
    }

    const chatSettings = extension_settings[MODULE_NAME][CHAR_ID];
    const btns = $(`<div id="sp_container" style="z-index: 99999; /*background: red;*/ position:fixed; bottom: 0; margin-bottom: 5vh; margin-left: 0.5vh;"></div>`)

    $('#chat').append(btns);
    se.prop('checked', chatSettings.enabled);
    se.on("click", () => { onEnabledClick(chatSettings) });
    add.on("click", () => { onAddNew(li, btns, chatSettings); updatePromptButtons(btns, chatSettings); });
    lbl.text(`Prompts for character "${CHAR_ID}"`);

    const prompts = chatSettings.prompts;
    for (var k in prompts) {
        onAddNew(li, btns, chatSettings, prompts[k]);
    }

    updatePromptButtons(btns, chatSettings);
}

function updatePromptButtons(btns, chatSettings) {
    btns.empty();
    const statePrompts = chatSettings.prompts;
    console.log(DEBUG_PREFIX, 'Updating prompt btns.', statePrompts)
    for (var k in statePrompts) {
        const prmpt = statePrompts[k];
        if (prmpt && prmpt.prompt) {
            const divBtn = getBtn(k, prmpt);
            btns.append(divBtn);
        }
    }
}

function getBtn(k, prmpt) {
    const value = prmpt.prompt;
    const vlCount = parseInt(k) + 1;
    const elBtn = $(`<a title="${value}" style="text-shadow: rgb(0, 0, 0) 0px 0px 2px; box-sizing: border-box; color: rgb(255, 255, 255); color-scheme: light only; cursor: pointer; font-family: "Noto Sans", "Noto Color Emoji", sans-serif; font-size: 16.5px; font-weight: 400; vertical-align: middle;">${vlCount}-${value[0].toUpperCase()}</a>`);
    const divBtn = $(`<div style="border: 1px black solid; border-radius: 4px;"><br></div>`);
    divBtn.append(elBtn);
    elBtn.on('click', () => {
        console.log(DEBUG_PREFIX, 'CLICKED', prmpt);
        IS_LOADING = false;
        sendPrompt(prompt, k);
    });
    return divBtn;
}

async function onEnabledClick(chatSettings) {
    chatSettings.enabled = $('#state_enabled').is(':checked');
    saveSettingsDebounced();
}

async function savePrompt(chatSettings) {
    const prompts = [];

    const values = $('.state-prompt-area').toArray();
    for (var k in values) {
        const value = values[k].value.trim();
        if (value) {
            if (!prompts[k]) {
                prompts[k] = {};
            }
            prompts[k].prompt = value;
        }
    }
    const templates = $('.state-template-area').toArray();
    for (var k in templates) {
        const value = templates[k].value.trim();
        if (value) {
            if (!prompts[k]) {
                prompts[k] = {};
            }
            prompts[k].template = value;
        }
    }
    const checks = $('.state-issmall-check').toArray();
    for (var k in checks) {
        const value = checks[k].checked;
        if (value) {
            if (!checks[k]) {
                checks[k] = {};
            }
            checks[k].isSmall = value;
        }
    }

    chatSettings.prompts = prompts;
    saveSettingsDebounced();
}

async function onAddNew(li, btns, chatSettings, prmpt = {}) {
    const els = li.children()?.length || 0;
    const prmptTitle = "Prompt sent to probe the current state";
    const templTitle = "Template of the message that will be added. The placeholder \${response} will be replaced with the Ai's response.";
    const smallTitle = "If checked, the reply to the sent prompt will be added as a \"small system message\" instead of a full chat message."

    const promptArea = $(`<textarea class="state-prompt-area" placeholder="(${prmptTitle})" title="${prmptTitle}" class="text_pole widthUnset flex1" rows="2">${prmpt.prompt || ""}</textarea>`);
    const templateArea = $(`<textarea class="state-template-area" placeholder="(${templTitle})" title="${templTitle}" class="text_pole widthUnset flex1" rows="2">${prmpt.template || "${response}"}</textarea>`);
    const smallCheck = $(`<label class="checkbox_label" for="is_small${els}"><small>Is Small Reply?</small><input type="checkbox" class="state-issmall-check" title="${smallTitle}" name="is_small${els}" checked="true"/></label>`);


    const rmvBtn = $(`<div class="menu_button menu_button_icon fa-solid fa-trash-can redWarningBG" style="" title="Remove"></div>`);
    const liEl = $(`<li style="width: 100%;"></li>`)

    smallCheck.prop('checked', prmpt.isSmall || true);

    promptArea.on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    templateArea.on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    smallCheck.on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    rmvBtn.on('click', () => {
        liEl.remove();
        savePrompt(chatSettings);
        saveSettingsDebounced();
        updatePromptButtons(btns, chatSettings);
    });

    liEl.append(promptArea);
    liEl.append(templateArea);
    liEl.append(smallCheck);
    liEl.append(rmvBtn);
    li.append(liEl);
}

async function processStateText() {
    console.debug(DEBUG_PREFIX, 'processStateText', CHAR_ID, IS_LOADING, IS_GENERATING);
    if (IS_LOADING) {
        return;
    }

    if (IS_GENERATING) {
        toastr.error("Generation already in process.");
        return;
    }

    IS_GENERATING = true;

    if (!CHAR_ID || !extension_settings[MODULE_NAME][CHAR_ID].enabled)
        return;

    try {
        const prompts = extension_settings[MODULE_NAME][CHAR_ID].prompts;
        for (var k in prompts) {
            const prmpt = prompts[k];
            await sendPrompt(prmpt, k);
        }
    } catch (error) {
        toastr.error("State extension: Error during generation.");
        console.log(DEBUG_PREFIX, error);
    }
    IS_GENERATING = false;
}

async function sendPrompt(prmpt, k) {
    if (prmpt && prmpt.prompt) {
        const chat = getContext().chat;
        const id = `State prompt ${k}`;
        const template = prmpt.template;
        var value = prmpt.prompt;

        toastr.info(`State Extension. Sending Prompt : ${value}`);
        console.log(`State Extension. Sending Prompt : ${value} / Template : ${template} / IsSmal : ${prmpt.isSmall}`);

        // removeObjectFromArray(chat, "state_extension_id", id);
        // await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
        // await saveChatConditional();

        if (template) {
            value = template.replace('${response}', value);
        }

        const resp = await getContext().generateQuietPrompt(value);
        const message = { "name": "System", "is_user": false, "is_system": false, "state_extension_id": id, "send_date": new Date().toString(), "mes": resp, "extra": { "isSmallSys": prmpt.isSmall } };
        console.log(DEBUG_PREFIX, 'Adding Message', message);

        chat.push(message);
        getContext().addOneMessage(message);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }
}

function removeObjectFromArray(array, key, value) {
    const index = array.findIndex(obj => obj[key] === value);
    if (index == -1) {
        return array;
    }
    array.splice(index, 1);
    return removeObjectFromArray(array, key, value);
}

//#############################//
//  Extension load             //
//#############################//
jQuery(async () => {
    console.log(DEBUG_PREFIX, 'loading', extension_settings[MODULE_NAME]);
    const windowHtml = $(await $.get(`${EXTENSION_FOLDER_PATH}/window.html`));
    $('#extensions_settings').append(windowHtml);

    eventSource.on(event_types.MESSAGE_SENT, () => { IS_LOADING = true });
    eventSource.on(event_types.MESSAGE_SWIPED, () => { IS_LOADING = true });
    eventSource.on(event_types.GENERATION_STARTED, () => { IS_LOADING = true });
    eventSource.on(event_types.GENERATION_ENDED, () => { IS_LOADING = false });
    eventSource.on(event_types.CHAT_CHANGED, () => { setTimeout(loadSettings, 1000) });
    eventSource.on(event_types.MESSAGE_RECEIVED, () => { setTimeout(() => { processStateText() }, 500); });
});