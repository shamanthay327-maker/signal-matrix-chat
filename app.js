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
function login() {
    const phone = document.getElementById("phone").value.trim();
    if (!phone) {
        alert("Please provide a phone code entry value.");
        return;
    }

    me = phone;
    document.getElementById("myPhoneDisplay").innerText = me;
    document.getElementById("myAvatar").innerText = me.substring(0,2).toUpperCase();
    
    // Update the custom Left Drawer Avatar Circle context placeholder string initially
    document.getElementById("myStoryProfileDisplayCircle").innerText = me.substring(0,2).toUpperCase();

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
        loadIndicNetworkStories();
        listenForNetworkStatusNotes();
    });
}

// =========================================================================
// 💎 FIXED DIRECTORY MANAGER WITH TIMESTAMP LIVENESS CHECK
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

function logout() {
    clearInterval(presenceIntervalId);
    if (me) {
        db.ref("users/" + me).update({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP }).then(() => { location.reload(); });
    } else { location.reload(); }
}

function openChat(phone) {
    chatWith = phone;
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
    document.getElementById("chatWindowContainer").classList.remove("active-window");
    const activeFrame = document.getElementById("activeChatFrame");
    activeFrame.style.display = "none";
    document.getElementById("noChatSelected").removeAttribute("style");
    chatWith = null;
    if (msgRef) { msgRef.off(); msgRef = null; }
}

function sendMessage() {
    const input = document.getElementById("message");
    const text = input.value.trim();
    if (!text || !chatWith) return;
    const id = chatId(me, chatWith);
    db.ref("chats/" + id).push({ sender: me, text: text, time: firebase.database.ServerValue.TIMESTAMP, status: "sent" });
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
        renderMessage(m, isMe, key);
    });

    msgRef.on("child_changed", snap => {
        const m = snap.val();
        const key = snap.key;
        const element = document.getElementById(`msg-${key}`);
        if (element && m.sender === me) {
            const metaBox = element.querySelector(".msg-meta");
            metaBox.innerHTML = `${formatTime(m.time)} ${getTicks(m.status)}`;
        }
    });
}

async function renderMessage(m, isMe, key) {
    const box = document.getElementById("chatBox");
    if(document.getElementById(`msg-${key}`)) return;

    const row = document.createElement("div");
    row.id = `msg-${key}`;
    row.className = `msg-row ${isMe ? "sent" : "received"}`;

    const mobileSelectedLang = document.getElementById("myDisplayLanguage") ? document.getElementById("myDisplayLanguage").value : "en";
    let messageBodyText = m.text;

    if (!isMe && mobileSelectedLang !== "en") {
        messageBodyText = await translateTextForMobile(m.text, mobileSelectedLang);
    }

    let actionPillMarkup = "";
    if (!!isMe === false) { 
        actionPillMarkup = `
            <div class="message-actions" id="actions-${key}" style="margin-top: 5px; display: flex; gap: 8px;">
                <button class="pill-btn transcribe-btn-selector" onclick="triggerTranscribe('${key}', '${btoa(m.text)}')">🗣️ Transcribe</button>
                <button class="pill-btn" onclick="triggerTranslation('${key}', '${btoa(m.text)}')"><i class="fa-solid fa-wand-magic-sparkles"></i> Translate AI</button>
            </div>
        `;
    }

    row.innerHTML = `
        <div class="msg-bubble">
            <div class="msg-text-payload" id="text-${key}">
                ${escapeHTML(messageBodyText)}
                ${!isMe && mobileSelectedLang !== "en" ? `<br><small style="color:var(--accent-blue, #53bdeb); font-size:0.65rem; opacity:0.8;">✨ Auto-Translated</small>` : ''}
            </div>
            ${actionPillMarkup}
            <div class="msg-meta">
                ${formatTime(m.time)}
                ${isMe ? getTicks(m.status) : ""}
            </div>
        </div>
    `;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
}

