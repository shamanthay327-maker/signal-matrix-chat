// =========================================================================
// 💎 CONFIGURATION & INITIALIZATION
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDml5oxrAMvMruHQmcMn6neMhdVfGrDY6A",
    authDomain: "chat-app-b46c7.firebaseapp.com",
    databaseURL: "https://chat-app-b46c7-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "chat-app-b46c7"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// =========================================================================
// 💎 ARCHITECTURAL STATE HOOKS
// =========================================================================
let me = null;
let chatWith = null;
let msgRef = null;
let presenceIntervalId = null;

let localStream = null;
let peerConnection = null;
let currentCallId = null;
let isMuted = false;
let videoEnabled = true;

let remoteIceCandidatesQueue = [];

// ✨ E2EE LAYER ARCHITECTURAL STATE HOOKS
let isE2EEMatrixActive = false;
let cryptographicSecretKey = "SIGNAL_MATRIX_PASSPHRASE_KEY";

const servers = {
    iceServers: [
        { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
        { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
        { urls: ["stun:stun4.l.google.com:19302", "stun:stun.services.mozilla.com"] }
    ],
    iceCandidatePoolSize: 10
};

// =========================================================================
// 💎 CONNECT HANDSHAKER
// =========================================================================
function submitLogin() { // 👈 CHANGED THIS LINE
    const phone = document.getElementById("phone").value.trim();
    if (!phone) {
        alert("Please provide a phone code entry value.");
        return;
    }

    me = phone;
    document.getElementById("myPhoneDisplay").innerText = me;
    document.getElementById("myAvatar").innerText = me.substring(0,2).toUpperCase();
    
    const myDrawerCircle = document.getElementById("myStoryProfileDisplayCircle");
    if (myDrawerCircle) {
        myDrawerCircle.innerText = me.substring(0,2).toUpperCase();
    }

    const userRef = db.ref("users/" + me);
    userRef.once("value", snap => {
        const payload = {
            phone: me,
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        };
        
        if (!snap.exists()) {
            userRef.set(payload);
        } else {
            userRef.update({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }

        document.getElementById("login").style.display = "none";
        document.getElementById("chatPage").style.display = "flex";

        loadUsers();
        startPresence();
        listenForIncomingCalls(); 
        listenForNetworkStatusNotes();
    });
}
// =========================================================================
// 💎 DIRECTORY MANAGER WITH TIMESTAMP LIVENESS CHECK
// =========================================================================
function loadUsers() {
    db.ref("users").on("value", snap => {
        const list = document.getElementById("chatList");
        if (!list) return;
        list.innerHTML = "";

        const now = Date.now();

        snap.forEach(u => {
            const user = u.val();
            if (!user || !user.phone || user.phone === me) return;

            const isLivenessActive = user.online && user.lastSeen && (now - user.lastSeen < 20000);
            const statusDot = isLivenessActive 
                ? '<span class="status-badge status-online">🟢 Online</span>' 
                : '<span class="status-badge status-offline">⚪ Offline</span>';
                
            const activeClass = chatWith === user.phone ? 'active' : '';

            list.innerHTML += `
                <div class="chat-item ${activeClass}" onclick="openChat('${user.phone}')">
                    <div class="avatar-placeholder">${user.phone.substring(0,2).toUpperCase()}</div>
                    <div class="chat-info">
                        <div class="chat-meta">
                            <div class="chat-name">${user.phone}</div>
                        </div>
                        <div style="font-size: 0.8rem;">${statusDot}</div>
                    </div>
                </div>
            `;
        });
        triggerSyncNotesOnDirectory();
    });
}

function chatId(a, b) {
    return [a, b].sort().join("_");
}

function startPresence() {
    const myPresenceRef = db.ref("users/" + me);
    myPresenceRef.onDisconnect().update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    if (presenceIntervalId) clearInterval(presenceIntervalId);
    presenceIntervalId = setInterval(() => {
        myPresenceRef.update({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP }).catch(err => {});
    }, 6000);
}

// =========================================================================
// 💎 CORE WINDOW TERMINATION AND OPEN NAVIGATION HANDLERS
// =========================================================================
function logout() {
    clearInterval(presenceIntervalId);
    if (me) {
        db.ref("users/" + me).update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP }).then(() => { location.reload(); });
    } else { location.reload(); }
}

function openChat(phone) {
    chatWith = phone;
    
    // 🔄 AUTOMATIC MECHANICAL DISMISS: Collapse mobile dropdown and reset icons cleanly during room changes
    const targetMobileTriggerNode = document.getElementById("headerThreeDotsTrigger");
    const targetMobileMenuDrawerNode = document.getElementById("headerActionMenuDrawer");
    if (targetMobileTriggerNode && targetMobileMenuDrawerNode) {
        targetMobileTriggerNode.classList.remove("rotate-triangle");
        targetMobileMenuDrawerNode.style.display = "none";
    }

    // Auto reset secure active status parameters cleanly when hopping profiles
    document.getElementById("e2eeLockBtn").classList.remove("secure-active");
    document.getElementById("e2eeStatusDot").style.display = "none";
    document.getElementById("e2eeActiveLabel").style.display = "none";
    isE2EEMatrixActive = false;
    cryptographicSecretKey = "SIGNAL_MATRIX_PASSPHRASE_KEY";

    document.getElementById("noChatSelected").style.display = "none";
    const activeFrame = document.getElementById("activeChatFrame");
    activeFrame.removeAttribute("style");
    document.getElementById("chatTitle").innerText = phone;
    document.getElementById("targetAvatar").innerText = phone.substring(0,2).toUpperCase();
    document.getElementById("chatWindowContainer").classList.add("active-window");
    loadUsers();
    listenTyping();
    markSeen();
    loadMessages();
}

function goBack() {
    // 🔄 AUTOMATIC MECHANICAL DISMISS: Collapse mobile dropdown and reset icons cleanly when closing workspace windows
    const targetMobileTriggerNode = document.getElementById("headerThreeDotsTrigger");
    const targetMobileMenuDrawerNode = document.getElementById("headerActionMenuDrawer");
    if (targetMobileTriggerNode && targetMobileMenuDrawerNode) {
        targetMobileTriggerNode.classList.remove("rotate-triangle");
        targetMobileMenuDrawerNode.style.display = "none";
    }

    document.getElementById("chatWindowContainer").classList.remove("active-window");
    const activeFrame = document.getElementById("activeChatFrame");
    activeFrame.style.display = "none";
    document.getElementById("noChatSelected").removeAttribute("style");
    chatWith = null;
    if (msgRef) { msgRef.off(); msgRef = null; }
}

// =========================================================================
// 🛡️ PROJECT X-25 SENTINEL: ENTROPY SCANNER
// =========================================================================
function scanPayloadForThreats(payload) {
    const data = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
    const len = data.length;
    if (len === 0) return true;

    const frequencies = {};
    for (let i = 0; i < len; i++) frequencies[data[i]] = (frequencies[data[i]] || 0) + 1;

    let entropy = 0;
    for (const byte in frequencies) {
        const p = frequencies[byte] / len;
        entropy -= p * Math.log2(p);
    }
    
    // Sentinel Threshold: > 7.5 indicates high-density/hidden binary payload
    return entropy < 7.5; 
}

function sendMessage() {
    const input = document.getElementById("message");
    const text = input.value.trim();
    if (!text || !chatWith) return;
    const id = chatId(me, chatWith);

    let payloadMessage = text;
    // ✨ INTERCEPTOR: Scramble plain text if E2EE cipher tunnel is active open
    if (isE2EEMatrixActive) {
        payloadMessage = encryptStringPayloadCore(text, cryptographicSecretKey);
    }

    db.ref("chats/" + id).push({ 
        sender: me, 
        text: payloadMessage, 
        type: "text", // Explicit design schema configuration tracker parameter flag
        time: firebase.database.ServerValue.TIMESTAMP, 
        status: "sent",
        encrypted: isE2EEMatrixActive
    });
    input.value = "";
    setTyping(false);
}

document.addEventListener("keydown", e => {
    if (e.key === "Enter" && document.activeElement === document.getElementById("message")) { sendMessage(); }
});

function loadMessages() {
    const id = chatId(me, chatWith);
    if (msgRef) msgRef.off();
    msgRef = db.ref("chats/" + id);
    const box = document.getElementById("chatBox");
    box.innerHTML = "";

    msgRef.on("child_added", snap => {
        const m = snap.val();
        const key = snap.key;
        const isMe = m.sender === me;
        
        if (!isMe && m.status !== "seen") {
            db.ref("chats/" + id + "/" + key).update({ status: chatWith === m.sender ? "seen" : "delivered" });
        }
        
        // 1. Render the message first
        renderMessage(m, isMe, key);

        // Ensure this block in renderMessage is robust:
let deleteBtnMarkup = isMe ? 
    `<button onclick="deleteMessage('${key}')" class="delete-msg-btn" title="Delete Payload">
        <i class="fa-solid fa-trash-can"></i>
     </button>` : '';

// Ensure this is inside the template literal passed to row.innerHTML:
row.innerHTML = `
    <div class="msg-bubble">
        ${bubbleContentInnerMarkup}
        ${secureLockMarkupTag}
        ${actionPillMarkup}
        <div class="msg-meta">
            ${formatTime(m.time)}
            ${deleteBtnMarkup}  ${isMe ? getTicks(m.status) : ""}
        </div>
    </div>
`;
        
        // 2. Apply "Quantum" Scanning Effect
        const msgElement = document.getElementById(`msg-${key}`);
        if (msgElement) {
            msgElement.classList.add("scanning");
            // Remove the scan effect after animation finishes (1.5s)
            setTimeout(() => {
                msgElement.classList.remove("scanning");
            }, 1500);
        }
    });

    msgRef.on("child_changed", snap => {
    const m = snap.val();
    const key = snap.key;
    const element = document.getElementById(`msg-${key}`);
    if (element && m.sender === me) {
        const metaBox = element.querySelector(".msg-meta");
        // ⚠️ DANGER: If you overwrite innerHTML here, you wipe the button!
        // CHANGE THIS:
        metaBox.innerHTML = `${formatTime(m.time)} ${getTicks(m.status)}`;
        // TO THIS:
        metaBox.innerHTML = `${formatTime(m.time)} <button onclick="deleteMessage('${key}')" class="delete-msg-btn"><i class="fa-solid fa-trash-can"></i></button> ${getTicks(m.status)}`;
    }
});
}

// =========================================================================
// 🗑️ MESSAGE DELETION PIPELINE
// =========================================================================
function deleteMessage(messageKey) {
    if (!chatWith || !me) return;
    
    // Safety lock: confirm before purging the data
    if (!confirm("Permanently delete this message from the matrix?")) return;

    const id = chatId(me, chatWith);
    
    // Target the specific message node in Firebase and wipe it
    db.ref("chats/" + id + "/" + messageKey).remove()
        .then(() => {
            // Instantly remove the bubble from the screen for a snappy UI
            const msgElement = document.getElementById(`msg-${messageKey}`);
            if (msgElement) {
                msgElement.style.transform = "scale(0.9)";
                msgElement.style.opacity = "0";
                setTimeout(() => msgElement.remove(), 200); // Smooth fade out
            }
        })
        .catch(err => console.error("Deletion failed:", err));
}

// =========================================================================
// 💬 RENDER MESSAGE ENGINE (MASTER ASSEMBLED VERSION)
// =========================================================================
async function renderMessage(m, isMe, key) {
    const box = document.getElementById("chatBox");
    if(document.getElementById(`msg-${key}`)) return;

    // 1. Create Row & Target ID
    const row = document.createElement("div");
    row.id = `msg-${key}`;
    row.className = `msg-row ${isMe ? "sent" : "received"}`;
    row.style.transition = "all 0.2s ease-out"; 

    const mobileSelectedLang = document.getElementById("myDisplayLanguage") ? document.getElementById("myDisplayLanguage").value : "en";
    let messageBodyText = m.text || "";
    let wasMessageDecryptedSuccess = false;
    let isInlineMediaContent = m.type === "image" || (m.text && m.text.startsWith("data:image/"));

    // 2. YOUR CUSTOM DECRYPTION & AI TRANSLATION LOGIC
    if (m.encrypted && !isInlineMediaContent) {
        messageBodyText = decryptStringPayloadCore(m.text, cryptographicSecretKey);
        wasMessageDecryptedSuccess = !messageBodyText.includes("Shared Secret Key Misalignment");
    }

    if (!isMe && mobileSelectedLang !== "en" && !isInlineMediaContent) {
        messageBodyText = await translateTextForMobile(messageBodyText, mobileSelectedLang); 
    }

    // 3. YOUR CUSTOM ACTION PILLS
    let actionPillMarkup = "";
    if (!!isMe === false && !isInlineMediaContent) { 
        actionPillMarkup = `
            <div class="message-actions" id="actions-${key}" style="margin-top: 5px; display: flex; gap: 8px;">
                <button class="pill-btn transcribe-btn-selector" onclick="triggerTranscribe('${key}', '${btoa(messageBodyText)}')">🗣️ Transcribe</button>
                <button class="pill-btn" onclick="triggerTranslation('${key}', '${btoa(messageBodyText)}')"><i class="fa-solid fa-wand-magic-sparkles"></i> Translate AI</button>
            </div>
        `;
    }

    // 4. YOUR CUSTOM SECURE LOCK TAGS
    let secureLockMarkupTag = wasMessageDecryptedSuccess 
        ? `<div class="e2ee-signature-tag"><i class="fa-solid fa-lock" style="font-size:0.55rem; margin-right:3px;"></i>E2EE Decrypted</div>` 
        : (m.encrypted && !isInlineMediaContent ? `<div class="e2ee-signature-tag" style="color:#ef4444;"><i class="fa-solid fa-lock-open" style="font-size:0.55rem; margin-right:3px;"></i>Encrypted Line Locked</div>` : '');

    // 5. YOUTUBE & LINK DETECTOR REGEX
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const ytMatch = messageBodyText.match(youtubeRegex);
    const generalLinkRegex = /(https?:\/\/[^\s]+)/g;
    const safeDomains = ["youtube.com", "youtu.be", "google.com", "github.com", "linkedin.com"];

    // 6. DYNAMIC LAYOUT COMPILED BUBBLE CONTROLLER
    let bubbleContentInnerMarkup = "";
    
    if (isInlineMediaContent) {
        bubbleContentInnerMarkup = `
            <div class="msg-inline-media-container" onclick="launchStandaloneAttachmentZoomView('${btoa(m.text)}')">
                <img src="${m.text}">
            </div>
        `;
    } else if (ytMatch && ytMatch[1]) {
        const ytVideoId = ytMatch[1];
        bubbleContentInnerMarkup = `
            <div class="msg-text-payload" id="text-${key}" style="margin-bottom: 8px;">
                ${escapeHTML(messageBodyText.replace(ytMatch[0], '').trim())}
            </div>
            <div class="msg-inline-media-container" style="border-radius: 8px; overflow: hidden; margin-top: 4px;">
                <iframe width="100%" height="200" src="https://www.youtube.com/embed/${ytVideoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></iframe>
            </div>
        `;
    } else if (messageBodyText.match(generalLinkRegex)) {
        let processedText = escapeHTML(messageBodyText).replace(generalLinkRegex, (url) => {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace('www.', '');
                if (safeDomains.includes(domain)) {
                    return `<a href="${url}" target="_blank" class="safe-link">${url}</a>`;
                } else {
                    return `
                        <div class="cyber-warning-box">
                            <div class="cyber-warning-header">
                                <i class="fa-solid fa-triangle-exclamation"></i> Security Alert
                            </div>
                            <span style="color: rgba(255,255,255,0.7); display: block; margin-bottom: 6px; line-height: 1.3;">
                                Unverified external link. Do not share OTPs, passwords, or install APKs from this source.
                            </span>
                            <a href="${url}" target="_blank" class="cyber-warning-link">${url}</a>
                        </div>
                    `;
                }
            } catch(e) { return url; }
        });
        bubbleContentInnerMarkup = `
            <div class="msg-text-payload" id="text-${key}">
                ${processedText}
            </div>
        `;
    } else {
        bubbleContentInnerMarkup = `
            <div class="msg-text-payload" id="text-${key}">
                ${escapeHTML(messageBodyText)}
            </div>
        `;
    }

    // 7. INJECT DELETE BUTTON ONLY FOR MESSAGES YOU SENT
    let deleteBtnMarkup = isMe ? `<button onclick="deleteMessage('${key}')" class="delete-msg-btn" title="Delete Payload"><i class="fa-solid fa-trash-can"></i></button>` : '';

    // 8. FINAL BUBBLE ASSEMBLY
    row.innerHTML = `
        <div class="msg-bubble">
            ${bubbleContentInnerMarkup}
            ${secureLockMarkupTag}
            ${actionPillMarkup}
            <div class="msg-meta">
                ${formatTime(m.time)}
                ${deleteBtnMarkup}
                ${isMe ? getTicks(m.status) : ""}
            </div>
        </div>
    `;
    
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
}

// =========================================================================
// 💎 MARK SEEN PIPELINE
// =========================================================================
function markSeen() {
    if (!chatWith || !me) return;
    const id = chatId(me, chatWith);
    db.ref("chats/" + id).once("value", snap => {
        snap.forEach(child => {
            const m = child.val();
            if (m.sender !== me && m.status !== "seen") {
                child.ref.update({ status: "seen" });
            }
        });
    });
}
// =========================================================================
// 💎 VERNACULAR AI PIPELINES
// =========================================================================
async function triggerTranscribe(messageKey, encryptedPayload) {
    const originalText = atob(encryptedPayload);
    const selectedLanguage = document.getElementById("myDisplayLanguage") ? document.getElementById("myDisplayLanguage").value : "hi";
    const transcribeBtn = document.querySelector(`#actions-${messageKey} .transcribe-btn-selector`);
    if (transcribeBtn) transcribeBtn.innerHTML = `⏳ Loading Audio...`;
    try {
        const response = await fetch('http://localhost:5000/api/ai/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: originalText, lang: selectedLanguage }) });
        const data = await response.json();
        if (data.audioData) {
            const player = new Audio(`data:audio/mp3;base64,${data.audioData}`);
            player.play();
            if (transcribeBtn) transcribeBtn.innerHTML = `🗣️ Transcribe`;
        } else { if (transcribeBtn) transcribeBtn.innerHTML = `❌ Error`; }
    } catch (err) { if (transcribeBtn) transcribeBtn.innerHTML = `❌ Offline`; }
}

async function triggerTranslation(messageKey, encryptedPayload) {
    const originalText = atob(encryptedPayload);
    const targetDisplayZone = document.getElementById(`text-${messageKey}`);
    const selectedLanguage = document.getElementById("myDisplayLanguage") ? document.getElementById("myDisplayLanguage").value : "hi";
    if (!targetDisplayZone) return;
    targetDisplayZone.innerHTML = `<span class="ai-loading" style="color:var(--accent-blue, #53bdeb); font-size:0.8rem; font-style:italic;">Querying Indic Translation Matrix...</span>`;
    const actionsBox = document.getElementById(`actions-${messageKey}`);
    if (actionsBox) actionsBox.style.display = "none";
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${selectedLanguage}&dt=t&q=${encodeURIComponent(originalText)}`)}`);
        const rawData = await response.json();
        const parsedData = JSON.parse(rawData.contents);
        let translatedText = "";
        if (parsedData && parsedData[0]) { parsedData[0].forEach(s => { if (s[0]) translatedText += s[0]; }); }
        if (!translatedText) translatedText = originalText;
        targetDisplayZone.innerHTML = `<span class="translated-label" style="color:var(--accent-blue, #53bdeb); font-size:0.72rem; font-weight:600; display:block; margin-bottom:2px;">✨ Translated AI:</span><div class="translated-body">${escapeHTML(translatedText)}</div><small style="color:rgba(255,255,255,0.3); font-size:0.7rem; display:block; margin-top:4px;">Original: ${escapeHTML(originalText)}</small>`;
    } catch (err) { targetDisplayZone.innerHTML = `${escapeHTML(originalText)} <br><small style="color:#ef4444; font-size:0.7rem;">[Translation pipeline error]</small>`; if (actionsBox) actionsBox.style.display = "flex"; }
}

