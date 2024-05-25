// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";

//You'll likely need to import some other functions from the main script
import { saveSettingsDebounced } from "../../../../script.js";

import {
  eventSource,
  event_types,
  generateQuietPrompt, saveSettingsDebounced, substituteParams
} from '../../../../script.js';
import { getContext } from '../../../extensions.js';

const MODULE_NAME = 'StatePrompts';
// Keep track of where your extension is located, name should match repo name
const extensionName = "st-extension-state";
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

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
//#       UI Event Listeners     #//
//###############################//

$('#add-prompt-record').on('click', () => {
    const prompt = $('#prompt-evaluator-prompt').val();
    const messageCount = $('#prompt-evaluator-message-count').val();
    addRecord(prompt, messageCount);
});

 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Updating settings in the UI
  $("#example_setting").prop("checked", extension_settings[extensionName].example_setting).trigger("input");
}

jQuery(async () => {
  //###############################//
  //#         UI Elements         #//
  //###############################//
  const settingsHtml = `
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
  
  // Append settingsHtml to extensions_settings
  // extension_settings and extensions_settings2 are the left and right columns of the settings menu
  // Left should be extensions that deal with system functions and right should be visual/UI related 
  $("#extensions_settings").append(settingsHtml);

  // Load settings when starting things up (if you have any)
  loadSettings();
});
