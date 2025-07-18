import * as vscode from "vscode";
import fetch from "node-fetch";

export function activate(context: vscode.ExtensionContext) {
  // Register the main command for adding funny comments
  const addCommentsDisposable = vscode.commands.registerCommand(
    "fckai.addFunnyComments",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage(
          "No editor open. Don't be shy, show the mess."
        );
        return;
      }

      const selection = editor.selection;
      const selectedCode = editor.document.getText(selection);
      if (!selectedCode) {
        vscode.window.showWarningMessage(
          "Highlight some code first. Or are you afraid AI will expose your sins?"
        );
        return;
      }

      // 💥 Prompt user to select provider every time
      const provider = await vscode.window.showQuickPick(
        ["gemini", "groq", "openai"],
        {
          placeHolder: "Choose your favorite ~mistake~ AI provider",
        }
      );

      if (!provider) {
        vscode.window.showErrorMessage(
          "No provider? Did you think this would just work on vibes?"
        );
        return;
      }

      // 🔑 Get or prompt for API key
      let apiKey = await getApiKey(context, provider);
      if (!apiKey) {
        apiKey = await promptForApiKey(context, provider);
        if (!apiKey) {
          vscode.window.showErrorMessage(
            "No key? Go cry in a stackoverflow thread."
          );
          return;
        }
      }

      // Create mock config object to pass into fetchFunnyComment
      const config = {
        get: <T>(key: string) => {
          if (key === "apiKey") return apiKey as unknown as T;
          if (key === "apiProvider") return provider as unknown as T;
          return undefined as unknown as T;
        },
      };

      // 🔄 Show progress while fetching the comment
      const funnyComment = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Roasting your code...",
          cancellable: false,
        },
        async (progress, token) => {
          progress.report({
            increment: 0,
            message: "Warming up the roast machine...",
          });

          const result = await fetchFunnyComment(
            selectedCode,
            config as vscode.WorkspaceConfiguration,
            progress
          );

          progress.report({ increment: 100, message: "Done!" });
          return result;
        }
      );

      if (!funnyComment) {
        vscode.window.showErrorMessage(
          "AI died from laughter overload. Try again!"
        );
        return;
      }

      const commentedCode = `${funnyComment}\n${selectedCode}`;
      editor.edit((editBuilder) =>
        editBuilder.replace(selection, commentedCode)
      );
    }
  );

  // Register command to manage API keys
  const manageKeysDisposable = vscode.commands.registerCommand(
    "fckai.manageApiKeys",
    async () => {
      const action = await vscode.window.showQuickPick(
        [
          { label: "🔑 Set API Key", value: "set" },
          { label: "👀 View Saved Keys", value: "view" },
          { label: "🗑️ Delete API Key", value: "delete" },
          { label: "💀 Delete All Keys", value: "deleteAll" },
        ],
        {
          placeHolder: "What do you want to do with your precious API keys?",
        }
      );

      if (!action) return;

      switch (action.value) {
        case "set":
          await setApiKey(context);
          break;
        case "view":
          await viewApiKeys(context);
          break;
        case "delete":
          await deleteApiKey(context);
          break;
        case "deleteAll":
          await deleteAllApiKeys(context);
          break;
      }
    }
  );

  context.subscriptions.push(addCommentsDisposable, manageKeysDisposable);
}

// 🔑 Get stored API key for provider
async function getApiKey(
  context: vscode.ExtensionContext,
  provider: string
): Promise<string | undefined> {
  return await context.secrets.get(`fckai.apiKey.${provider}`);
}

// 💾 Save API key for provider
async function saveApiKey(
  context: vscode.ExtensionContext,
  provider: string,
  apiKey: string
): Promise<void> {
  await context.secrets.store(`fckai.apiKey.${provider}`, apiKey);
}

// 🗑️ Delete API key for provider
async function deleteApiKeyForProvider(
  context: vscode.ExtensionContext,
  provider: string
): Promise<void> {
  await context.secrets.delete(`fckai.apiKey.${provider}`);
}

// 📝 Prompt user for API key and save it
async function promptForApiKey(
  context: vscode.ExtensionContext,
  provider: string
): Promise<string | undefined> {
  const apiKey = await vscode.window.showInputBox({
    prompt: `Paste your ${provider.toUpperCase()} API key (we'll remember it this time)`,
    placeHolder: "Enter your API key and we'll store it securely",
    password: true,
  });

  if (apiKey) {
    await saveApiKey(context, provider, apiKey);
    vscode.window.showInformationMessage(
      `${provider.toUpperCase()} API key saved! Now go roast some code! 🔥`
    );
  }

  return apiKey;
}