function setTyping(state) {
    if (!me || !chatWith) return;
    db.ref("typing/" + me).set({ to: chatWith, typing: state });
}

document.getElementById("message").addEventListener("input", () => {
    setTyping(true);
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => { setTyping(false); }, 1400);
});

function listenTyping() {
    if (!me) return;
    
    // Listen ONLY to the node where someone is typing to YOU
    db.ref("typing").orderByChild("to").equalTo(me).on("value", snap => {
        const data = snap.val();
        let isTyping = false;
        
        if (data) {
            // Check if anyone in the list is typing to 'me'
            Object.values(data).forEach(userStatus => {
                if (userStatus.sender === chatWith && userStatus.typing) {
                    isTyping = true;
                }
            });
        }
        
        const indicator = document.getElementById("typingIndicator");
        if (indicator) indicator.style.display = isTyping ? "block" : "none";
    });
}
// =========================================================================
// 💎 WEBRTC AV SIGNALING LAYER (STEALTH SYNC INTEGRATED)
// =========================================================================
function startCall() { startRealtimeCall(false); }
function startVideoCall() { startRealtimeCall(true); }

async function startRealtimeCall(video = false) {
    if (!chatWith) return;
    currentCallId = chatId(me, chatWith);
    remoteIceCandidatesQueue = [];

    configureCallUIElements(chatWith, "Calling Peer...");

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        document.getElementById("localVideo").srcObject = localStream;

        peerConnection = new RTCPeerConnection(servers);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event => {
            const remoteVideo = document.getElementById("remoteVideo");
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                document.getElementById("callStatus").innerText = "CONNECTED LINE";
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                db.ref(`calls/${currentCallId}/offerCandidates`).push(JSON.stringify(event.candidate));
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const callPayload = {
            caller: me,
            receiver: chatWith,
            offer: JSON.stringify(offer),
            type: video ? "video" : "audio",
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await db.ref("calls/" + currentCallId).set(callPayload);
        listenForAnswer();
    } catch (err) {
        console.error("AV Initialization Terminal Fault:", err);
        alert("Media Interface access denied. Check device configuration profiles.");
        endCall();
    }
}

function listenForIncomingCalls() {
    db.ref("calls").on("child_added", async snap => {
        const data = snap.val();
        if (!data || data.receiver !== me) return;
        if (data.timestamp && Date.now() - data.timestamp > 45000) return;

        currentCallId = snap.key;
        remoteIceCandidatesQueue = [];
        const ringer = document.getElementById("ringtone");
        
        try { ringer.play(); } catch(e){}

        const accept = confirm(`Incoming synchronization channel requested by ${data.caller}. Open pipeline?`);
        ringer.pause();
        ringer.currentTime = 0;

        if (!accept) {
            db.ref("calls/" + currentCallId).remove();
            return;
        }

        configureCallUIElements(data.caller, "STABILIZING CHANNEL...");

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: data.type === "video" });
            document.getElementById("localVideo").srcObject = localStream;

            peerConnection = new RTCPeerConnection(servers);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = event => {
                const remoteVideo = document.getElementById("remoteVideo");
                if (remoteVideo.srcObject !== event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    document.getElementById("callStatus").innerText = "CONNECTED LINE";
                }
            };

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    db.ref(`calls/${currentCallId}/answerCandidates`).push(JSON.stringify(event.candidate));
                }
            };

            const offer = JSON.parse(data.offer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await db.ref(`calls/${currentCallId}`).update({ answer: JSON.stringify(answer) });

            // Process accumulated connection candidates safely after description processing completes
            processBufferedRemoteCandidates();

            db.ref(`calls/${currentCallId}/offerCandidates`).on("child_added", s => {
                const candidateData = JSON.parse(s.val());
                if (peerConnection && peerConnection.remoteDescription) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => {});
                } else {
                    remoteIceCandidatesQueue.push(candidateData);
                }
            });
            
            db.ref(`calls/${currentCallId}`).on("value", s => {
                if (!s.exists()) teardownCallState();
            });

        } catch (err) {
            console.error("Media Channel Failure:", err);
            endCall();
        }
    });
}

