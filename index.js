import { eventSource, event_types, saveSettingsDebounced, saveChatConditional } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
export { MODULE_NAME };

const extensionName = "SillyTavern-State";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const MODULE_NAME = 'State';
const DEBUG_PREFIX = "<State extension> ";
let CHAT_ID = null;

//#############################//
//  Extension UI and Settings  //
//#############################//
function loadSettings(chatId) {
    console.log(DEBUG_PREFIX, `Loading ${chatId}`);
    
    const li = $('#state-prompt-set');
    const se = $("#state_enabled");
    const add = $("#sp--set-new");
    const lbl = $('#state_label_current_chat');

    //clear on load
    li.html('');
    se.prop('checked', false);
    lbl.empty();

    if (!extension_settings[MODULE_NAME][chatId]) {
        extension_settings[MODULE_NAME][chatId] = {
            enabled: false,
            prompts: [],
        };
    }

    if (!chatId) {
        return;
    }

    CHAT_ID = chatId;

    se.prop('checked', extension_settings[MODULE_NAME][chatId].enabled);
    se.on("click", () => { onEnabledClick(chatId) });
    add.on("click", () => { onAddNew(li, chatId); });
    lbl.text(`Prompts for chat "${chatId}"`);

    const prompts = extension_settings[MODULE_NAME][chatId].prompts;
    for (var k in prompts) {
        onAddNew(li, chatId, prompts[k]);
    }
}

async function onEnabledClick(chatId) {
    extension_settings[MODULE_NAME][chatId].enabled = $('#state_enabled').is(':checked');
    saveSettingsDebounced();
}

async function savePrompt(chatId) {
    const prompts = [];
    const values = $('.state-prompt-area').toArray();
    for (var k in values) {
        const value = values[k].value.trim();
        if (value) {
            prompts[k] = value;
        }
    }

    extension_settings[MODULE_NAME][chatId].prompts = prompts;
    saveSettingsDebounced();
}

async function removePrompt(elId) {
    $(elId).remove();
    saveSettingsDebounced();
}

async function onAddNew(li, chatId, value = '') {
    const count = li.children().length;
    li.append(`<li id="${count}-state-area-li" style="width: 100%;"><textarea id="${count}-state-area" class="state-prompt-area" placeholder="(Prompt sent to probe the current state)" class="text_pole widthUnset flex1" rows="2">${value}</textarea><div id="${count}-state-area-remove" class="menu_button menu_button_icon fa-solid fa-trash-can redWarningBG" title="Remove"></div></li>`);

    $(`#${count}-state-area`).on('change', () => { savePrompt(chatId); });
    $(`#${count}-state-area-remove`).on('click', () => { removePrompt(`#${count}-state-area-li`); });
}

async function processStateText() {
    const chatId = CHAT_ID;
    console.debug(DEBUG_PREFIX, 'processStateText', chatId);

    if (!chatId || !extension_settings[MODULE_NAME][chatId].enabled)
        return;

    try {
        const context = getContext();
        const prompts = extension_settings[MODULE_NAME][chatId].prompts;
        const chat = getContext().chat;
        for (var k in prompts) {
            const prmpt = prompts[k];
            if (prmpt) {
                toastr.info(`State Extension. Sending prompt : ${prmpt}`);

                const id = `State prompt ${k}`;
                // removeObjectFromArray(chat, "state_extension_id", id);

                const resp = await context.generateQuietPrompt(prmpt);
                const message = { "name": "System", "is_user": false, "is_system": false, "state_extension_id": id, "send_date": new Date().toString(), "mes": resp, "extra": { "isSmallSys": true } };
                console.log(DEBUG_PREFIX, 'Adding Message', message);
                chat.push(message);
                context.addOneMessage(message);
                await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
                await saveChatConditional();
            }
        }
    } catch (error) {
        toastr.error("State extension: Error during generation.", error);
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

    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));
    $('#extensions_settings').append(windowHtml);

    eventSource.on(event_types.CHAT_CHANGED, (chatId) => loadSettings(chatId));
    eventSource.on(event_types.MESSAGE_RECEIVED, processStateText);
});