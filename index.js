import { Generate, eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
export { MODULE_NAME };

const extensionName = "Extension-State";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const MODULE_NAME = 'State';
const DEBUG_PREFIX = "<State extension> ";

let enforcing = "";

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    expected: "",
    continue_prefix: "",
    max_try: 1
}

function loadSettings() {
    if (extension_settings.State === undefined)
        extension_settings.State = {};

    if (Object.keys(extension_settings.State).length != Object.keys(defaultSettings).length) {
        Object.assign(extension_settings.State, defaultSettings)
    }

    $("state_enabled").prop('checked', extension_settings.State.enabled);
    $("state_expected").val(extension_settings.State.expected);
    $("state_continue_prefix").val(extension_settings.State.continue_prefix);
}

async function onEnabledClick() {
    extension_settings.State.enabled = $('state_enabled').is(':checked');
    saveSettingsDebounced();
}

async function onExpectedChange() {
    extension_settings.State.expected = $('state_expected').val();
    saveSettingsDebounced();
}

async function onContinuePrefixChange() {
    extension_settings.State.continue_prefix = $('state_continue_prefix').val();
    saveSettingsDebounced();
}

async function StateText(chat_id) {
    if (!extension_settings.State.enabled)
        return;

    const context = getContext();

    // group mode not compatible
    if (context.groupId != null) {
        console.debug(DEBUG_PREFIX,"Group mode detected, not compatible, abort State.");
        //toastr.warning("Not compatible with group mode.", DEBUG_PREFIX + " disabled", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }
    
    console.debug(DEBUG_PREFIX, extension_settings.State);

    const expected = extension_settings.State.expected
    let last_message = getContext().chat[chat_id].mes;
    
    console.debug(DEBUG_PREFIX, "Message received:",last_message);

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
    enforcing = last_message + extension_settings.State.continue_prefix
    getContext().chat[chat_id].mes = enforcing;
    //$("#option_continue").trigger('click'); // To allow catch by blip extension
    await Generate("continue");
}


//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    $('#extensions_settings').append(windowHtml);
    loadSettings();

    $("state_enabled").on("click", onEnabledClick);
    $("state_expected").on("change", onExpectedChange);
    $("state_continue_prefix").on("change", onContinuePrefixChange);

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => StateText(chat_id));
});