function listenForAnswer() {
    db.ref(`calls/${currentCallId}/answer`).on("value", async snap => {
        const answer = snap.val();
        if (!answer || !peerConnection) return;
        if (peerConnection.signalingState === "stable") return;
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));
        processBufferedRemoteCandidates();
    });

    db.ref(`calls/${currentCallId}/answerCandidates`).on("child_added", snap => {
        const candidateData = JSON.parse(snap.val());
        if (peerConnection && peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => {});
        } else {
            remoteIceCandidatesQueue.push(candidateData);
        }
    });

    db.ref(`calls/${currentCallId}`).on("value", s => {
        if (!s.exists()) teardownCallState();
    });
}

// Flushes the candidate buffer out to clear processing race conditions on smart devices
function processBufferedRemoteCandidates() {
    while (remoteIceCandidatesQueue.length > 0) {
        const candidateData = remoteIceCandidatesQueue.shift();
        if (peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => {});
        }
    }
}

function endCall() {
    if (currentCallId) {
        db.ref("calls/" + currentCallId).remove();
    }
    teardownCallState();
}

function teardownCallState() {
    document.getElementById("ringtone").pause();
    document.getElementById("callScreen").style.display = "none";
    remoteIceCandidatesQueue = [];
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    isMuted = false;
    videoEnabled = true;
    updateBtnUI("muteBtn", true, '<i class="fa-solid fa-microphone"></i>');
    updateBtnUI("videoBtn", true, '<i class="fa-solid fa-video"></i>');
}

