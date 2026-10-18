
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("chat-form");
    const input = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-btn");
    const chatFeed = document.getElementById("chat-feed");
    const quickPrompts = document.querySelectorAll(".chip-btn");
    const offlineBanner = document.getElementById("offline-banner");

    if (!form || !input || !sendBtn || !chatFeed) {
        console.error("AI Assistant: Required HTML elements were not found.");
        return;
    }

    const csrfInput = form.querySelector(
        'input[name="csrfmiddlewaretoken"]'
    );

    // Clean unnecessary escaping without damaging LaTeX commands.
    function cleanMarkdown(text) {
        return String(text)
            .replace(/\\([*_#~`>])/g, "$1")
            .replace(/\\-/g, "-")
            .replace(/\n[ \t]*---[ \t]*\n/g, "\n\n---\n\n");
    }

    function addMessage(role, text) {
        const group = document.createElement("div");
        group.className = "message-group mb-3";

        const meta = document.createElement("div");
        meta.className =
            "message-meta text-muted small text-uppercase";
        meta.textContent =
            role === "user" ? "YOU" : "AI ASSISTANT";

        const bubble = document.createElement("div");
        bubble.className =
            role === "user"
                ? "user-bubble p-3 rounded-3 mt-1"
                : "assistant-bubble p-3 rounded-3 mt-1 border";

        bubble.textContent = text;

        group.append(meta, bubble);
        chatFeed.appendChild(group);
        chatFeed.scrollTop = chatFeed.scrollHeight;

        return bubble;
    }

    // Protect LaTeX expressions while Markdown is being parsed.
    function protectMath(text) {
        const expressions = [];

        const protectedText = text.replace(
            /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\$)\$(?!\$)[^\n$]+\$/g,
            (match) => {
                const token = `MATHPLACEHOLDER${expressions.length}TOKEN`;
                expressions.push(match);
                return token;
            }
        );

        return { protectedText, expressions };
    }

    function restoreMath(html, expressions) {
        expressions.forEach((expression, index) => {
            const token = `MATHPLACEHOLDER${index}TOKEN`;

            // Restore expressions as text nodes, not raw HTML.
            html = html.replace(
                token,
                () => {
                    const element = document.createElement("span");
                    element.textContent = expression;
                    return element.outerHTML;
                }
            );
        });

        return html;
    }

    async function renderAssistantResponse(bubble, text) {
        const markdown = cleanMarkdown(text);

        if (
            typeof marked === "undefined" ||
            typeof DOMPurify === "undefined"
        ) {
            bubble.textContent = markdown;
            console.error(
                "Markdown rendering requires Marked.js and DOMPurify."
            );
            return;
        }

        const { protectedText, expressions } = protectMath(markdown);

        // Parse and sanitize the Markdown.
        const parsedHTML = marked.parse(protectedText);
        const safeHTML = DOMPurify.sanitize(parsedHTML);

        // Restore math expressions as literal text for MathJax.
        bubble.innerHTML = restoreMath(safeHTML, expressions);

        // Render the restored equations.
        if (
            window.MathJax &&
            typeof window.MathJax.typesetPromise === "function"
        ) {
            try {
                await window.MathJax.typesetPromise([bubble]);
            } catch (error) {
                console.error("MathJax rendering failed:", error);
            }
        }

        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    async function sendMessage(message) {
        const prompt = message.trim();

        if (!prompt || sendBtn.disabled) {
            return;
        }

        if (!navigator.onLine) {
            addMessage(
                "assistant",
                "You're offline. Please reconnect to the internet to ask Gemini."
            );
            return;
        }

        if (!csrfInput) {
            addMessage(
                "assistant",
                "Security token not found. Please refresh the page and try again."
            );
            return;
        }

        addMessage("user", prompt);

        input.value = "";
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Thinking...';

        const replyBubble = addMessage("assistant", "Thinking...");

        try {
            const response = await fetch("/api/chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfInput.value,
                    "Accept": "application/json"
                },
                body: JSON.stringify({ prompt }),
                credentials: "same-origin"
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || `Request failed (${response.status}).`
                );
            }

            await renderAssistantResponse(
                replyBubble,
                data.reply || "Sorry, I received an empty response."
            );

        } catch (error) {
            console.error("Chat request failed:", error);
            replyBubble.textContent =
                "Sorry, I couldn't get a response. " + error.message;
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="bi bi-send-fill"></i> Send';
            input.focus();
        }
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        sendMessage(input.value);
    });

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            input.value = "";
            input.focus();
        });
    }

    quickPrompts.forEach((button) => {
        button.addEventListener("click", () => {
            sendMessage(button.textContent);
        });
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    function updateConnectionStatus() {
        if (offlineBanner) {
            offlineBanner.classList.toggle(
                "d-none",
                navigator.onLine
            );
        }
    }

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();

    // Register the service worker.
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/sw.js")
                .catch((error) => {
                    console.error(
                        "Service worker registration failed:",
                        error
                    );
                });
        });
    }

    console.log("AI Assistant JavaScript loaded successfully.");
});
