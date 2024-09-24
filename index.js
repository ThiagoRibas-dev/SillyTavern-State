import { eventSource, event_types, saveChatConditional, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
export { MODULE_NAME };

const EXTENSION_NAME = "SillyTavern-State";
const EXTENSION_FOLDER_PATH = `scripts/extensions/third-party/${EXTENSION_NAME}`;
const MODULE_NAME = 'State';
const DEBUG_PREFIX = "<State extension> ";

let CHAR_ID = null;
let IS_CAN_GEN = false;

String.prototype.hashCode = function () {
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
    IS_CAN_GEN = false;
    const charId = getContext().characterId;
    const charName = getContext().characters[charId].name;
    const createDate = getContext().characters[charId].create_date
    CHAR_ID = `${charName}-${createDate}`;
    
    console.log(DEBUG_PREFIX, 'MODULE_NAME', extension_settings, MODULE_NAME, CHAR_ID)
    console.log(DEBUG_PREFIX, `Loading ${CHAR_ID}`);

    const li = $('#state-prompt-set');
    const se = $(".state_enabled");
    const add = $("#sp--set-new");
    const lbl = $('#state_label_current_chat');

    //clear on load
    li.html('');
    se.prop('checked', false);
    lbl.empty();
    $('#sp_container').remove();

    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {}
    }

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

    $('#sheld').append(btns);
    se.prop('checked', chatSettings.enabled);
    se.unbind().on("click", (ev) => { clickIsEnabled(ev, chatSettings); });
    add.unbind().on("click", () => { onAddNew(li, btns, chatSettings); updatePromptButtons(btns, chatSettings); });
    lbl.text(`Prompts for character "${charName}"`);

    const prompts = chatSettings.prompts;
    for (var k in prompts) {
        onAddNew(li, btns, chatSettings, prompts[k]);
    }

    updatePromptButtons(btns, chatSettings);
    console.log(DEBUG_PREFIX, 'LOADED', chatSettings);
    setCollapsable();
    IS_CAN_GEN = true;
}

function clickIsEnabled(ev, chatSettings) {
    const se = $(".state_enabled");
    se.attr('checked', ev.target.checked);
    se.prop('checked', ev.target.checked);
    onEnabledClick(chatSettings);
}

function updatePromptButtons(btns, chatSettings) {
    btns.empty();
    const statePrompts = chatSettings.prompts;
    console.log(DEBUG_PREFIX, 'Updating prompt btns.', statePrompts)
    if (statePrompts.length == 0) {
        return;
    }

    btns.append(getCheckEnable());
    btns.append(getBtnAll());
    for (var k in statePrompts) {
        const prmpt = statePrompts[k];
        if (prmpt && prmpt.prompt) {
            const divBtn = getBtn(k, prmpt);
            btns.append(divBtn);
        }
    }
}

function getCheckEnable() {
    const chatSettings = extension_settings[MODULE_NAME][CHAR_ID];
    const se = $(".state_enabled").first().clone();
    se.unbind().on("click", (ev) => { clickIsEnabled(ev, chatSettings); });
    return se;
}

function getBtnAll() {
    const elBtn = $(`<a title="Trigger all state prompts, in order." class="api_button menu_button" style="width: fit-content; padding: 0px; margin: 0px;">All</a>`);
    const divBtn = $(`<div style="border: 1px black solid; border-radius: 4px;"><br></div>`);
    divBtn.append(elBtn);
    elBtn.unbind().on('click', async () => {
        console.log(DEBUG_PREFIX, 'CLICKED ALL');
        await processStateText();
    });
    return divBtn;
}

function getBtn(k, prmpt) {
    const value = prmpt.prompt;
    const vlCount = parseInt(k) + 1;
    const elBtn = $(`<a title="${escapeHtml(value)}" class="api_button menu_button" style="width: fit-content; padding: 0px; margin: 0px;">${vlCount}-${value[0].toUpperCase()}</a>`);
    const divBtn = $(`<div style="border: 1px black solid; border-radius: 4px;"><br></div>`);
    divBtn.append(elBtn);
    elBtn.unbind().on('click', async () => {
        console.log(DEBUG_PREFIX, 'CLICKED', k, prmpt);
        IS_CAN_GEN = false;
        const originalChatJson = JSON.stringify(getContext().chat);
        try {
            await sendPrompt(prmpt, k);
        } catch (error) {
            toastr.error("State extension: Error during generation.");
            console.error(DEBUG_PREFIX, 'ERROR DURING GENERATION, ABORTING AND REVERTING', error, originalChatJson);
            if (originalChatJson) {
                getContext().chat = JSON.parse(originalChatJson);//reverts the chat array to its original state
                setLastMesClass();
            }
        }

        IS_CAN_GEN = true;
        setCollapsable();
    });
    return divBtn;
}