function handleMuteToggle() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    updateBtnUI("muteBtn", !isMuted, isMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>');
}

function handleVideoToggle() {
    if (!localStream) return;
    videoEnabled = !videoEnabled;
    localStream.getVideoTracks().forEach(t => t.enabled = videoEnabled);
    updateBtnUI("videoBtn", videoEnabled, videoEnabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>');
}

// ================= HEARTBEAT NODE PRESENCE LAYER =================
function startPresence() {
    const myPresenceRef = db.ref("users/" + me);
    
    myPresenceRef.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    presenceIntervalId = setInterval(() => {
        myPresenceRef.update({
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    }, 8000);
}

function logout() {
    clearInterval(presenceIntervalId);
    if (me) {
        db.ref("users/" + me).update({
            online: false,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            location.reload();
        });
    } else {
        location.reload();
    }
}


// =========================================================================
// 🛡️ PROJECT X-25 SENTINEL: ENTROPY SCANNER
// =========================================================================
function scanPayloadForThreats(payload) {
    const data = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
    const len = data.length;
    if (len === 0) return true;
    const frequencies = {};
    for (let i = 0; i < len; i++) frequencies[data[i]] = (frequencies[data[i]] || 0) + 1;
    let entropy = 0;
    for (const byte in frequencies) {
        const p = frequencies[byte] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy < 7.5; // Sentinel Threshold
}

function renderWarningMessage(text) {
    const box = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.className = "cyber-warning-box";
    div.innerHTML = `<div class="cyber-warning-header"><i class="fa-solid fa-shield-halved"></i> X-25 SENTINEL ALERT</div>${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// =========================================================================
// 💎 WEBRTC AV SIGNALING LAYER (STEALTH SYNC + SENTINEL INTEGRATED)
// =========================================================================

function setupDataChannel(pc) {
    dataChannel = pc.createDataChannel("secureMatrixTunnel");
    dataChannel.onopen = () => console.log("🔒 Stealth Tunnel Active: P2P Data Enabled.");
    dataChannel.onmessage = (event) => {
        const incomingData = JSON.parse(event.data);
        // 🛡️ SENTINEL SCAN BEFORE RENDERING
        if (scanPayloadForThreats(JSON.stringify(incomingData))) {
            renderMessage(incomingData, false, Date.now());
        } else {
            renderWarningMessage("HIGH ENTROPY DETECTED: Payload blocked to prevent code injection.");
        }
    };
}

function startCall() { startRealtimeCall(false); }
function startVideoCall() { startRealtimeCall(true); }

async function startRealtimeCall(video = false) {
    if (!chatWith) return;
    currentCallId = chatId(me, chatWith);
    remoteIceCandidatesQueue = [];
    configureCallUIElements(chatWith, "Calling Peer...");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        document.getElementById("localVideo").srcObject = localStream;
        peerConnection = new RTCPeerConnection(servers);
        setupDataChannel(peerConnection); // 🚀 Initialize Tunnel
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = event => {
            const remoteVideo = document.getElementById("remoteVideo");
            if (remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                document.getElementById("callStatus").innerText = "CONNECTED LINE";
            }
        };
        peerConnection.onicecandidate = event => {
            if (event.candidate) db.ref(`calls/${currentCallId}/offerCandidates`).push(JSON.stringify(event.candidate));
        };
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await db.ref("calls/" + currentCallId).set({
            caller: me, receiver: chatWith, offer: JSON.stringify(offer),
            type: video ? "video" : "audio", timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        listenForAnswer();
    } catch (err) {
        console.error("AV Initialization Terminal Fault:", err);
        alert("Media Interface access denied.");
        endCall();
    }
}

function listenForIncomingCalls() {
    db.ref("calls").on("child_added", async snap => {
        const data = snap.val();
        if (!data || data.receiver !== me) return;
        if (data.timestamp && Date.now() - data.timestamp > 45000) return;
        currentCallId = snap.key;
        remoteIceCandidatesQueue = [];
        const ringer = document.getElementById("ringtone");
        try { ringer.play(); } catch(e){}
        const accept = confirm(`Incoming synchronization channel requested by ${data.caller}. Open pipeline?`);
        ringer.pause(); ringer.currentTime = 0;
        if (!accept) { db.ref("calls/" + currentCallId).remove(); return; }
        configureCallUIElements(data.caller, "STABILIZING CHANNEL...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: data.type === "video" });
            document.getElementById("localVideo").srcObject = localStream;
            peerConnection = new RTCPeerConnection(servers);
            // 🛡️ Listen for incoming DataChannel + SENTINEL SCAN
            peerConnection.ondatachannel = (event) => {
                dataChannel = event.channel;
                dataChannel.onmessage = (e) => {
                    const incoming = JSON.parse(e.data);
                    if (scanPayloadForThreats(JSON.stringify(incoming))) {
                        renderMessage(incoming, false, Date.now());
                    } else {
                        renderWarningMessage("HIGH ENTROPY DETECTED: Payload blocked.");
                    }
                };
            };
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            peerConnection.ontrack = event => {
                const remoteVideo = document.getElementById("remoteVideo");
                if (remoteVideo.srcObject !== event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    document.getElementById("callStatus").innerText = "CONNECTED LINE";
                }
            };
            peerConnection.onicecandidate = event => {
                if (event.candidate) db.ref(`calls/${currentCallId}/answerCandidates`).push(JSON.stringify(event.candidate));
            };
            const offer = JSON.parse(data.offer);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            await db.ref(`calls/${currentCallId}`).update({ answer: JSON.stringify(answer) });
            processBufferedRemoteCandidates();
            db.ref(`calls/${currentCallId}/offerCandidates`).on("child_added", s => {
                const candidateData = JSON.parse(s.val());
                if (peerConnection && peerConnection.remoteDescription) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(e => {});
                } else {
                    remoteIceCandidatesQueue.push(candidateData);
                }
            });
            db.ref(`calls/${currentCallId}`).on("value", s => { if (!s.exists()) teardownCallState(); });
        } catch (err) {
            console.error("Media Channel Failure:", err);
            endCall();
        }
    });
}
// =========================================================================
// 💎 INSTAGRAM STATUS NOTES LOGIC PLATFORM
// =========================================================================
function toggleStatusNotePopup() { const popup = document.getElementById("statusNoteConfigPopup"); if (!popup) return; const isHidden = popup.style.display === "none" || popup.style.display === ""; popup.style.display = isHidden ? "flex" : "none"; if (isHidden) { document.getElementById("statusNoteInput").focus(); } }
function publishProfileStatusNote() {
    const noteText = document.getElementById("statusNoteInput").value.trim(); const rawSpotifyUrl = document.getElementById("statusSpotifyInput").value.trim(); if (!noteText) { alert("Please enter what is on your mind before sharing!"); return; }
    let trackId = ""; if (rawSpotifyUrl.includes("track/")) { const matches = rawSpotifyUrl.match(/track\/([a-zA-Z0-9]+)/); if (matches && matches[1]) trackId = matches[1]; } else if (rawSpotifyUrl.length > 5) { trackId = rawSpotifyUrl; }
    db.ref(`statusNotes/${me}`).set({ note: noteText, spotifyTrackId: trackId, timestamp: firebase.database.ServerValue.TIMESTAMP }).then(() => { document.getElementById("statusNoteInput").value = ""; document.getElementById("statusSpotifyInput").value = ""; toggleStatusNotePopup(); }).catch(err => {});
}

function deleteProfileStatusNote() {
    if (!me) return;
    if (confirm("Clear your current status note and music track?")) {
        db.ref(`statusNotes/${me}`).remove().then(() => {
            alert("🧹 Status note erased!");
            const floatingBubble = document.getElementById("myFloatingBubbleNote");
            const trackDisplay = document.getElementById("myProfileTrackText");
            if (floatingBubble) { floatingBubble.innerText = ""; floatingBubble.style.display = "none"; }
            if (trackDisplay) { trackDisplay.innerHTML = `<i class="fa-solid fa-signal" style="font-size: 0.72rem; color: #22c55e;"></i> System Stream Active`; }
            toggleStatusNotePopup();
        }).catch(err => console.error("Purge failure:", err));
    }
}

function listenForNetworkStatusNotes() {
    if (!me) return;
    db.ref(`statusNotes/${me}`).on("value", snap => {
        const data = snap.val(); const floatingBubble = document.getElementById("myFloatingBubbleNote"); const trackDisplay = document.getElementById("myProfileTrackText");
        if (data) {
            if (floatingBubble) { floatingBubble.innerText = data.note; floatingBubble.style.display = "block"; }
            if (trackDisplay) { trackDisplay.innerHTML = data.spotifyTrackId ? `<a href="https://open.spotify.com/track/$${data.spotifyTrackId}" target="_blank" style="color:#1ed760; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i class="fa-brands fa-spotify"></i> Live Track Linked</a>` : `<span style="color:rgba(255,255,255,0.4);"><i class="fa-regular fa-comment-dots"></i> ${data.note}</span>`; }
        }
    });
    db.ref("statusNotes").on("value", snap => { triggerSyncNotesOnDirectory(); });
}

function triggerSyncNotesOnDirectory() {
    db.ref("statusNotes").once("value", snap => {
        const globalNotesMatrix = snap.val() || {}; const targetContactCards = document.querySelectorAll(".chat-item");
        targetContactCards.forEach(card => {
            const nameField = card.querySelector(".chat-name"); if (!nameField) return; const cardUserPhone = nameField.innerText.trim(); const matchingStatus = globalNotesMatrix[cardUserPhone];
            const oldNoteRow = card.querySelector(".contact-insta-note-row"); if (oldNoteRow) oldNoteRow.remove();
            if (matchingStatus) {
                const noteRowElement = document.createElement("div"); noteRowElement.className = "contact-insta-note-row"; noteRowElement.style.cssText = "font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 6px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); min-width: 0; width: 100%; box-sizing: border-box;";
                let trackActionBadge = ""; if (matchingStatus.spotifyTrackId) { trackActionBadge = `<a href="https://open.spotify.com/track/$${matchingStatus.spotifyTrackId}" target="_blank" onclick="event.stopPropagation();" style="color: #1ed760; background: rgba(30,215,96,0.1); padding: 2px 6px; border-radius: 10px; font-size: 0.62rem; text-decoration: none; display: flex; align-items: center; gap: 3px; font-weight: 600; flex-shrink: 0; margin-left: 6px;"><i class="fa-brands fa-spotify"></i> Song</a>`; }
                noteRowElement.innerHTML = `<span style="font-style: italic; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1; min-width: 0; padding-right: 4px;">"${matchingStatus.note}"</span>${trackActionBadge}`;
                const chatInfoZone = card.querySelector(".chat-info"); if (chatInfoZone) chatInfoZone.appendChild(noteRowElement);
            }
        });
    });
}

// =========================================================================
// 💎 STANDALONE STORIES ROUTING ENGINE & INTERACTIVE DRAG PHYSICAL CONTROLS
// =========================================================================
function launchStandaloneStoriesPage() {
    const stage = document.getElementById("storiesMainStage");
    const chatPage = document.getElementById("chatPage");
    const drawer = document.getElementById("storiesSidebarDrawer");
    
    if (!stage || !chatPage || !drawer) return;
    
    chatPage.style.display = "none";
    stage.style.display = "block";
    drawer.style.left = "-320px"; 
    
    const myDisplayCircle = document.getElementById("myStoryProfileDisplayCircle");
    if (myDisplayCircle && me && !myDisplayCircle.querySelector('img')) {
        myDisplayCircle.innerText = me.substring(0,2).toUpperCase();
    }

    initializePhysicalDragEngine(); 
    loadIndicNetworkStories(); 
}

function exitStandaloneStoriesPage() {
    const stage = document.getElementById("storiesMainStage");
    const chatPage = document.getElementById("chatPage");
    if (stage && chatPage) {
        stage.style.display = "none";
        chatPage.style.display = "flex";
    }
}

function initializePhysicalDragEngine() {
    const drawer = document.getElementById("storiesSidebarDrawer");
    const handle = document.getElementById("dragHandlePill");
    const overlay = document.getElementById("drawerOverlay");
    const actionHub = document.getElementById("drawerActionHub");
    const arrowIcon = document.getElementById("handleArrowIcon");

    if (!drawer || !handle || !overlay || !actionHub) return;

    let isDraggingActive = false;
    let baselineStartX = 0;
    let currentDrawerLeftX = -320; 
    
    const maxOpenWidthX = 0;      
    const maxCloseWidthX = -320;  

    handle.onpointerdown = null;
    window.onpointermove = null;
    window.onpointerup = null;

    handle.onpointerdown = function(event) {
        isDraggingActive = true;
        baselineStartX = event.clientX - currentDrawerLeftX;
        drawer.style.transition = "none"; 
        overlay.style.display = "block";
        handle.setPointerCapture(event.pointerId);
    };

    window.onpointermove = function(event) {
        if (!isDraggingActive) return;

        let computedLeftPosition = event.clientX - baselineStartX;
        if (computedLeftPosition > maxOpenWidthX) computedLeftPosition = maxOpenWidthX;
        if (computedLeftPosition < maxCloseWidthX) computedLeftPosition = maxCloseWidthX;

        currentDrawerLeftX = computedLeftPosition;
        drawer.style.left = `${currentDrawerLeftX}px`;

        const openRatioPercentage = (currentDrawerLeftX + 320) / 320; 
        overlay.style.opacity = openRatioPercentage;

        if (openRatioPercentage >= 0.85) {
            actionHub.style.opacity = "1";
            actionHub.style.pointerEvents = "auto";
            if (arrowIcon) arrowIcon.style.transform = "rotate(180deg)";
        } else {
            actionHub.style.opacity = "0";
            actionHub.style.pointerEvents = "none";
            if (arrowIcon) arrowIcon.style.transform = "rotate(0deg)";
        }
    };

    window.onpointerup = function(event) {
        if (!isDraggingActive) return;
        isDraggingActive = false;
        
        drawer.style.transition = "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)"; 

        if (currentDrawerLeftX > -160) {
            currentDrawerLeftX = maxOpenWidthX;
            drawer.style.left = `${maxOpenWidthX}px`;
            overlay.style.opacity = "1";
            actionHub.style.opacity = "1";
            actionHub.style.pointerEvents = "auto";
            if (arrowIcon) arrowIcon.style.transform = "rotate(180deg)";
        } else {
            currentDrawerLeftX = maxCloseWidthX;
            drawer.style.left = `${maxCloseWidthX}px`;
            overlay.style.opacity = "0";
            overlay.style.display = "none";
            actionHub.style.opacity = "0";
            actionHub.style.pointerEvents = "none";
            if (arrowIcon) arrowIcon.style.transform = "rotate(0deg)";
            
            const uploadBtn = document.getElementById("masterUploadBtn");
            const dropdownMenu = document.getElementById("uploadDropdownMenu");
            if (uploadBtn && dropdownMenu) {
                uploadBtn.classList.remove("rotate");
                dropdownMenu.style.display = "none";
            }
        }
    };
}

function toggleUploadDropdownMenu() {
    const btn = document.getElementById("masterUploadBtn");
    const menu = document.getElementById("uploadDropdownMenu");
    if (!btn || !menu) return;
    
    const isOpen = btn.classList.contains("rotate");
    if (isOpen) {
        btn.classList.remove("rotate");
        menu.style.display = "none";
    } else {
        btn.classList.add("rotate");
        menu.style.display = "flex";
    }
}

function triggerStoryUploadProcess() {
    const btn = document.getElementById("masterUploadBtn");
    const menu = document.getElementById("uploadDropdownMenu");
    if (btn && menu) {
        btn.classList.remove("rotate");
        menu.style.display = "none";
    }
    document.getElementById("storyMediaUploader").click();
}

function uploadStoryStatusMatrix(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const originalImageInstance = new Image();
        originalImageInstance.src = e.target.result;
        
        originalImageInstance.onload = function() {
            const maximumTargetWidth = 800;
            let finalWidth = originalImageInstance.width;
            let finalHeight = originalImageInstance.height;

            if (finalWidth > maximumTargetWidth) {
                finalHeight = Math.round((maximumTargetWidth / finalWidth) * finalHeight);
                finalWidth = maximumTargetWidth;
            }

            const processingCanvas = document.createElement("canvas");
            processingCanvas.width = finalWidth;
            processingCanvas.height = finalHeight;

            const canvasContext = processingCanvas.getContext("2d");
            canvasContext.drawImage(originalImageInstance, 0, 0, finalWidth, finalHeight);

            const compressedLightweightString = processingCanvas.toDataURL("image/jpeg", 0.4);

            db.ref(`stories/${me}`).set({
                phone: me,
                mediaData: compressedLightweightString,
                timestamp: Date.now()
            }).then(() => {
                alert("🚀 Compressed story active across the network matrix!");
                
                const drawer = document.getElementById("storiesSidebarDrawer");
                const overlay = document.getElementById("drawerOverlay");
                const actionHub = document.getElementById("drawerActionHub");
                const arrowIcon = document.getElementById("handleArrowIcon");
                
                if (drawer) {
                    drawer.style.transition = "left 0.2s ease";
                    drawer.style.left = "0px";
                    if (overlay) { overlay.style.display = "block"; overlay.style.opacity = "1"; }
                    if (actionHub) { actionHub.style.opacity = "1"; actionHub.style.pointerEvents = "auto"; }
                    if (arrowIcon) arrowIcon.style.transform = "rotate(180deg)";
                }
            }).catch(err => console.error("Database tracking fault:", err));
        };
    };
    reader.readAsDataURL(file);
}

