
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

    function cleanMarkdown(text) {
        return text
            .replace(/\\([*_#~`>])/g, "$1")
            .replace(/\\-/g, "-")
            .replace(/\s*---\s*/g, "\n\n");
    }

    function addMessage(role, text) {
        const group = document.createElement("div");
        group.className = "message-group mb-3";

        const meta = document.createElement("div");
        meta.className = "message-meta text-muted small text-uppercase";
        meta.textContent = role === "user" ? "YOU" : "AI ASSISTANT";

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

    async function sendMessage(message) {
        const prompt = message.trim();

        if (!prompt || sendBtn.disabled) return;

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
        sendBtn.textContent = "Thinking...";

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

            const markdown = cleanMarkdown(
                data.reply || "Sorry, I received an empty response."
            );

            if (
                typeof marked !== "undefined" &&
                typeof DOMPurify !== "undefined"
            ) {
                const html = marked.parse(markdown);
                replyBubble.innerHTML = DOMPurify.sanitize(html);

                // Render LaTeX equations if MathJax is installed.
                if (
                    window.MathJax &&
                    typeof window.MathJax.typesetPromise === "function"
                ) {
                    await window.MathJax.typesetPromise([replyBubble]);
                }
            } else {
                replyBubble.textContent = markdown;
                console.error(
                    "Markdown formatting requires Marked.js and DOMPurify."
                );
            }

            chatFeed.scrollTop = chatFeed.scrollHeight;

        } catch (error) {
            console.error("Chat request failed:", error);
            replyBubble.textContent =
                "Sorry, I couldn't get a response. " + error.message;
        } finally {
            sendBtn.disabled = false;
            sendBtn.innerHTML =
                '<i class="bi bi-send-fill"></i> Send';
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
            offlineBanner.classList.toggle("d-none", navigator.onLine);
        }
    }

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();

    console.log("AI Assistant JavaScript loaded successfully.");
});