// 🔧 Command to set API key manually
async function setApiKey(context: vscode.ExtensionContext): Promise<void> {
  const provider = await vscode.window.showQuickPick(
    ["openai", "groq", "gemini"],
    {
      placeHolder: "Which AI overlord do you want to feed your key to?",
    }
  );

  if (!provider) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter your ${provider.toUpperCase()} API key`,
    placeHolder: "Paste your precious API key here",
    password: true,
  });

  if (apiKey) {
    await saveApiKey(context, provider, apiKey);
    vscode.window.showInformationMessage(
      `${provider.toUpperCase()} API key saved! Ready to roast! 🔥`
    );
  }
}

// 👀 View which keys are saved
async function viewApiKeys(context: vscode.ExtensionContext): Promise<void> {
  const providers = ["openai", "groq", "gemini"];
  const savedKeys = [];

  for (const provider of providers) {
    const key = await getApiKey(context, provider);
    if (key) {
      savedKeys.push(`🔑 ${provider.toUpperCase()}: ***${key.slice(-4)}`);
    }
  }

  if (savedKeys.length === 0) {
    vscode.window.showInformationMessage(
      "No API keys saved. You're running naked! 🏃‍♂️"
    );
  } else {
    vscode.window.showInformationMessage(
      `Saved Keys:\n${savedKeys.join("\n")}`
    );
  }
}

// 🗑️ Delete specific API key
async function deleteApiKey(context: vscode.ExtensionContext): Promise<void> {
  const providers = ["openai", "groq", "gemini"];
  const availableKeys = [];

  for (const provider of providers) {
    const key = await getApiKey(context, provider);
    if (key) {
      availableKeys.push({
        label: `🗑️ Delete ${provider.toUpperCase()}`,
        value: provider,
        description: `***${key.slice(-4)}`,
      });
    }
  }

  if (availableKeys.length === 0) {
    vscode.window.showInformationMessage(
      "No keys to delete. You're already keyless! 🔐"
    );
    return;
  }

  const selected = await vscode.window.showQuickPick(availableKeys, {
    placeHolder: "Which key do you want to send to the shadow realm?",
  });

  if (selected) {
    await deleteApiKeyForProvider(context, selected.value);
    vscode.window.showInformationMessage(
      `${selected.value.toUpperCase()} API key deleted! Gone like your dignity! 💀`
    );
  }
}

// 💀 Delete all API keys
async function deleteAllApiKeys(
  context: vscode.ExtensionContext
): Promise<void> {
  const confirmation = await vscode.window.showWarningMessage(
    "Are you sure you want to delete ALL API keys? This is nuclear! ☢️",
    "Yes, nuke them all! 💥",
    "No, I changed my mind 😅"
  );

  if (confirmation === "Yes, nuke them all! 💥") {
    const providers = ["openai", "groq", "gemini"];
    for (const provider of providers) {
      await deleteApiKeyForProvider(context, provider);
    }
    vscode.window.showInformationMessage(
      "All API keys deleted! You're back to square one! 🔥"
    );
  }
}

async function fetchFunnyComment(
  code: string,
  config: vscode.WorkspaceConfiguration,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string | null> {
  const apiKey = config.get<string>("apiKey")!;
  const provider = config.get<string>("apiProvider");
  const prompt = `Your mission: Roast this code into oblivion with maximum hilarity. Be savage, be funny, be absolutely merciless. You only have 6-7 words:\n\n${code}`;

  try {
    progress?.report({
      increment: 20,
      message: "Sending code to the comedy graveyard...",
    });

    let response;

    if (provider === "groq") {
      progress?.report({
        increment: 40,
        message: "Groq is cooking up some burns...",
      });
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemma2-9b-it",
            messages: [{ role: "user", content: prompt }],
            temperature: 1.4,
          }),
        }
      );
    } else if (provider === "openai") {
      progress?.report({
        increment: 40,
        message: "OpenAI is sharpening its claws...",
      });
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          input: prompt,
          temperature: 1.3,
        }),
      });
    } else if (provider === "gemini") {
      progress?.report({
        increment: 40,
        message: "Gemini is preparing verbal destruction...",
      });
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
    } else {
      progress?.report({
        increment: 40,
        message: "Desperate fallback to OpenAI...",
      });
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 1.3,
        }),
      });
    }

    progress?.report({
      increment: 80,
      message: "Polishing the savage comeback...",
    });

    // Check if response is ok
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as any;

    // Handle different response formats
    if (provider === "gemini") {
      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "// Gemini chickened out of the roast battle."
      );
    } else if (provider === "openai") {
      // Handle OpenAI /v1/responses format
      return data.output?.trim() || "// OpenAI speechless. Your code broke AI.";
    } else {
      // Handle chat completions format (Groq and fallback)
      return (
        data.choices?.[0]?.message?.content?.trim() ||
        "// AI died laughing at your code."
      );
    }
  } catch (e) {
    progress?.report({ increment: 100, message: "Epic failure achieved!" });
    console.error("API Error:", e);
    return `// Oops. Something exploded: ${e instanceof Error ? e.message : e}`;
  }
}

export function deactivate() {}