function markSeen() {
    if (!chatWith) return;
    const id = chatId(me, chatWith);
    db.ref("chats/" + id).once("value", snap => {
        snap.forEach(child => {
            const m = child.val();
            if (m.sender !== me && m.status !== "seen") { child.ref.update({ status: "seen" }); }
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
    db.ref("typing").on("value", snap => {
        const data = snap.val();
        let isTyping = false;
        if (data && chatWith && data[chatWith]) { if (data[chatWith].to === me && data[chatWith].typing) { isTyping = true; } }
        document.getElementById("typingIndicator").style.display = isTyping ? "block" : "none";
    });
}

// =========================================================================
// 💎 WEBRTC AV SIGNALING LAYER
// =========================================================================
function startCall() { startRealtimeCall(false); }
function startVideoCall() { startRealtimeCall(true); }
async function startRealtimeCall(video = false) {
    if (!chatWith) return; currentCallId = chatId(me, chatWith); remoteIceCandidatesQueue = []; configureCallUIElements(chatWith, "Connecting Call...");
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        const localVideo = document.getElementById("localVideo"); if (localVideo) localVideo.srcObject = localStream;
        peerConnection = new RTCPeerConnection(servers); localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = event => { const remoteVideo = document.getElementById("remoteVideo"); if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) { remoteVideo.srcObject = event.streams[0]; document.getElementById("callStatus").innerText = "CONNECTED LINE"; } };
        peerConnection.onicecandidate = event => { if (event.candidate && currentCallId) { db.ref(`calls/${currentCallId}/offerCandidates`).push(JSON.stringify(event.candidate)); } };
        const offer = await peerConnection.createOffer(); await peerConnection.setLocalDescription(offer);
        await db.ref("calls/" + currentCallId).set({ caller: me, receiver: chatWith, offer: JSON.stringify(offer), type: video ? "video" : "audio", timestamp: firebase.database.ServerValue.TIMESTAMP }); listenForAnswer();
    } catch (err) { endCall(); }
}

function listenForIncomingCalls() {
    db.ref("calls").off("child_added");
    db.ref("calls").on("child_added", async snap => {
        const data = snap.val(); if (!data || data.receiver !== me) return; if (data.timestamp && Date.now() - data.timestamp > 45000) return;
        currentCallId = snap.key; remoteIceCandidatesQueue = []; const ringer = document.getElementById("ringtone"); try { if (ringer) ringer.play(); } catch(e){}
        const accept = confirm(`Incoming call request by ${data.caller}. Want to accept?`); if (ringer) { ringer.pause(); ringer.currentTime = 0; }
        if (!accept) { db.ref("calls/" + currentCallId).remove(); return; }
        configureCallUIElements(data.caller, "STABILIZING CHANNEL...");
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: data.type === "video" });
            const localVideo = document.getElementById("localVideo"); if (localVideo) localVideo.srcObject = localStream;
            peerConnection = new RTCPeerConnection(servers); localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
            peerConnection.ontrack = event => { const remoteVideo = document.getElementById("remoteVideo"); if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) { remoteVideo.srcObject = event.streams[0]; document.getElementById("callStatus").innerText = "CALL CONNECTED"; } };
            peerConnection.onicecandidate = event => { if (event.candidate && currentCallId) { db.ref(`calls/${currentCallId}/answerCandidates`).push(JSON.stringify(event.candidate)); } };
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(data.offer)));
            const answer = await peerConnection.createAnswer(); await peerConnection.setLocalDescription(answer);
            await db.ref(`calls/${currentCallId}`).update({ answer: JSON.stringify(answer) }); processBufferedRemoteCandidates();
            db.ref(`calls/${currentCallId}/offerCandidates`).on("child_added", s => { if (peerConnection && peerConnection.remoteDescription) { peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(s.val()))).catch(e => {}); } else { remoteIceCandidatesQueue.push(JSON.parse(s.val())); } });
            db.ref(`calls/${currentCallId}`).on("value", s => { if (!s.exists()) teardownCallState(); });
        } catch (err) { endCall(); }
    });
}

