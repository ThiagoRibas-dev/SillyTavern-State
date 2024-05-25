import { chat_metadata, callPopup, saveSettingsDebounced, is_send_press } from '../../../../script.js';
import { getContext, extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import {
    substituteParams,
    eventSource,
    event_types,
    generateQuietPrompt,
} from '../../../../script.js';
import { registerSlashCommand } from '../../../slash-commands.js';
import { waitUntilCondition } from '../../../utils.js';
import { is_group_generating, selected_group } from '../../../group-chats.js';

const MODULE_NAME = 'PromptEvaluator';

let records = [];
let lastSystemMessages = {};

//###############################//
//#       Event Handling        #//
//###############################//

eventSource.addEventListener(event_types.MESSAGE_RECEIVED, async (event) => {
    await handleNewMessage(event);
});

async function handleNewMessage(event) {
    const context = getContext();
    for (const record of records) {
        const prompt = substituteParams(record.prompt);
        context.setExtensionPrompt(MODULE_NAME, prompt);
        const response = await generateQuietPrompt(prompt);
        addSystemMessage(record.id, response);
    }
}

//###############################//
//#       System Messages       #//
//###############################//

function addSystemMessage(recordId, messageContent) {
    const chatContainer = $('#chat-container');
    if (lastSystemMessages[recordId]) {
        lastSystemMessages[recordId].remove();
    }
    const systemMessage = $('<div></div>').addClass('system-message').text(messageContent);
    chatContainer.append(systemMessage);
    lastSystemMessages[recordId] = systemMessage;
}

//###############################//
//#       Record Handling       #//
//###############################//

function addRecord(prompt, messageCount) {
    const record = {
        id: records.length + 1,
        prompt,
        messageCount,
    };
    records.push(record);
    saveState();
    updateUiRecordList();
}

function removeRecord(recordId) {
    records = records.filter(record => record.id !== recordId);
    delete lastSystemMessages[recordId];
    saveState();
    updateUiRecordList();
}

function updateRecord(recordId, prompt, messageCount) {
    const record = records.find(record => record.id === recordId);
    if (record) {
        record.prompt = prompt;
        record.messageCount = messageCount;
        saveState();
        updateUiRecordList();
    }
}

//###############################//
//#         UI Handling         #//
//###############################//

function updateUiRecordList() {
    const recordList = $('#prompt-record-list');
    recordList.empty();
    for (const record of records) {
        const recordElement = $('<li></li>').text(`Prompt: ${record.prompt}, Messages: ${record.messageCount}`);
        recordList.append(recordElement);
    }
}

//###############################//
//#       State Handling        #//
//###############################//

function loadState() {
    try {
        const stateString = $('#prompt-evaluator-save-state').val();
        if (stateString.trim() === '') return;
        const savedState = JSON.parse(stateString);
        records = savedState.records || [];
        lastSystemMessages = savedState.lastSystemMessages || {};
        updateUiRecordList();
        console.info('Loaded prompt evaluator state from textarea');
    } catch (e) {
        console.error('Failed to load prompt evaluator state', e);
    }
}

function saveState() {
    $('#prompt-evaluator-save-state').val(JSON.stringify({
        records,
        lastSystemMessages,
    }));
    saveSettingsDebounced();
}

//###############################//
//#         UI Elements         #//
//###############################//

const promptEvaluatorPanel = `
<div id="prompt-evaluator-panel">
    <h3>Prompt Evaluator</h3>
    <div>
        <label for="prompt-evaluator-prompt">Prompt:</label>
        <input type="text" id="prompt-evaluator-prompt">
    </div>
    <div>
        <label for="prompt-evaluator-message-count">Message Count:</label>
        <input type="number" id="prompt-evaluator-message-count" min="1">
    </div>
    <button id="add-prompt-record">Add Record</button>
    <ul id="prompt-record-list"></ul>
    <textarea id="prompt-evaluator-save-state" style="display: none;"></textarea>
</div>
`;

// Append the panel to the UI
$('body').append(promptEvaluatorPanel);

//###############################//
//#       UI Event Listeners     #//
//###############################//

$('#add-prompt-record').on('click', () => {
    const prompt = $('#prompt-evaluator-prompt').val();
    const messageCount = $('#prompt-evaluator-message-count').val();
    addRecord(prompt, messageCount);
});

// Initialize
$(document).ready(() => {
    loadState();
});
