import { Generate, eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
export { MODULE_NAME };

const extensionName = "SillyTavern-State";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const MODULE_NAME = 'State';
const DEBUG_PREFIX = "<State extension> ";

//#############################//
//  Extension UI and Settings  //
//#############################//
function loadSettings(chatId) {
    console.log(DEBUG_PREFIX, `Loading ${chatId}`);

    if (!extension_settings[MODULE_NAME][chatId]) {
        extension_settings[MODULE_NAME][chatId] = {
            enabled: false,
            prompts: [],
        };
    }

    const li = $('#state-prompt-set');
    const se = $("state_enabled");
    const add = $("#sp--set-new");

    if (!chatId) {
        //clear on load
        li.html('');
        se.prop('checked', false);
        return;
    }
    
    se.prop('checked', extension_settings[MODULE_NAME][chatId].enabled);
    se.on("click", () => { onEnabledClick(chatId) });
    add.on("click", () => { onAddNew(li, chatId); });
    
    console.log(DEBUG_PREFIX, 'AAAAAAAAAAAAAAAAA', MODULE_NAME, chatId, extension_settings[MODULE_NAME][chatId]);
    const prompts = extension_settings[MODULE_NAME][chatId].prompts;
    for(var k in prompts){
        onAddNew(li, prompts[k]);
    }
}

async function onEnabledClick(chatId) {
    extension_settings[MODULE_NAME][chatId].enabled = $('state_enabled').is(':checked');
    saveSettingsDebounced();
}

async function savePrompt(chatId) {
    const prompts = [];
    const values = $('.state-prompt-area').toArray();
    for(var k in values){
        const value = values[k].value.trim();
        console.log(DEBUG_PREFIX, 'VALUE', value, values[k]);
        if(value){
            prompts[k] = value;
        }
    }
    extension_settings[MODULE_NAME][chatId].prompts = prompts;
    saveSettingsDebounced();

    console.log(DEBUG_PREFIX, `Saved ${extension_settings[MODULE_NAME][chatId].prompts}`);
}

async function onAddNew(li, chatId, value = '') {
    const count = li.children().length;
    li.append(`<li style="width: 100%;"><textarea id="${count}-state-area" class="state-prompt-area" placeholder="(Prompt sent to probe the current state)" class="text_pole widthUnset flex1" rows="2">${value}</textarea><div class="menu_button menu_button_icon fa-solid fa-trash-can redWarningBG" title="Remove"></div></li>`);
    $(`#${count}-state-area`).on('change', () => { savePrompt(chatId) });

    console.log(DEBUG_PREFIX, `Added, {count} {value}`);
}

async function processStateText(chat_id) {
    if (!chat_id || !extension_settings[MODULE_NAME][chatId].enabled)
        return;

    const context = getContext();

    // group mode not compatible
    if (context.groupId != null) {
        console.debug(DEBUG_PREFIX, "Group mode detected, not compatible, abort State.");
        //toastr.warning("Not compatible with group mode.", DEBUG_PREFIX + " disabled", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    console.debug(DEBUG_PREFIX, extension_settings[MODULE_NAME][chatId]);

    const expected = extension_settings[MODULE_NAME][chatId].expected
    let last_message = getContext().chat[chat_id].mes;

    console.debug(DEBUG_PREFIX, "Message received:", last_message);

    if (expected == "") {
        console.debug(DEBUG_PREFIX, "expected is empty, nothing to State");
        return;
    }

    if (last_message.includes(expected)) {
        console.debug(DEBUG_PREFIX, "expected text found, nothing to do.");
        return;
    }

    if (enforcing == last_message) {
        console.debug(DEBUG_PREFIX, "Already attempted to State, nothing to do");
        enforcing = "";
        return;
    }

    console.debug(DEBUG_PREFIX, "expected text not found injecting prefix and calling continue");
    enforcing = last_message + extension_settings[MODULE_NAME][chatId].continue_prefix
    getContext().chat[chat_id].mes = enforcing;
    //$("#option_continue").trigger('click'); // To allow catch by blip extension
    await Generate("continue");
}

//#############################//
//  Extension load             //
//#############################//
jQuery(async () => {
    console.log(DEBUG_PREFIX, 'loading', extension_settings[MODULE_NAME]);

    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));
    $('#extensions_settings').append(windowHtml);

    eventSource.on(event_types.CHAT_CHANGED, (chat_id) => loadSettings(chat_id));
    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => processStateText(chat_id));
});