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
    const btns = $(`<div id="sp_container" style="z-index: 99999; /*background: red;*/ position:fixed; bottom: 0; margin-bottom: 5vh; margin-left: 1vh;"></div>`)

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
    console.log(DEBUG_PREFIX, 'Updating prompt btns.')
    btns.empty();
    const statePrompts = chatSettings.prompts;
    for (var k in statePrompts) {
        const value = statePrompts[k];
        const divBtn = getBtn(k, value);
        btns.append(divBtn);
    }
}

function getBtn(k, value) {
    const vlCount = parseInt(k)+1;
    const elBtn = $(`<a title="${value}" style="text-shadow: rgb(0, 0, 0) 0px 0px 2px; box-sizing: border-box; color: rgb(255, 255, 255); color-scheme: light only; cursor: pointer; font-family: "Noto Sans", "Noto Color Emoji", sans-serif; font-size: 16.5px; font-weight: 400; vertical-align: middle;">${vlCount}-${value[0].toUpperCase()}</a>`);
    const divBtn = $(`<div style="border: 1px black solid; border-radius: 4px;"><br></div>`);
    divBtn.append(elBtn);
    elBtn.on('click', () => {
        console.log(DEBUG_PREFIX, 'CLICKED', value);
        sendPrompt(value, k);
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
            prompts[k] = value;
        }
    }

    chatSettings.prompts = prompts;
    saveSettingsDebounced();
}

async function onAddNew(li, btns, chatSettings, value = '') {
    const promptArea = $(`<textarea class="state-prompt-area" placeholder="(Prompt sent to probe the current state)" class="text_pole widthUnset flex1" rows="2">${value}</textarea>`);
    const rmvBtn = $(`<div class="menu_button menu_button_icon fa-solid fa-trash-can redWarningBG" title="Remove"></div>`);
    const liEl = $(`<li style="width: 100%;"></li>`)

    promptArea.on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    rmvBtn.on('click', () => {
        liEl.remove();
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
        saveSettingsDebounced();
    });

    liEl.append(promptArea);
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
        toastr.error("State extension: Error during generation.", error);
    }
    IS_GENERATING = false;
}

async function sendPrompt(prmpt, k) {
    if (prmpt) {
        toastr.info(`State Extension. Sending prompt : ${prmpt}`);

        const chat = getContext().chat;
        const id = `State prompt ${k}`;

        // await removeObjectFromChat(chat, id);

        const resp = await getContext().generateQuietPrompt(prmpt);
        const message = { "name": "System", "is_user": false, "is_system": false, "state_extension_id": id, "send_date": new Date().toString(), "mes": resp, "extra": { "isSmallSys": true } };
        console.log(DEBUG_PREFIX, 'Adding Message', message);

        chat.push(message);
        getContext().addOneMessage(message);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }
}

async function removeObjectFromChat(chat, id) {
    removeObjectFromArray(chat, "state_extension_id", id);
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
    await saveChatConditional();
}

function removeObjectFromArray(array, key, value) {
    const index = array.findIndex(obj => obj[key] === value);
    if (index == -1) {
        return array;
    }
    array.splice(index, 1);
    return removeObjectFromArray(array, key, value);
}

async function getDate(now) {
    // Define an array of month names
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Extract the components of the date
    const month = monthNames[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    let hour = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hour >= 12 ? 'pm' : 'am';

    // Convert the hour to 12-hour format
    hour = hour % 12;
    hour = hour ? hour : 12; // the hour '0' should be '12'

    // Format the minutes to always be two digits
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    // Construct the formatted date string
    const formattedDate = `${month} ${day}, ${year} ${hour}:${formattedMinutes}${ampm}`;

    // Output the formatted date
    return formattedDate;
}

//#############################//
//  Extension load             //
//#############################//
jQuery(async () => {
    console.log(DEBUG_PREFIX, 'loading', extension_settings[MODULE_NAME]);
    const windowHtml = $(await $.get(`${EXTENSION_FOLDER_PATH}/window.html`));
    $('#extensions_settings').append(windowHtml);
    
    eventSource.on(event_types.CHAT_CHANGED, loadSettings);
    eventSource.on(event_types.MESSAGE_SENT, ()=>{IS_LOADING = true});
    eventSource.on(event_types.GENERATION_ENDED, ()=>{IS_LOADING = false});
    eventSource.on(event_types.MESSAGE_RECEIVED, processStateText);
});