async function onEnabledClick(chatSettings) {
    chatSettings.enabled = $('.state_enabled').is(':checked');
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
        if (k < prompts.length && value) {
            prompts[k].template = value;
        }
    }
    const checks = $('.state-issmall-check').toArray();
    for (var k in checks) {
        const value = checks[k].checked;
        if (k < prompts.length && value) {
            prompts[k].isSmall = value;
        }
    }
    const deletes = $('.state-isdelete-check').toArray();
    for (var k in deletes) {
        const value = deletes[k].checked;
        if (k < prompts.length && value) {
            prompts[k].isDelete = value;
        }
    }
    const collapsed = $('.state-iscollapsed-check').toArray();
    for (var k in collapsed) {
        const value = collapsed[k].checked;
        if (k < prompts.length && value) {
            prompts[k].isCollapsed = value;
        }
    }

    chatSettings.prompts = prompts;
    console.log(DEBUG_PREFIX, 'SAVED', chatSettings);
    saveSettingsDebounced();
}

function escapeHtml(unsafe) {
    return unsafe.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

async function onAddNew(li, btns, chatSettings, prmpt = { prompt: "", template: "{{state}}", isSmall: true, isDelete: true, isCollapsed: true }) {
    console.log(DEBUG_PREFIX, 'ADD NEW', prmpt);
    const els = li.children()?.length || 0;
    const prmptTitle = "Prompt sent to probe the current state";
    const templTitle = "Template of the message that will be added. The placeholder {{state}} will be replaced with the Ai's response.";
    const smallTitle = 'If checked, the reply to the sent prompt will be added as a "small system message" instead of a full chat message.';
    const deleteTitle = 'If checked, previous states will be removed from the chat before a new one is inserted. Useful to not have older, outdated information pulluting the chat.';
    const collapsedTitle = 'If checked, the state messages will be hidden/folded in order to make the chat more readable.';

    const promptArea = $(`<textarea class="state-prompt-area" placeholder="(${prmptTitle})" title="${prmptTitle.replace("\"", "")}" class="text_pole widthUnset flex1" rows="2">${prmpt.prompt}</textarea>`);
    const templateArea = $(`<textarea class="state-template-area" placeholder="(${templTitle})" title="${templTitle.replace("\"", "")}" class="text_pole widthUnset flex1" rows="2">${prmpt.template}</textarea>`);
    const smallCheck = $(`<input type="checkbox" class="state-issmall-check" title="${smallTitle.replace("\"", "")}" name="is_small${els}" ${prmpt.isSmall ? "checked" : ""}/>`);
    const smallCheckLbl = $(`<label class="checkbox_label" for="is_small${els}"><small>Is Small Reply?</small></label>`);
    const deleteCheck = $(`<input type="checkbox" class="state-isdelete-check" title="${deleteTitle.replace("\"", "")}" name="is_delete${els}" ${prmpt.isDelete ? "checked" : ""}/>`);
    const deleteCheckLbl = $(`<label title="${deleteTitle.replace("\"", "")}" for="is_delete${els}"><small>Exclusive state</small></label>`);

    const collapsedCheck = $(`<input type="checkbox" class="state-iscollapsed-check" title="${collapsedTitle.replace("\"", "")}" name="is_collapsed${els}" ${prmpt.isCollapsed ? "checked" : ""}/>`);
    const collapsedCheckLbl = $(`<label title="${collapsedTitle.replace("\"", "")}" class="checkbox_label" for="is_collapsed${els}"><small>Collapse State</small></label>`);

    const rmvBtn = $(`<div class="menu_button menu_button_icon fa-solid fa-trash-can redWarningBG" title="Remove"></div>`);
    const liEl = $(`<li style="width: 100%; border: 1px grey solid; border-radius: 2px; margin-botom: 2px;" ></li>`)

    smallCheck.prop('checked', prmpt.isSmall);
    smallCheck.attr('checked', prmpt.isSmall);
    deleteCheck.prop('checked', prmpt.isDelete);
    deleteCheck.attr('checked', prmpt.isDelete);
    collapsedCheck.prop('checked', prmpt.isCollapsed);
    collapsedCheck.attr('checked', prmpt.isCollapsed);

    promptArea.unbind().on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    templateArea.unbind().on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    smallCheck.unbind().on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    deleteCheck.unbind().on('change', () => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
    });
    collapsedCheck.unbind().on('change', (ev) => {
        savePrompt(chatSettings);
        updatePromptButtons(btns, chatSettings);
        $('div.mes.smallSysMes div.mes_block div.mes_text details').each((idx, el) => {
            const parent = el.parentElement?.parentElement?.parentElement;
            const name = parent.getAttribute('ch_name');
            if (name == `State ${els}`) {
                el.open = !ev.target.checked
            }
        });
    });
    rmvBtn.unbind().on('click', () => {
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

    collapsedCheckLbl.append(collapsedCheck);
    liEl.append(collapsedCheckLbl);

    liEl.append(rmvBtn);
    li.append(liEl);
}

async function processStateText() {
    console.debug(DEBUG_PREFIX, 'processStateText', CHAR_ID, IS_CAN_GEN);
    if (!IS_CAN_GEN) {
        return;
    }

    if (!CHAR_ID || !extension_settings[MODULE_NAME][CHAR_ID].enabled) {
        return;
    }

    IS_CAN_GEN = false;

    const originalChatJson = JSON.stringify(getContext().chat);
    try {
        const prompts = extension_settings[MODULE_NAME][CHAR_ID].prompts;
        for (var k in prompts) {
            const prmpt = prompts[k];
            await sendPrompt(prmpt, k);
        }
    } catch (error) {
        toastr.error("State extension: Error during generation.");
        console.error(DEBUG_PREFIX, 'ERROR DURING GENERATION, ABORTING AND REVERTING', error, originalChatJson);
        if (originalChatJson) {
            getContext().chat = JSON.parse(originalChatJson);//reverts the chat array to its original state
            setLastMesClass();
        }
    }

    IS_CAN_GEN = true;
    setCollapsable();
}

async function sendPrompt(prmpt, k) {
    console.log(DEBUG_PREFIX, 'sendPrompt', prmpt, k);
    if (prmpt && prmpt.prompt) {
        const id = `State ${k}`;
        const template = prmpt.template;
        const value = prmpt.prompt;

        toastr.info(`State Extension. Sending Prompt : ${value.slice(0, 50)}...`);
        console.log(`State Extension. Sending Prompt : ${value} / Template : ${template} / IsSmal : ${prmpt.isSmall}`);

        const generatedMessage = await generateRemoveOld(id, value);
        await addGeneratedMessage(template, generatedMessage, id, prmpt, k);
    }

    async function generateRemoveOld(id, value) {
        const generatedMessage = await getContext().generateQuietPrompt(value);
        var deletedIdx = [];
        if (prmpt.isDelete) {
            const originalChat = getContext().chat;
            deletedIdx = await deleteObjFromChatArr(id, originalChat);
        }
        if (deletedIdx.length > 0) {
            //remove the divs equivalent to the chat array objects that were removed earlier
            await deleteDivsFromChat(deletedIdx, id);
        }
        return generatedMessage;
    }
}

async function deleteDivsFromChat(deletedIdx, id) {
    for (var i in deletedIdx) {
        const idx = deletedIdx[i];
        $(`#chat .mes[mesid=${idx}]`).remove();
        console.log(DEBUG_PREFIX, 'DELETING : ', id, idx);
    }

    const chat = getContext().chat;
    const divs = $(`#chat .mes`).toArray().reverse();
    var lastIdx = chat.length - 1;
    //itterate over the messages displayed on screen in reverse order and update the mesid attribute based on the chat array size
    for (var j in divs) {
        const el = $(divs[j]);
        el.attr('mesid', lastIdx);
        console.log(DEBUG_PREFIX, 'CORRECTING : ', id, lastIdx);
        lastIdx = lastIdx - 1;
    }

    await saveChatConditional();
    eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
    setLastMesClass();
}

async function deleteObjFromChatArr(id, chat) {
    const deletedIdx = [];
    const newChat = [];
    for (var j in chat) {
        const message = chat[j];
        if (message.name == id) {
            deletedIdx.push(j);
            console.log(DEBUG_PREFIX, 'REMOVING : ', id, j);
        } else {
            newChat.push(message);
        }
    }

    if (deletedIdx.length > 0) {
        console.log(DEBUG_PREFIX, 'UPDATING NEW CHAT : ', id, chat.length, newChat.length);
        getContext().chat.splice(0, getContext().chat.length, ...newChat);
        await saveChatConditional();
    }
    return deletedIdx;
}

async function addGeneratedMessage(template, generatedMessage, id, prmpt, k) {
    if (template) {
        generatedMessage = template.replace('{{state}}', generatedMessage);
        console.log(DEBUG_PREFIX, 'sendPrompt apply template', generatedMessage);
    }
    const message = { "name": id, "is_user": false, "is_system": false, "send_date": new Date().toString(), "mes": generatedMessage, "extra": { "isSmallSys": prmpt.isSmall } };
    console.log(DEBUG_PREFIX, 'Adding Message', message);

    getContext().chat.push(message);
    getContext().addOneMessage(message);

    getContext().chat[getContext().chat.length - 1].state = { idx: k, state: generatedMessage };
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (getContext().chat.length - 1));
    await saveChatConditional();

    setLastMesClass();
    return generatedMessage;
}

function setCollapsable() {
    try {
        const prompts = extension_settings[MODULE_NAME][CHAR_ID].prompts;
        $('div.mes.smallSysMes div.mes_block div.mes_text').each((idx, el) => {
            const html = el.innerHTML;
            if (html.indexOf('<details') < 0) {
                const parent = el.parentElement?.parentElement;
                const name = parent.getAttribute('ch_name');

                var newHtml = `<details ${isCollapsed(name, prompts)} >`;
                if (name) {
                    newHtml += `<summary title="${escapeHtml(html)}">${name}</summary>`;
                }
                newHtml += html + '</details>';

                el.innerHTML = newHtml;
            }
        });
    } catch (error) {
        console.error(DEBUG_PREFIX, 'Error setting collapsables', error);
    }
}

function isCollapsed(name, prompts) {
    const id = name.replace('State ', '');
    if (id && prompts[id]) {
        return !prompts[id].isCollapsed ? ' open="true" ' : '';
    }
    return '';
}

function setLastMesClass() {
    $('#chat .mes').removeClass('last_mes');
    $('#chat .mes').last().addClass('last_mes');
}

//#############################//
//  Extension load             //
//#############################//
jQuery(async () => {
    console.log(DEBUG_PREFIX, 'loading', extension_settings[MODULE_NAME]);
    const windowHtml = $(await $.get(`${EXTENSION_FOLDER_PATH}/window.html`));
    $('#extensions_settings').append(windowHtml);

    var timeout;
    const loadSettingsTimeout = () => {
        clearTimeout(timeout);
        IS_CAN_GEN = false;
        timeout = setTimeout(loadSettings, 1000);
    }

    const genTimeout = () => {
        if (!IS_CAN_GEN) {
            return;
        }
        clearTimeout(timeout);
        timeout = setTimeout(processStateText, 500);
    }

    const canGenTrue = () => { IS_CAN_GEN = true };

    //IS_CAN_GEN is used to ensure that the prompts won't be triggered when changing chats or characters, since that somehow triggers the MESSAGE_RECEIVED event, which is odd in my opnion
    eventSource.on(event_types.GENERATION_ENDED, canGenTrue);
    eventSource.on(event_types.GENERATION_STOPPED, canGenTrue);
    eventSource.on(event_types.CHAT_CHANGED, loadSettingsTimeout);
    eventSource.on(event_types.MESSAGE_DELETED, loadSettingsTimeout);
    eventSource.on(event_types.MESSAGE_RECEIVED, genTimeout);
});