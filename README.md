# Extension-State
Prompt persistent state from the AI.
The extension allows the user to configure a number of prompts that are automatically sent after the AI's response to the User's prompt, adding the result of each prompt as an individual message to the chat, as a form of persistent context.
TODO:
 - Change the configuration so that it's saved for each Character instead of each individual Chat;
 - Add an insertion template field;
 - Implement a keyword system, where the User can assign keywords to each prompt and those prompts will only trigger in case the last N messages contain said keywords (like a lorebook);
 - Fix the UI;