function listenForAnswer() {
    if (!currentCallId) return;
    db.ref(`calls/${currentCallId}/answer`).on("value", async snap => { const answer = snap.val(); if (!answer || !peerConnection || peerConnection.signalingState === "stable") return; await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer))); processBufferedRemoteCandidates(); });
    db.ref(`calls/${currentCallId}/answerCandidates`).on("child_added", snap => { if (peerConnection && peerConnection.remoteDescription) { peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(snap.val()))).catch(e => {}); } else { remoteIceCandidatesQueue.push(JSON.parse(snap.val())); } });
    db.ref(`calls/${currentCallId}`).on("value", s => { if (!s.exists()) teardownCallState(); });
}

function processBufferedRemoteCandidates() { while (remoteIceCandidatesQueue.length > 0) { const c = remoteIceCandidatesQueue.shift(); if (peerConnection) { peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(e => {}); } } }
function endCall() { if (currentCallId) { db.ref(`calls/${currentCallId}/offerCandidates`).off(); db.ref(`calls/${currentCallId}/answerCandidates`).off(); db.ref(`calls/${currentCallId}/answer`).off(); db.ref(`calls/${currentCallId}`).off(); db.ref("calls/" + currentCallId).remove(); } teardownCallState(); }
function teardownCallState() { const ringer = document.getElementById("ringtone"); if (ringer) { ringer.pause(); ringer.currentTime = 0; } const callScreen = document.getElementById("callScreen"); if (callScreen) callScreen.style.display = "none"; remoteIceCandidatesQueue = []; if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; } if (peerConnection) { peerConnection.close(); peerConnection = null; } isMuted = false; videoEnabled = true; updateBtnUI("muteBtn", true, '<i class="fa-solid fa-microphone"></i>'); updateBtnUI("videoBtn", true, '<i class="fa-solid fa-video"></i>'); currentCallId = null; }

