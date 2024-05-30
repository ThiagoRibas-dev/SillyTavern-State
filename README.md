# Extension-State
Prompt persistent state from the AI.
The extension allows the user to configure a number of prompts that are automatically sent after the AI's response to the User's prompt, adding the result of each prompt as an individual message to the chat, as a form of persistent context.
TODO:
 - Add an insertion template field;
 - Add an option to make the result of a prompt unique in the chat, as in, before adding a new result, the previous one will be removed;
 - Different event triggers (After User message, before User Message, before Assistant Message, etc);
 - ~~-Add an easy way to run a specific state prompt or all state prompts, manually, either by adding a toolbar to the UI or by adding a temporary slash command (like the quick replies extension);~~(DONE)
 - Change the configuration so that it's saved for each Character instead of each individual Chat;
 - Add an option to choose between adding the results of each prompt as individual messages (as is now) and appending the results to character's last message;
 - Add a mini prompt checkbox to the UI to decide how the result of a given prompt is shown in the chat history;
 - Fix the UI;
 - Implement a keyword system, where the User can assign keywords to each prompt and those prompts will only trigger in case the last N messages contain said keywords (like a lorebook);