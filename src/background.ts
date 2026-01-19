import browser from "webextension-polyfill";

interface FetchMessage {
    type: "fetch";
    url: string;
}

function isFetchMessage(msg: unknown): msg is FetchMessage {
    return typeof msg === "object" && msg !== null && (msg as FetchMessage).type === "fetch";
}

// Proxies requests to bypass CORS restrictions
browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isFetchMessage(message)) return undefined;

    return (async () => {
        try {
            const response = await fetch(message.url);
            if (!response.ok) {
                return { ok: false, status: response.status, text: null };
            }
            const text = await response.text();
            return { ok: true, status: response.status, text };
        } catch (error) {
            console.error("[Background] Fetch error:", error);
            return { ok: false, status: 0, text: null, error: String(error) };
        }
    })();
});