// =========================================================================
// 💎 INSTAGRAM STATUS NOTES LOGIC PLATFORM
// =========================================================================
function toggleStatusNotePopup() { const popup = document.getElementById("statusNoteConfigPopup"); if (!popup) return; const isHidden = popup.style.display === "none" || popup.style.display === ""; popup.style.display = isHidden ? "flex" : "none"; if (isHidden) { document.getElementById("statusNoteInput").focus(); } }
function publishProfileStatusNote() {
    const noteText = document.getElementById("statusNoteInput").value.trim(); const rawSpotifyUrl = document.getElementById("statusSpotifyInput").value.trim(); if (!noteText) { alert("Please enter what is on your mind before sharing!"); return; }
    let trackId = ""; if (rawSpotifyUrl.includes("track/")) { const matches = rawSpotifyUrl.match(/track\/([a-zA-Z0-9]+)/); if (matches && matches[1]) trackId = matches[1]; } else if (rawSpotifyUrl.length > 5) { trackId = rawSpotifyUrl; }
    db.ref(`statusNotes/${me}`).set({ note: noteText, spotifyTrackId: trackId, timestamp: firebase.database.ServerValue.TIMESTAMP }).then(() => { document.getElementById("statusNoteInput").value = ""; document.getElementById("statusSpotifyInput").value = ""; toggleStatusNotePopup(); }).catch(err => {});
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
// 💎 RECONSTRUCTED INSTAGRAM-STYLE LEFT SIDEBAR DRAWER & ANIMATED ACTIONS ENGINE
// =========================================================================

// 1. DRAWER PHYSICS: Controls the structural opening and closing of the Left Stories Slide
function toggleStoriesDrawer(openState) {
    const drawer = document.getElementById("storiesSidebarDrawer");
    const overlay = document.getElementById("drawerOverlay");
    
    if (!drawer || !overlay) return;
    
    if (openState) {
        drawer.classList.add("open");
        overlay.style.display = "block";
        loadIndicNetworkStories(); // Sync data paths instantly on drag pulse
    } else {
        drawer.classList.remove("open");
        overlay.style.display = "none";
    }
}

// 2. CREATION HUB CONTROLLERS: Clockwise Rotation Matrix & Popup Tray Toggle
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

// Simple trigger redirect helper to fire file selection layers safely
function triggerStoryUploadProcess() {
    toggleUploadDropdownMenu(); // Smooth reset menu rotations close
    document.getElementById("storyMediaUploader").click();
}

// 3. CORE STORIES ENGINE: Commits media data strings and dynamically replaces circles with Profile Images
function uploadStoryStatusMatrix(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const payloadDataString = e.target.result;

        db.ref(`stories/${me}`).set({
            phone: me,
            mediaData: payloadDataString,
            timestamp: Date.now()
        }).then(() => {
            alert("🚀 Status story uploaded to the network framework core!");
            // Smoothly auto open drawer to display the fresh post asset circle layout instantly
            toggleStoriesDrawer(true);
        }).catch(err => console.error("Database status commit leak:", err));
    };
    reader.readAsDataURL(file);
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

            // 24 Hour Expiration Cleaner
            if (currentEpochNow - data.timestamp > absolute24HoursLimitWindow) {
                child.ref.remove();
                return;
            }

            // 👑 THE IDENTITY UPGRADE TRICK: If the story belongs to ME, swap circle contents to my image snapshot!
            if (data.phone === me) {
                if (myDisplayCircle) {
                    myDisplayCircle.innerHTML = `<img src="${data.mediaData}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    myDisplayCircle.onclick = () => launchImmersiveStoryViewer(btoa(me), btoa(data.mediaData));
                }
                return; // Pushes my display inside the static top slot card layout node block
            }

            // Render remaining friend cards cascading smoothly downwards vertically
            const userInitials = data.phone.substring(0,2).toUpperCase();
            
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

        // Safe design fallback fallback state adjustment: restore clean initials if I have no active data node
        if (!snap.hasChild(me) && myDisplayCircle) {
            myDisplayCircle.innerText = me ? me.substring(0,2).toUpperCase() : "M";
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

// 4. STANDALONE REELS AREA WORKSPACE ROUTERS
function openDedicatedReelsPage() {
    const reelsPage = document.getElementById("dedicatedReelsPage");
    if (reelsPage) reelsPage.style.display = "flex";
}

function closeDedicatedReelsPage() {
    const reelsPage = document.getElementById("dedicatedReelsPage");
    if (reelsPage) reelsPage.style.display = "none";
}

// =========================================================================
// 💎 MOBILE BACKGROUND AUTO-TRANSLATION PIPELINE ENGINE
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

// =========================================================================
// 💎 FIXED: UI FRAMEWORK UTILITIES & HELPERS
// =========================================================================
function configureCallUIElements(peerPhone, statusText) { const callScreen = document.getElementById("callScreen"); const callName = document.getElementById("callName"); const callStatus = document.getElementById("callStatus"); if (callScreen) callScreen.style.display = "flex"; if (callName) callName.innerText = `Peer Connection: ${peerPhone}`; if (callStatus) callStatus.innerText = statusText; }
function updateBtnUI(btnId, isActive, innerHTMLMarkup) { const targetBtn = document.getElementById(btnId); if (!targetBtn) return; targetBtn.innerHTML = innerHTMLMarkup; if (isActive) { targetBtn.style.background = "rgba(255, 255, 255, 0.15)"; targetBtn.style.color = "var(--text-main)"; } else { targetBtn.style.background = "rgba(239, 68, 68, 0.2)"; targetBtn.style.color = "#ef4444"; } }
function escapeHTML(str) { if (!str) return ""; return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function formatTime(ts) { if (!ts) return ""; const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function getTicks(status) { if (status === "sent") return '<i class="fa-solid fa-check" style="color:var(--text-secondary)"></i>'; if (status === "delivered") return '<i class="fa-solid fa-check-double" style="color:var(--text-secondary)"></i>'; if (status === "seen") return '<i class="fa-solid fa-check-double" style="color: var(--accent-blue)"></i>'; return ""; }
function onClickInputFocus() { setTimeout(() => { const box = document.getElementById("chatBox"); if (box) box.scrollTop = box.scrollHeight; }, 250); }
document.getElementById("message").addEventListener("focus", onClickInputFocus);