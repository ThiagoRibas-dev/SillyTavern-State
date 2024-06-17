# Extension-State
Prompt persistent state from the AI.
The extension allows the user to configure a number of prompts that are automatically sent after the AI's response to the User's prompt, adding the result of each prompt as an individual message to the chat, as a form of persistent context that gets update after each turn.
Can be used to track things like character clothes, positions, inventory of itens, stats, etc. It could also be used to create a history or summary of places, people, events, that kind of thing.

TODO:
 - ~~Add an insertion template field~~(DONE);
 - ~~Different event triggers (After User message, before User Message, before Assistant Message, etc)~~(DISCARDED);
 - ~~-Add an easy way to run a specific state prompt or all state prompts, manually, either by adding a toolbar to the UI or by adding a temporary slash command (like the quick replies extension)~~(DONE);
 - ~~Change the configuration so that it's saved for each Character instead of each individual Chat~~(DONE)[BREAKING - Save your existing prompts and migrate manually if coming from version 1.0.3];
 - ~~Add a "mini prompt" checkbox to the UI to decide how the result of a given prompt is shown in the chat history (mini response or full resposnse)~~(DONE);
 - ~~Add an option to make the result of a prompt unique in the chat, as in, before adding a new result, the previous one will be removed~~(DONE)[FIXED!];
 - ~~Implement a way to collapse the state messages so that the chat can look cleaner even with several state prompts in play~~(DONE. Could have used css, but I liked the jquery+html solution better. Added an option to select which messages get collapsed);
 - Implement a keyword system, where the User can assign keywords to each prompt and those prompts will only trigger in case the last N messages contain said keywords (like a lorebook);
 - Add a field for custom GNBF Grammar for each prompt;
 - Fix the UI;