function deleteMyActiveStoryContent() {
    if (!me) return;
    toggleUploadDropdownMenu(); 
    if (confirm("Do you want to delete your active story/post/reel?")) {
        db.ref(`stories/${me}`).remove().then(() => {
            alert("🗑️ Story data removed from cloud streams!");
            const myDisplayCircle = document.getElementById("myStoryProfileDisplayCircle");
            if (myDisplayCircle) {
                myDisplayCircle.innerHTML = me.substring(0,2).toUpperCase();
                myDisplayCircle.onclick = () => triggerStoryUploadProcess();
            }
        }).catch(err => console.error("Purge failure:", err));
    }
}

function loadIndicNetworkStories() {
    db.ref("stories").on("value", snap => {
        const verticalDeck = document.getElementById("verticalDynamicStoriesDeck");
        const myDisplayCircle = document.getElementById("myStoryProfileDisplayCircle");
        
        if (!verticalDeck) return;
        verticalDeck.innerHTML = "";

        const currentEpochNow = Date.now();
        const absolute24HoursLimitWindow = 24 * 60 * 60 * 1000;

        snap.forEach(child => {
            const data = child.val();
            if (!data || !data.phone) return;

            if (currentEpochNow - data.timestamp > absolute24HoursLimitWindow) {
                child.ref.remove();
                return;
            }

            if (data.phone === me) {
                if (myDisplayCircle) {
                    myDisplayCircle.innerHTML = `<img src="${data.mediaData}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    myDisplayCircle.onclick = () => launchImmersiveStoryViewer(btoa(me), btoa(data.mediaData));
                }
                return; 
            }

            verticalDeck.innerHTML += `
                <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.04); display:flex; align-items:center; gap:14px; cursor:pointer; transition:background 0.2s;" 
                     onclick="launchImmersiveStoryViewer('${btoa(data.phone)}', '${btoa(data.mediaData)}')"
                     onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                     onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                    <div style="width: 50px; height: 50px; border-radius: 50%; padding: 2px; border: 2px solid #53bdeb; display: flex; align-items: center; justify-content: center; background: #121214; flex-shrink:0;">
                        <div style="width:100%; height:100%; border-radius:50%; background:#222; color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:600; overflow:hidden;">
                            <img src="${data.mediaData}" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                    </div>
                    <div style="min-width:0; flex:1;">
                        <h5 style="margin:0 0 2px 0; font-size:0.85rem; font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${data.phone}</h5>
                        <p style="margin:0; font-size:0.7rem; color:rgba(255,255,255,0.3);">Recent broadcast transmission</p>
                    </div>
                </div>
            `;
        });

        if (!snap.hasChild(me) && myDisplayCircle) {
            myDisplayCircle.innerHTML = me ? me.substring(0,2).toUpperCase() : "U";
            myDisplayCircle.onclick = () => triggerStoryUploadProcess();
        }
    });
}

function launchImmersiveStoryViewer(encodedPhone, encodedMedia) {
    const targetPhone = atob(encodedPhone); const targetMedia = atob(encodedMedia);
    const modal = document.getElementById("immersiveStoryViewer"); const canvas = document.getElementById("storyViewerMediaCanvas"); const bar = document.getElementById("storyProgressBar"); const avatar = document.getElementById("storyViewerAvatar"); const title = document.getElementById("storyViewerTitle");
    if (!modal || !canvas) return;
    avatar.innerText = targetPhone.substring(0,2).toUpperCase(); title.innerText = targetPhone; canvas.src = targetMedia; modal.style.display = "flex";
    setTimeout(() => { bar.style.width = "100%"; }, 50);
    window.storyAutoDismissTracker = setTimeout(() => { closeImmersiveStoryViewer(); }, 4050);
}

function closeImmersiveStoryViewer() {
    const modal = document.getElementById("immersiveStoryViewer"); const bar = document.getElementById("storyProgressBar");
    if (modal) modal.style.display = "none";
    if (bar) { bar.style.transition = "none"; bar.style.width = "0%"; setTimeout(() => { bar.style.transition = "width 4s linear"; }, 50); }
    clearTimeout(window.storyAutoDismissTracker);
}

function closeDedicatedReelsPage() {
    const reelsPage = document.getElementById("dedicatedReelsPage");
    if (reelsPage) reelsPage.style.display = "none";
}

// =========================================================================
// 💎 MECHANICAL SETTINGS ROUTING CONTROLLERS
// =========================================================================
function launchMechanicalSettingsPage() {
    const settingsBtn = document.getElementById("sidebarSettingsCog");
    const settingsStage = document.getElementById("settingsMainStage");
    const primaryChatPage = document.getElementById("chatPage");
    const dataBadge = document.getElementById("settingsAccountIDBadge");

    if (!settingsBtn || !settingsStage || !primaryChatPage) return;

    settingsBtn.classList.remove("spin-counter");
    settingsBtn.classList.add("spin-clockwise");

    if (dataBadge) dataBadge.innerText = me ? me : "Unassigned Guest";

    setTimeout(() => {
        primaryChatPage.style.display = "none";
        settingsStage.style.display = "block";
        const savedTheme = localStorage.getItem("signal_selected_cinematic_theme") || "oled";
        updateThemeSelectionBordersInSettings(savedTheme);
    }, 280);
}

function exitMechanicalSettingsPage() {
    const settingsBtn = document.getElementById("sidebarSettingsCog");
    const settingsStage = document.getElementById("settingsMainStage");
    const primaryChatPage = document.getElementById("chatPage");

    if (!settingsBtn || !settingsStage || !primaryChatPage) return;

    settingsStage.style.display = "none";
    primaryChatPage.style.display = "flex";

    setTimeout(() => {
        settingsBtn.classList.remove("spin-clockwise");
        settingsBtn.classList.add("spin-counter");
    }, 50);
}

// =========================================================================
// 💎 GLOBAL CINEMATIC THEME ENGINE CONFIGURATOR
// =========================================================================
function applyGlobalCinematicTheme(themeKey) {
    const rootElement = document.documentElement;
    if (!rootElement) return;

    localStorage.setItem("signal_selected_cinematic_theme", themeKey);

    switch (themeKey) {
        case 'cyberpunk':
            rootElement.style.setProperty('--accent-blue', '#ff007f'); 
            rootElement.style.setProperty('--accent-purple', '#a855f7');
            document.body.style.background = '#0d021a';
            break;
        case 'stealth':
            rootElement.style.setProperty('--accent-blue', '#22c55e'); 
            rootElement.style.setProperty('--accent-purple', '#84cc16');
            document.body.style.background = '#151716';
            break;
        case 'matrix':
            rootElement.style.setProperty('--accent-blue', '#00ff00'); 
            rootElement.style.setProperty('--accent-purple', '#00aa00');
            document.body.style.background = '#000000';
            break;
        case 'oled':
        default:
            rootElement.style.setProperty('--accent-blue', '#53bdeb'); 
            rootElement.style.setProperty('--accent-purple', '#a855f7'); 
            document.body.style.background = '#09090b';
            break;
    }
    updateThemeSelectionBordersInSettings(themeKey);
}

function updateThemeSelectionBordersInSettings(activeTheme) {
    const stage = document.getElementById("settingsMainStage");
    if (!stage) return;
    const themeButtons = stage.querySelectorAll("button[onclick^='applyGlobalCinematicTheme']");
    themeButtons.forEach(btn => {
        if (btn.getAttribute("onclick").includes(`'${activeTheme}'`)) {
            btn.style.borderColor = 'var(--accent-blue)';
            btn.style.boxShadow = '0 0 10px rgba(255,255,255,0.02)';
        } else {
            btn.style.borderColor = 'rgba(255,255,255,0.05)';
            btn.style.boxShadow = 'none';
        }
    });
}

// Auto load cached theme setup metrics natively on browser compilation
document.addEventListener("DOMContentLoaded", () => {
    const savedCachedThemeSetting = localStorage.getItem("signal_selected_cinematic_theme");
    if (savedCachedThemeSetting) {
        setTimeout(() => { applyGlobalCinematicTheme(savedCachedThemeSetting); }, 300);
    }
});

// =========================================================================
// 💎 CLIENT-SIDE END-TO-END ENCRYPTION (E2EE) CRYPTOGRAPHIC PROTOCOLS
// =========================================================================
function toggleEndToEndEncryptionMatrix() {
    if (!chatWith) {
        alert("Please tap on an active peer connection before setting up E2EE lines!");
        return;
    }

    const lockBtn = document.getElementById("e2eeLockBtn");
    const statusDot = document.getElementById("e2eeStatusDot");
    const activeLabel = document.getElementById("e2eeActiveLabel");

    if (!lockBtn) return;

    if (!isE2EEMatrixActive) {
        let promptKeyInput = prompt("🔑 Initialize Cryptographic E2EE Line:\nEnter a shared Room Security Key cipher value (both you and your peer must type the same key word to decipher messages):", "SignalMatrixKey");
        
        if (!promptKeyInput || promptKeyInput.trim() === "") {
            alert("Security Handshake initialization cancelled. Line remains open.");
            return;
        }

        cryptographicSecretKey = promptKeyInput.trim();
        isE2EEMatrixActive = true;

        lockBtn.classList.add("secure-active");
        if (statusDot) statusDot.style.display = "block";
        if (activeLabel) activeLabel.style.display = "inline-block";

        alert("🛡️ Cryptographic E2EE tunnel activated successfully! Outbound chat data will be scrambled prior to transmission.");
    } else {
        isE2EEMatrixActive = false;
        cryptographicSecretKey = "SIGNAL_MATRIX_PASSPHRASE_KEY";

        lockBtn.classList.remove("secure-active");
        if (statusDot) statusDot.style.display = "none";
        if (activeLabel) activeLabel.style.display = "none";

        alert("⚠️ End-to-End Encryption disarmed. Communication line is now running over unencrypted base streams.");
    }

    const box = document.getElementById("chatBox");
    if (box) box.innerHTML = "";
    loadMessages();
}

// 🧮 CORE CRYPTOGRAPHIC BLOCK ENGINES: VIGENÈRE MATRIX TEXT SCRAMBLER
function encryptStringPayloadCore(plainText, secretKey) {
    let encryptedResultStr = "";
    for (let index = 0; index < plainText.length; index++) {
        let charCodeText = plainText.charCodeAt(index);
        let charCodeKey = secretKey.charCodeAt(index % secretKey.length);
        encryptedResultStr += String.fromCharCode((charCodeText + charCodeKey) % 65536);
    }
    return btoa(encryptedResultStr); 
}

function decryptStringPayloadCore(scrambledBase64Text, secretKey) {
    try {
        let plainTextDecodedString = atob(scrambledBase64Text);
        let decryptedResultStr = "";
        for (let index = 0; index < plainTextDecodedString.length; index++) {
            let charCodeText = plainTextDecodedString.charCodeAt(index);
            let charCodeKey = secretKey.charCodeAt(index % secretKey.length);
            decryptedResultStr += String.fromCharCode((charCodeText - charCodeKey + 65536) % 65536);
        }
        return decryptedResultStr;
    } catch (faultExceptionError) {
        return "⚠️ [Unreadable Encrypted Payload Block: Shared Secret Key Misalignment]";
    }
}

// =========================================================================
// 📐 CHAT HEADER DRAWER CONTROLLER AND MECHANICAL ROTATORS
// =========================================================================
function toggleHeaderActionsDrawerMenu() {
    const triggerBtn = document.getElementById("headerThreeDotsTrigger");
    const drawerMenu = document.getElementById("headerActionMenuDrawer");
    
    if (!triggerBtn || !drawerMenu) return;
    
    const isCurrentlyHidden = drawerMenu.style.display === "none" || drawerMenu.style.display === "";
    
    if (isCurrentlyHidden) {
        drawerMenu.style.display = "flex";
        triggerBtn.classList.add("rotate-triangle"); // Transforms dots to triangle arrow asset
    } else {
        drawerMenu.style.display = "none";
        triggerBtn.classList.remove("rotate-triangle"); // Rolls back smoothly to original dots style
    }
}

// Global window event listener tracking to dismiss drawer instantly if a user clicks inside chat history area
document.addEventListener("pointerdown", (event) => {
    const drawerMenu = document.getElementById("headerActionMenuDrawer");
    const triggerBtn = document.getElementById("headerThreeDotsTrigger");
    if (!drawerMenu || !triggerBtn) return;
    
    if (!drawerMenu.contains(event.target) && !triggerBtn.contains(event.target)) {
        drawerMenu.style.display = "none";
        triggerBtn.classList.remove("rotate-triangle");
    }
});

// =========================================================================
// 📎 INLINE MULTIMEDIA MESSAGE ATTACHMENTS PIPELINE INTERCEPTORS
// =========================================================================
function processInlineChatAttachment(event) {
    const assetFile = event.target.files[0];
    if (!assetFile || !chatWith) return;

    const fileFileReader = new FileReader();
    fileFileReader.onload = function(readerEvent) {
        const imageHydratorNode = new Image();
        imageHydratorNode.src = readerEvent.target.result;
        
        imageHydratorNode.onload = function() {
            const maxInlineBoundsWidth = 600;
            let canvasRenderWidth = imageHydratorNode.width;
            let canvasRenderHeight = imageHydratorNode.height;

            if (canvasRenderWidth > maxInlineBoundsWidth) {
                canvasRenderHeight = Math.round((maxInlineBoundsWidth / canvasRenderWidth) * canvasRenderHeight);
                canvasRenderWidth = maxInlineBoundsWidth;
            }

            const dynamicHardwareCanvas = document.createElement("canvas");
            dynamicHardwareCanvas.width = canvasRenderWidth;
            dynamicHardwareCanvas.height = canvasRenderHeight;

            const processingContext2D = dynamicHardwareCanvas.getContext("2d");
            processingContext2D.drawImage(imageHydratorNode, 0, 0, canvasRenderWidth, canvasRenderHeight);

            const compressedBase64StringAsset = dynamicHardwareCanvas.toDataURL("image/jpeg", 0.45);
            const activeRoomIDToken = chatId(me, chatWith);

            db.ref("chats/" + activeRoomIDToken).push({
                sender: me,
                text: compressedBase64StringAsset,
                type: "image", 
                time: firebase.database.ServerValue.TIMESTAMP,
                status: "sent"
            }).then(() => {
                document.getElementById("chatInlineMediaUploader").value = "";
            }).catch(faultError => console.error("Media channel stream sync lock error:", faultError));
        };
    };
    fileFileReader.readAsDataURL(assetFile);
}

function launchStandaloneAttachmentZoomView(encodedBase64ImgPayload) {
    const targetsDecodedSrcString = atob(encodedBase64ImgPayload);
    const modalViewerStage = document.getElementById("immersiveStoryViewer");
    const viewerCanvasImageNode = document.getElementById("storyViewerMediaCanvas");
    const progressAnimationTrackerBar = document.getElementById("storyProgressBar");
    const avatarBadgePlaceholder = document.getElementById("storyViewerAvatar");
    const titleHeaderZoneDisplay = document.getElementById("storyViewerTitle");

    if (!modalViewerStage || !viewerCanvasImageNode) return;

    clearTimeout(window.storyAutoDismissTracker);

    if (avatarBadgePlaceholder) avatarBadgePlaceholder.innerText = "📎";
    if (titleHeaderZoneDisplay) titleHeaderZoneDisplay.innerText = "System Media Attachment";
    if (progressAnimationTrackerBar) progressAnimationTrackerBar.style.width = "100%";
    
    viewerCanvasImageNode.src = targetsDecodedSrcString;
    modalViewerStage.style.display = "flex";
}

// =========================================================================
// 💎 TRANSLATION AND FRAMEWORK HELPERS
// =========================================================================
async function translateTextForMobile(text, targetLang) {
    if (!text || targetLang === 'en') return text; 
    try {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`)}`);
        if (!response.ok) return text;
        const rawData = await response.json(); const parsedData = JSON.parse(rawData.contents);
        let translatedPhrase = ""; if (parsedData && parsedData[0]) { parsedData[0].forEach(s => { if (s[0]) translatedPhrase += s[0]; }); }
        return translatedPhrase || text;
    } catch (e) { return text; }
}

document.getElementById("myDisplayLanguage").addEventListener("change", () => { if (chatWith) { const box = document.getElementById("chatBox"); if (box) box.innerHTML = ""; loadMessages(); } });

function configureCallUIElements(peerPhone, statusText) { const callScreen = document.getElementById("callScreen"); const callName = document.getElementById("callName"); const callStatus = document.getElementById("callStatus"); if (callScreen) callScreen.style.display = "flex"; if (callName) callName.innerText = `Peer Connection: ${peerPhone}`; if (callStatus) declineStatusView(statusText); }
function declineStatusView(text) { const label = document.getElementById("callStatus"); if (label) label.innerText = text; }
function updateBtnUI(btnId, isActive, innerHTMLMarkup) { const targetBtn = document.getElementById(btnId); if (!targetBtn) return; targetBtn.innerHTML = innerHTMLMarkup; if (isActive) { targetBtn.style.background = "rgba(255, 255, 255, 0.15)"; targetBtn.style.color = "var(--text-main)"; } else { targetBtn.style.background = "rgba(239, 68, 68, 0.2)"; targetBtn.style.color = "#ef4444"; } }
defineEscapeStringMatrix = str => str ? str.replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">").replace(/"/g,"\"").replace(/'/g,"'") : "";
function escapeHTML(str) { return defineEscapeStringMatrix(str); }
function formatTime(ts) { if (!ts) return ""; const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function getTicks(status) { if (status === "sent") return '<i class="fa-solid fa-check" style="color:var(--text-secondary)"></i>'; if (status === "delivered") return '<i class="fa-solid fa-check-double" style="color:var(--text-secondary)"></i>'; if (status === "seen") return '<i class="fa-solid fa-check-double" style="color: var(--accent-blue)"></i>'; return ""; }
function onClickInputFocus() { setTimeout(() => { const box = document.getElementById("chatBox"); if (box) box.scrollTop = box.scrollHeight; }, 250); }
document.getElementById("message").addEventListener("focus", onClickInputFocus);

// =========================================================================
// 🗑️ MESSAGE DELETION PIPELINE
// =========================================================================
function deleteMessage(messageKey) {
    if (!chatWith || !me) return;
    
    // Safety lock: confirm before purging the data
    if (!confirm("Permanently delete this message from the matrix?")) return;

    const id = chatId(me, chatWith);
    
    // Target the specific message node in Firebase and wipe it
    db.ref("chats/" + id + "/" + messageKey).remove()
        .then(() => {
            // Instantly remove the bubble from the screen for a snappy UI
            const msgElement = document.getElementById(`msg-${messageKey}`);
            if (msgElement) {
                msgElement.style.transform = "scale(0.9)";
                msgElement.style.opacity = "0";
                setTimeout(() => msgElement.remove(), 200); // Smooth fade out
            }
        })
        .catch(err => console.error("Deletion failed:", err));
}

function renderWarningMessage(text) {
    const box = document.getElementById("chatBox");
    const div = document.createElement("div");
    div.className = "cyber-warning-box";
    div.innerHTML = `
        <div class="cyber-warning-header">
            <i class="fa-solid fa-shield-halved"></i> X-25 SENTINEL ALERT
        </div>
        ${text}
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight; // Auto-scroll to the alert
}


// =========================================================================
// 🛡️ PROJECT X-25: ANTI-EXFILTRATION ENGINE
// =========================================================================
document.addEventListener("visibilitychange", () => {
    const mask = document.getElementById("screenMask");
    if (document.hidden) {
        // App is hidden/backgrounded - Trigger Blackout
        mask.style.display = "flex";
        mask.innerText = "MATRIX TERMINAL LOCKED: PRIVACY MODE ACTIVE";
    } else {
        // App is back in focus
        mask.style.display = "none";
    }
});

// Detect window blurring (e.g., user clicking into a screen recording tool)
window.addEventListener("blur", () => {
    const mask = document.getElementById("screenMask");
    mask.style.display = "flex";
    mask.innerText = "SECURITY WARNING: WINDOW FOCUS LOST";
});

window.addEventListener("focus", () => {
    document.getElementById("screenMask").style.display = "none";
});