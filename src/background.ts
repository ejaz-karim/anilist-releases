// background.ts - Background script for cross-origin fetches

import browser from "webextension-polyfill";

interface FetchMessage {
    type: "fetch";
    url: string;
}

function isFetchMessage(msg: unknown): msg is FetchMessage {
    return typeof msg === "object" && msg !== null && (msg as FetchMessage).type === "fetch";
}

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message: unknown) => {
    if (isFetchMessage(message)) {
        const { url } = message;

        // Return a Promise for the async response
        return fetch(url)
            .then(async (response) => {
                if (!response.ok) {
                    return { ok: false, status: response.status, text: null };
                }
                const text = await response.text();
                return { ok: true, status: response.status, text: text };
            })
            .catch((error) => {
                console.error("[Background] Fetch error:", error);
                return { ok: false, status: 0, text: null, error: String(error) };
            });
    }
    return undefined;
});

console.log("[Background] Background script loaded");
