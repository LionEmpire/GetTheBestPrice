import { 
    IconsModule, 
    definePlugin, 
    Field, 
    DialogButton, 
    callable,
    TextField 
} from '@steambrew/client';

// Import React hooks from the global Millennium object
const { useState, useEffect } = window.SP_REACT;

// --- Define our backend functions ---
const loadApiKey = callable<[], string>('load_api_key');
const saveApiKey = callable<[{key: string}], boolean>('save_api_key');


// --- This is our functional settings page ---
const SettingsContent = () => {
    // Create state for the API key text and a "saved" message
    const [apiKey, setApiKey] = useState("");
    const [saveMessage, setSaveMessage] = useState("");

    // 1. Load the key from the backend when the page opens
    useEffect(() => {
        loadApiKey().then(key => {
            setApiKey(key || "");
        });
    }, []);

    // 2. Handle the save button click
    const onSaveClick = () => {
        setSaveMessage("Saving...");
        saveApiKey({key: apiKey}).then(success => {
            if (success) {
                setSaveMessage("Saved! Please restart Steam.");
            } else {
                setSaveMessage("Failed to save. Check logs.");
            }
            // Clear message after 3 seconds
            setTimeout(() => setSaveMessage(""), 3000);
        });
    };

	return (
        // Use a React Fragment (<>) to group multiple fields
        <>
            {/* Row 1: The Text Field */}
            <Field 
                label="GG.deals API Key" 
                description="Get your free API key from your GG.deals account settings."
                icon={<IconsModule.Settings />} 
                bottomSeparator="standard"
            >
                <TextField
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    label="Paste your API key here" // This acts as the placeholder
                />
            </Field>

            {/* Row 2: The Save Button */}
            <Field bottomSeparator="standard"><DialogButton onClick={onSaveClick}>Save Key</DialogButton></Field>

            {/* * Row 3: The "Saved!" message.*/}
            {saveMessage && (<Field description={saveMessage}/>)}
        </>
	);
};

export default definePlugin(() => {
	return {
		title: 'Get the Best Price Settings',
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});