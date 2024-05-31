import { eventSource, event_types, saveChatConditional, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
export { MODULE_NAME };

const EXTENSION_NAME = "SillyTavern-State";
const EXTENSION_FOLDER_PATH = `scripts/extensions/third-party/${EXTENSION_NAME}`;
const MODULE_NAME = 'State';
const DEBUG_PREFIX = "<State extension> ";

let CHAR_ID = null;
let IS_CAN_GEN = false;
let IS_GENERATING = false;

String.prototype.hashCode = function() {
    var hash = 0,
      i, chr;
    if (this.length === 0) return hash;
    for (i = 0; i < this.length; i++) {
      chr = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
  
//#############################//
//  Extension UI and Settings  //
//#############################//
function loadSettings() {
    const charId = SillyTavern.getContext().characterId;
    const charName = SillyTavern.getContext().characters[charId].name;
    CHAR_ID = `${charName}(${charId})`;

    IS_CAN_GEN = false;
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
    const btns = $(`<span id="sp_container" style="z-index: 99999; /*background: red;*/ position:fixed; bottom: 0; margin-bottom: 5vh; margin-left: 0.5vh;"></span>`)

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
    console.log(DEBUG_PREFIX, 'LOADED', chatSettings)
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
    const elBtn = $(`<a title="${escapeHtml(value)}" class="api_button menu_button" style="width: fit-content; padding: 0px; margin: 0px;">${vlCount}-${value[0].toUpperCase()}</a>`);
    const divBtn = $(`<div style="border: 1px black solid; border-radius: 4px;"><br></div>`);
    divBtn.append(elBtn);
    elBtn.on('click', () => {
        console.log(DEBUG_PREFIX, 'CLICKED', prmpt);
        IS_CAN_GEN = true;
        sendPrompt(prmpt, k);
    });
    return divBtn;
}

async function onEnabledClick(chatSettings) {
    chatSettings.enabled = $('#state_enabled').is(':checked');
    saveSettingsDebounced();
}

async function savePrompt(chatSettings) {
    console.log(DEBUG_PREFIX, 'SAVE PROMPT', chatSettings);
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
            prompts[k].template = value;
        }
    }
    const checks = $('.state-issmall-check').toArray();
    for (var k in checks) {
        const value = checks[k].checked;
        if (value) {
            prompts[k].isSmall = value;
        }
    }
    const deletes = $('.state-isdelete-check').toArray();
    for (var k in deletes) {
        const value = deletes[k].checked;
        if (value) {
            prompts[k].isDelete = value;
        }
    }

    chatSettings.prompts = prompts;
    console.log(DEBUG_PREFIX, 'SAVED', chatSettings);
    saveSettingsDebounced();
}

function escapeHtml(unsafe) {
    return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

async function onAddNew(li, btns, chatSettings, prmpt = {prompt: "", template: "{{state}}", isSmall: true, isDelete: false}) {
    console.log(DEBUG_PREFIX, 'ADD NEW', prmpt);
    const els = li.children()?.length || 0;
    const prmptTitle = "Prompt sent to probe the current state";
    const templTitle = "Template of the message that will be added. The placeholder {{state}} will be replaced with the Ai's response.";
    const smallTitle = 'If checked, the reply to the sent prompt will be added as a "small system message" instead of a full chat message.';

    const promptArea = $(`<textarea class="state-prompt-area" placeholder="(${prmptTitle})" title="${prmptTitle.replace("\"","")}" class="text_pole widthUnset flex1" rows="2">${prmpt.prompt}</textarea>`);
    const templateArea = $(`<textarea class="state-template-area" placeholder="(${templTitle})" title="${templTitle.replace("\"","")}" class="text_pole widthUnset flex1" rows="2">${prmpt.template}</textarea>`);
    const smallCheck = $(`<input type="checkbox" class="state-issmall-check" title="${smallTitle.replace("\"","")}" name="is_small${els}" ${prmpt.isSmall ? "checked" : ""}/>`);
    const smallCheckLbl = $(`<label class="checkbox_label" for="is_small${els}"><small>Is Small Reply?</small></label>`);
    const deleteCheck = $(`<input type="checkbox" class="state-isdelete-check" title="${smallTitle.replace("\"","")}" name="is_delete${els}" ${prmpt.isDelete ? "checked" : ""}/>`);
    const deleteCheckLbl = $(`<label title="If checked, keep only the latest reply to this prompt, removing past replies." class="checkbox_label" for="is_delete${els}"><small>Keep only one?</small></label>`);

    const rmvBtn = $(`<div class="menu_button menu_button_icon fa-solid fa-trash-can redWarningBG" title="Remove"></div>`);
    const liEl = $(`<li style="width: 100%; border: 1px grey solid; border-radius: 2px; margin-botom: 2px;" ></li>`)

    smallCheck.prop('checked', prmpt.isSmall);
    smallCheck.attr('checked', prmpt.isSmall);
    deleteCheck.prop('checked', prmpt.isDelete);
    deleteCheck.attr('checked', prmpt.isDelete);

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
    deleteCheck.on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    rmvBtn.on('click', () => {
        liEl.remove();
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });

    liEl.append(promptArea);
    liEl.append(templateArea);
    smallCheckLbl.append(smallCheck);
    liEl.append(smallCheckLbl);
    deleteCheckLbl.append(deleteCheck);
    liEl.append(deleteCheckLbl);
    liEl.append(rmvBtn);
    li.append(liEl);
}

async function processStateText() {
    console.debug(DEBUG_PREFIX, 'processStateText', CHAR_ID, IS_CAN_GEN, IS_GENERATING);
    if (!IS_CAN_GEN) {
        return;
    }

    if (!CHAR_ID || !extension_settings[MODULE_NAME][CHAR_ID].enabled){
        return;
    }

    IS_CAN_GEN = false;

    try {
        const prompts = extension_settings[MODULE_NAME][CHAR_ID].prompts;
        for (var k in prompts) {
            const prmpt = prompts[k];
            await sendPrompt(prmpt, k);
        }
    } catch (error) {
        toastr.error("State extension: Error during generation.");
        console.error(DEBUG_PREFIX, error);
    }
    IS_GENERATING = false;
}

async function sendPrompt(prmpt, k) {
    console.log(DEBUG_PREFIX, 'sendPrompt', prmpt, k);
    if (prmpt && prmpt.prompt) {
        const id = `System(${k})`;
        const template = prmpt.template;
        const value = prmpt.prompt;

        toastr.info(`State Extension. Sending Prompt : ${value}`);
        console.log(`State Extension. Sending Prompt : ${value} / Template : ${template} / IsSmal : ${prmpt.isSmall}`);


        var resp = await getContext().generateQuietPrompt(value);
        if (template) {
            resp = template.replace('{{state}}', resp);
            console.log(DEBUG_PREFIX, 'sendPrompt apply template', resp);
        }
        const message = { "name": id, "is_user": false, "is_system": false, "send_date": new Date().toString(), "mes": resp, "extra": { "isSmallSys": prmpt.isSmall } };
        console.log(DEBUG_PREFIX, 'Adding Message', message);

        
        // if(prmpt.isDelete){
        //     await removeOldMessage(id);
        // }
        getContext().chat.push(message);
        getContext().addOneMessage(message);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (getContext().chat.length - 1));
        await saveChatConditional();
    }
}

async function removeOldMessage(id) {
    console.log(DEBUG_PREFIX, 'REMOVING : ', id);

    getContext().chat = removeObjectFromArray(getContext().chat, "name", id);
    console.log(DEBUG_PREFIX, 'OLD REMOVED MESSAGE', getContext().chat);
    // eventSource.emit(event_types.MESSAGE_DELETED, getContext().chat.length);

    const mes = $(`#chat .mes[ch_name="${id}"]`).first();
    if(mes.length){
        mes.removeClass('mes');
        mes.css('display', 'none');
        mes.attr('ch_name', '');
        mes.prop('ch_name', '');
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

    //IS_CAN_GEN is used to ensure that the prompts won't be triggered when changing chats or characters, since that somehow triggers the MESSAGE_RECEIVED event, which is odd in my opnion
    eventSource.on(event_types.GENERATION_ENDED, () => { IS_CAN_GEN = true });
    eventSource.on(event_types.GENERATION_STOPPED, () => { IS_CAN_GEN = true });
    eventSource.on(event_types.MESSAGE_DELETED, () => { setTimeout(loadSettings, 1000) });
    eventSource.on(event_types.CHAT_CHANGED, () => { setTimeout(loadSettings, 1000) });
    eventSource.on(event_types.MESSAGE_RECEIVED, () => { setTimeout(() => { processStateText() }, 500); });
});