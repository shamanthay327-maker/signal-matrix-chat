// ================= CONFIGURATION & INITIALIZATION =================
const firebaseConfig = {
    apiKey: "AIzaSyDml5oxrAMvMruHQmcMn6neMhdVfGrDY6A",
    authDomain: "chat-app-b46c7.firebaseapp.com",
    databaseURL: "https://chat-app-b46c7-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "chat-app-b46c7"
};

// Guard initialization process
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ================= ARCHITECTURAL STATE HOOKS =================
let me = null;
let chatWith = null;
let msgRef = null;
let presenceIntervalId = null;

// WebRTC Streaming Infrastructure 
let localStream = null;
let peerConnection = null;
let currentCallId = null;
let isMuted = false;
let videoEnabled = true;

// Shared Inbound ICE Candidate Queue (Fixes asynchronous race conditions on mobile hardware)
let remoteIceCandidatesQueue = [];


// FIXED: Expanded STUN fallback cluster arrays to aggressively force media paths across dynamic cellular configurations
const servers = {
    iceServers: [
        { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
        { urls: ["stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302"] },
        { urls: ["stun:stun4.l.google.com:19302", "stun:stun.services.mozilla.com"] }
    ],
    iceCandidatePoolSize: 10
};

// ================= CONNECT HANDSHAKER =================
function login() {
    const phone = document.getElementById("phone").value.trim();
    if (!phone) {
        alert("Please provide a phone code entry value.");
        return;
    }

    me = phone;
    document.getElementById("myPhoneDisplay").innerText = me;
    document.getElementById("myAvatar").innerText = me.substring(0,2).toUpperCase();

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

        // Mutation UI display layers
        document.getElementById("login").style.display = "none";
        document.getElementById("chatPage").style.display = "flex";

        // Spin Up background operational runtimes
        loadUsers();
        startPresence();
        // ================= PERSONALIZED REGISTRATION STORAGE LAYER =================
        // ================= COMPACT MOUNTED STORAGE LAYER =================
           // =========================================================================
// 💎 INSTAGRAM STATUS NOTES & LIVE SPOTIFY LINK CORE LOGIC PLATFORM
// =========================================================================

// 1. UI DISPLAY MANAGER: Safely controls popup modal states
function toggleStatusNotePopup() {
    const popup = document.getElementById("statusNoteConfigPopup");
    if (!popup) return;
    
    const isHidden = popup.style.display === "none" || popup.style.display === "";
    popup.style.display = isHidden ? "flex" : "none";
    
    // Auto-focus input fields when modal opens up
    if (isHidden) {
        document.getElementById("statusNoteInput").focus();
    }
}

// 2. DATA BROADCASTER: Validates parameters and commits links to Firebase
function publishProfileStatusNote() {
    const noteText = document.getElementById("statusNoteInput").value.trim();
    const rawSpotifyUrl = document.getElementById("statusSpotifyInput").value.trim();

    if (!noteText) {
        alert("Please enter what is on your mind before sharing!");
        return;
    }

    let trackId = "";
    // Clean regex extraction pipeline to grab the unique song ID safely out of a live sharing link
    if (rawSpotifyUrl.includes("spotify.com")) {
        const matches = rawSpotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
        if (matches && matches[1]) trackId = matches[1];
    } else if (rawSpotifyUrl.length > 5) {
        trackId = rawSpotifyUrl; // Fallback string pass if they entered the raw ID hash
    }

    const notePayload = {
        note: noteText,
        spotifyTrackId: trackId,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref(`statusNotes/${me}`).set(notePayload).then(() => {
        document.getElementById("statusNoteInput").value = "";
        document.getElementById("statusSpotifyInput").value = "";
        toggleStatusNotePopup();
    }).catch(err => console.error("Realtime Node status entry lock failure:", err));
}

// 3. SYNCHRONIZATION FEED ENGINE: Binds real-time updates clean inside your directory layout cards
function listenForNetworkStatusNotes() {
    if (!me) return;

    // A. Track Personal Profile Element State Displays
    db.ref(`statusNotes/${me}`).on("value", snap => {
        const data = snap.val();
        const floatingBubble = document.getElementById("myFloatingBubbleNote");
        const trackDisplay = document.getElementById("myProfileTrackText");

        if (data) {
            if (floatingBubble) {
                floatingBubble.innerText = data.note;
                floatingBubble.style.display = "block";
            }
            if (trackDisplay) {
                trackDisplay.innerHTML = data.spotifyTrackId 
                    ? `<a href="https://open.spotify.com/track/${data.spotifyTrackId}" target="_blank" style="color:#1ed760; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><i class="fa-brands fa-spotify"></i> Live Track Linked</a>`
                    : `<span style="color:rgba(255,255,255,0.4);"><i class="fa-regular fa-comment-dots"></i> ${data.note}</span>`;
            }
        }
    });

    // B. Inject Real-Time Activity Status Badges directly below friend cards inside loadUsers()
    db.ref("statusNotes").on("value", snap => {
        const globalNotesMatrix = snap.val() || {};
        
        // Find every active rendered companion component node block on your screen layout
        const targetContactCards = document.querySelectorAll(".chat-item");
        
        targetContactCards.forEach(card => {
            const nameField = card.querySelector(".chat-name");
            if (!nameField) return;
            
            const cardUserPhone = nameField.innerText.trim();
            const matchingStatus = globalNotesMatrix[cardUserPhone];

            // Safely sweep out any old elements to protect against duplicates
            const oldNoteRow = card.querySelector(".contact-insta-note-row");
            if (oldNoteRow) oldNoteRow.remove();

            if (matchingStatus) {
                const noteRowElement = document.createElement("div");
                noteRowElement.className = "contact-insta-note-row";
                noteRowElement.style.cssText = "font-size: 0.72rem; color: rgba(255,255,255,0.5); margin-top: 6px; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); min-width: 0; width: 100%; box-sizing: border-box;";

                let trackActionBadge = "";
                if (matchingStatus.spotifyTrackId) {
                    trackActionBadge = `
                        <a href="https://open.spotify.com/track/${matchingStatus.spotifyTrackId}" target="_blank" onclick="event.stopPropagation();" style="color: #1ed760; background: rgba(30,215,96,0.1); padding: 2px 6px; border-radius: 10px; font-size: 0.62rem; text-decoration: none; display: flex; align-items: center; gap: 3px; font-weight: 600; flex-shrink: 0; margin-left: 6px;">
                            <i class="fa-brands fa-spotify"></i> Song
                        </a>`;
                }

                noteRowElement.innerHTML = `
                    <span style="font-style: italic; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1; min-width: 0; padding-right: 4px;">"${matchingStatus.note}"</span>
                    ${trackActionBadge}
                `;

                const chatInfoZone = card.querySelector(".chat-info");
                if (chatInfoZone) chatInfoZone.appendChild(noteRowElement);
            }
        });
    });
}
        listenForIncomingCalls(); 
        loadIndicNetworkStories();
        listenForNetworkStatusNotes();
    });
}

// ================= FIXED DIRECTORY MANAGER WITH TIMESTAMP LIVENESS CHECK =================
function loadUsers() {
    db.ref("users").on("value", snap => {
        const list = document.getElementById("chatList");
        list.innerHTML = "";

        // Get the current local system epoch timestamp
        const now = Date.now();

        snap.forEach(u => {
            const user = u.val();
            if (!user || !user.phone || user.phone === me) return;

            // CRITICAL LIVENESS CHECK: Consider a user online ONLY if their online flag is true 
            // AND their last background heartbeat update arrived within the last 20 seconds.
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
    });
}

function chatId(a, b) {
    return [a, b].sort().join("_");
}

// ================= HEARTBEAT NODE PRESENCE LAYER =================
function startPresence() {
    const myPresenceRef = db.ref("users/" + me);
    
    myPresenceRef.onDisconnect().update({
        online: false,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    if (presenceIntervalId) clearInterval(presenceIntervalId);

    presenceIntervalId = setInterval(() => {
        myPresenceRef.update({
            online: true,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        }).catch(err => console.warn("Heartbeat sync packet drop:", err));
    }, 6000);
}

  //-----LOGOUT FUNCTION-------//
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

// ================= CONVERSATION ENVIRONMENT HOOKS =================
function openChat(phone) {
    chatWith = phone;

    document.getElementById("noChatSelected").style.display = "none";
    
    const activeFrame = document.getElementById("activeChatFrame");
    activeFrame.removeAttribute("style");
    
    document.getElementById("chatTitle").innerText = phone;
    document.getElementById("targetAvatar").innerText = phone.substring(0,2).toUpperCase();
    
    document.getElementById("chatWindowContainer").classList.add("active-window");

    loadUsers(); // Refresh active list highlighted states
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
    if (msgRef) {
        msgRef.off();
        msgRef = null;
    }
}

// ================= MESSAGING OPTIMIZATION MODULES =================
function sendMessage() {
    const input = document.getElementById("message");
    const text = input.value.trim();
    if (!text || !chatWith) return;

    const id = chatId(me, chatWith);
    db.ref("chats/" + id).push({
        sender: me,
        text: text,
        time: firebase.database.ServerValue.TIMESTAMP,
        status: "sent"
    });

    input.value = "";
    setTyping(false);
}

// Global scope listener hook for Enter Key processing
document.addEventListener("keydown", e => {
    if (e.key === "Enter" && document.activeElement === document.getElementById("message")) {
        sendMessage();
    }
});

function loadMessages() {
    const id = chatId(me, chatWith);
    if (msgRef) msgRef.off();

    msgRef = db.ref("chats/" + id);
    const box = document.getElementById("chatBox");
    box.innerHTML = "";

    // Node added synchronization loop
    msgRef.on("child_added", snap => {
        const m = snap.val();
        const key = snap.key;
        const isMe = m.sender === me;

        if (!isMe && m.status !== "seen") {
            db.ref("chats/" + id + "/" + key).update({
                status: chatWith === m.sender ? "seen" : "delivered"
            });
        }
        renderMessage(m, isMe, key);
    });

    // Explicit structural message state modification listener (Optimizes UI repaints)
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

function renderMessage(m, isMe, key) {
    const box = document.getElementById("chatBox");
    if(document.getElementById(`msg-${key}`)) return; // Prevent layout redundancy leaks

    const row = document.createElement("div");
    row.id = `msg-${key}`;
    row.className = `msg-row ${isMe ? "sent" : "received"}`;

    // FIXED: Correct parameters passed safely via btoa() into triggerTranscribe
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
            <div class="msg-text-payload" id="text-${key}">${escapeHTML(m.text)}</div>
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
            if (m.sender !== me && m.status !== "seen") {
                child.ref.update({ status: "seen" });
            }
        });
    });
}

// ================= VERNACULAR ON-DEMAND AI ENGINE PIPELINE =================

// UPDATED PIPELINE NODE 1: Directly streams core audio synthesis engine patterns
async function triggerTranscribe(messageKey, encryptedPayload) {
    const originalText = atob(encryptedPayload);
    const selectedLanguage = document.getElementById("myDisplayLanguage") ? document.getElementById("myDisplayLanguage").value : "hi";
    const transcribeBtn = document.querySelector(`#actions-${messageKey} .transcribe-btn-selector`);

    console.log("🗣️ Transcribe voice trigger processed for text:", originalText);
    if (transcribeBtn) transcribeBtn.innerHTML = `⏳ Loading Audio...`;

    try {
        const response = await fetch('http://localhost:5000/api/ai/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: originalText, lang: selectedLanguage })
        });
        
        const data = await response.json();
        
        if (data.audioData) {
            console.log("🎵 Audio track compiled successfully. Executing playback...");
            const audioStreamUrl = `data:audio/mp3;base64,${data.audioData}`;
            const player = new Audio(audioStreamUrl);
            player.play();
            if (transcribeBtn) transcribeBtn.innerHTML = `🗣️ Transcribe`;
        } else {
            console.error("❌ Audio generation parameter failure:", data);
            if (transcribeBtn) transcribeBtn.innerHTML = `❌ Error`;
        }
    } catch (err) {
        console.error("❌ Local system voice engine offline:", err);
        if (transcribeBtn) transcribeBtn.innerHTML = `❌ Offline`;
    }
}

// PIPELINE NODE 2: Handles Selective Text Translation via Sarvam APIs
async function triggerTranslation(messageKey, encryptedPayload) {
    const originalText = atob(encryptedPayload);
    const targetDisplayZone = document.getElementById(`text-${messageKey}`);
    const selectedLanguage = document.getElementById("myDisplayLanguage") ? document.getElementById("myDisplayLanguage").value : "hi";

    targetDisplayZone.innerHTML = `<span class="ai-loading">Querying Indic Translation Matrix...</span>`;
    document.getElementById(`actions-${messageKey}`).style.display = "none";

    try {
        const response = await fetch('http://localhost:5000/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: originalText, targetLang: selectedLanguage })
        });
        const data = await response.json();
        
        targetDisplayZone.innerHTML = `
            <span class="translated-label">✨ Translated AI:</span>
            <div class="translated-body">${escapeHTML(data.translatedText)}</div>
            <small style="color:var(--text-secondary); opacity:0.5; font-size:0.75rem;">Original: ${escapeHTML(originalText)}</small>
        `;
    } catch (err) {
        targetDisplayZone.innerHTML = `${escapeHTML(originalText)} <br><small style="color:red;font-size:0.7rem;">[Local backend connection offline]</small>`;
    }
}

// ================= TYPING EVENT ENGINE =================
function setTyping(state) {
    if (!me || !chatWith) return;
    db.ref("typing/" + me).set({
        to: chatWith,
        typing: state
    });
}

document.getElementById("message").addEventListener("input", () => {
    setTyping(true);
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
        setTyping(false);
    }, 1400);
});

function listenTyping() {
    db.ref("typing").on("value", snap => {
        const data = snap.val();
        let isTyping = false;

        if (data && chatWith && data[chatWith]) {
            if (data[chatWith].to === me && data[chatWith].typing) {
                isTyping = true;
            }
        }
        document.getElementById("typingIndicator").style.display = isTyping ? "block" : "none";
    });
}

// ================= WEBRTC AV SIGNALING LAYER (REPAIRED & COMPLETE) =================
function startCall() { startRealtimeCall(false); }
function startVideoCall() { startRealtimeCall(true); }

async function startRealtimeCall(video = false) {
    if (!chatWith) return;
    currentCallId = chatId(me, chatWith);
    remoteIceCandidatesQueue = [];

    configureCallUIElements(chatWith, "Connecting Call...");

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        const localVideo = document.getElementById("localVideo");
        if (localVideo) localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(servers);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event => {
            const remoteVideo = document.getElementById("remoteVideo");
            if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                document.getElementById("callStatus").innerText = "CONNECTED LINE";
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate && currentCallId) {
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
    // Clear any loose background call hooks to prevent duplicates
    db.ref("calls").off("child_added");
    
    db.ref("calls").on("child_added", async snap => {
        const data = snap.val();
        if (!data || data.receiver !== me) return;
        if (data.timestamp && Date.now() - data.timestamp > 45000) return;

        currentCallId = snap.key;
        remoteIceCandidatesQueue = [];
        const ringer = document.getElementById("ringtone");
        
        try { if (ringer) ringer.play(); } catch(e){}

        const accept = confirm(`Incoming call request by ${data.caller}. Want to accept?`);
        if (ringer) {
            ringer.pause();
            ringer.currentTime = 0;
        }

        if (!accept) {
            db.ref("calls/" + currentCallId).remove();
            return;
        }

        configureCallUIElements(data.caller, "STABILIZING CHANNEL...");

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: data.type === "video" });
            const localVideo = document.getElementById("localVideo");
            if (localVideo) localVideo.srcObject = localStream;

            peerConnection = new RTCPeerConnection(servers);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = event => {
                const remoteVideo = document.getElementById("remoteVideo");
                if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0];
                    document.getElementById("callStatus").innerText = "CALL CONNECTED";
                }
            };

            peerConnection.onicecandidate = event => {
                if (event.candidate && currentCallId) {
                    db.ref(`calls/${currentCallId}/answerCandidates`).push(JSON.stringify(event.candidate));
                }
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
    if (!currentCallId) return;
    
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
        // Drop the references from the real-time node cleanly
        db.ref(`calls/${currentCallId}/offerCandidates`).off();
        db.ref(`calls/${currentCallId}/answerCandidates`).off();
        db.ref(`calls/${currentCallId}/answer`).off();
        db.ref(`calls/${currentCallId}`).off();
        db.ref("calls/" + currentCallId).remove();
    }
    teardownCallState();
}

function teardownCallState() {
    const ringer = document.getElementById("ringtone");
    if (ringer) {
        ringer.pause();
        ringer.currentTime = 0;
    }
    
    const callScreen = document.getElementById("callScreen");
    if (callScreen) callScreen.style.display = "none";
    
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
    currentCallId = null;
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

// ================= FIXED: MISSING UI FRAMEWORK UTILITIES =================
function configureCallUIElements(peerPhone, statusText) {
    const callScreen = document.getElementById("callScreen");
    const callTitle = document.getElementById("callTitle");
    const callStatus = document.getElementById("callStatus");
    
    if (callScreen) callScreen.style.display = "flex";
    if (callTitle) callTitle.innerText = `Peer Connection: ${peerPhone}`;
    if (callStatus) callStatus.innerText = statusText;
}

function updateBtnUI(btnId, isActive, innerHTMLMarkup) {
    const targetBtn = document.getElementById(btnId);
    if (!targetBtn) return;
    
    targetBtn.innerHTML = innerHTMLMarkup;
    if (isActive) {
        targetBtn.style.background = "rgba(255, 255, 255, 0.15)";
        targetBtn.style.color = "var(--text-main)";
    } else {
        targetBtn.style.background = "rgba(239, 68, 68, 0.2)"; // Red alert warning background tint
        targetBtn.style.color = "#ef4444";
    }
}

// =========================================================================
// 🛠️ SYSTEM CORE UTILITIES & HELPERS
// =========================================================================

function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTicks(status) {
    if (status === "sent") return '<i class="fa-solid fa-check" style="color:var(--text-secondary)"></i>';
    if (status === "delivered") return '<i class="fa-solid fa-check-double" style="color:var(--text-secondary)"></i>';
    if (status === "seen") return '<i class="fa-solid fa-check-double" style="color: var(--accent-blue)"></i>';
    return "";
}

function onClickInputFocus() {
    setTimeout(() => {
        const box = document.getElementById("chatBox");
        if (box) box.scrollTop = box.scrollHeight;
    }, 250);
}
document.getElementById("message").addEventListener("focus", onClickInputFocus);

// ==================== REVOLUTION INDIC INDIC STATUS STORY TRAIL MATRIX ====================

// 1. ENGINE OPERATION: Media Encoding Pipeline Loader
function uploadStoryStatusMatrix(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const payloadDataString = e.target.result;
        const targetTimestampEpoch = Date.now();

        // Write the story node straight into your global cluster realtime node setup
        db.ref(`stories/${me}`).set({
            phone: me,
            mediaData: payloadDataString,
            timestamp: targetTimestampEpoch
        }).then(() => {
            alert("🚀 Status story initialized across the network core matrix!");
        }).catch(err => {
            console.error("Payload allocation failure:", err);
            alert("❌ Storage overflow check file parameters.");
        });
    };
    reader.readAsDataURL(file);
}

// 2. TIMEOUT ENGINE SYNC: Dynamic fetch rendering and 24-hour expiration monitoring loop
function loadIndicNetworkStories() {
    db.ref("stories").on("value", snap => {
        const dynamicStoriesDeck = document.getElementById("dynamicStoriesDeck");
        if (!dynamicStoriesDeck) return;
        dynamicStoriesDeck.innerHTML = "";

        const currentEpochTimeNow = Date.now();
        const absolute24HoursLimitWindow = 24 * 60 * 60 * 1000; // 86400000 milliseconds

        snap.forEach(child => {
            const data = child.val();
            if (!data || !data.phone) return;

            // EXPIRED PROTOCOL CORRECTION: Check if file threshold age exceeds 24h limit parameter
            if (currentEpochTimeNow - data.timestamp > absolute24HoursLimitWindow) {
                // Auto-purge the dead database document cleanly in the background
                child.ref.remove();
                return;
            }

            // Don't render yourself in the incoming feed track circle deck
            if (data.phone === me) return;

            // Generate the clean Instagram-style colored circle ring asset node template string
            const shortCasingLabel = data.phone.substring(0,2).toUpperCase();
            
            dynamicStoriesDeck.innerHTML += `
                <div class="story-user-node-wrapper" onclick="launchImmersiveStoryViewer('${btoa(data.phone)}', '${btoa(data.mediaData)}')" style="display: flex; flex-direction: column; align-items: center; cursor: pointer; flex-shrink: 0; width: 68px;">
                    <div class="live-story-ring" style="width: 58px; height: 58px; border-radius: 50%; padding: 2px; border: 2px solid #53bdeb; display: flex; align-items: center; justify-content: center; background: #121212; transition: transform 0.2s;">
                        <div style="width: 100%; height: 100%; border-radius: 50%; background: #222; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600;">
                            ${shortCasingLabel}
                        </div>
                    </div>
                    <span style="font-size: 0.7rem; color: #aaa; max-width: 68px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 6px;">${data.phone}</span>
                </div>
            `;
        });
    });
}

// 3. UI GRAPHIC LAYER INTERACTION: Launches immersive visual modal block execution
function launchImmersiveStoryViewer(encodedPhone, encodedMedia) {
    const targetPhone = atob(encodedPhone);
    const targetMedia = atob(encodedMedia);

    const modal = document.getElementById("immersiveStoryViewer");
    const canvas = document.getElementById("storyViewerMediaCanvas");
    const bar = document.getElementById("storyProgressBar");
    const avatar = document.getElementById("storyViewerAvatar");
    const title = document.getElementById("storyViewerTitle");

    if (!modal || !canvas) return;

    avatar.innerText = targetPhone.substring(0,2).toUpperCase();
    title.innerText = targetPhone;
    canvas.src = targetMedia;
    modal.style.display = "flex";

    // Initialize progress bar physics animation instantly
    setTimeout(() => {
        bar.style.width = "100%";
    }, 50);

    // Auto dismiss after 4 seconds complete sequence loop run
    window.storyAutoDismissTracker = setTimeout(() => {
        closeImmersiveStoryViewer();
    }, 4050);
}

function closeImmersiveStoryViewer() {
    const modal = document.getElementById("immersiveStoryViewer");
    const bar = document.getElementById("storyProgressBar");
    
    if (modal) modal.style.display = "none";
    if (bar) {
        bar.style.transition = "none";
        bar.style.width = "0%";
        // Restore step transitions loop rules dynamically
        setTimeout(() => {
            bar.style.transition = "width 4s linear";
        }, 50);
    }
    clearTimeout(window.storyAutoDismissTracker);
}

// ==================== STORIES STANDALONE PAGE INTERACTION ENGINE ====================

function openDedicatedStoriesPage() {
    // Hide the primary core chatting interface container layer completely
    document.getElementById("chatPage").style.display = "none";
    
    // Mount and fade up your expansive new Status Page Screen
    const storiesPage = document.getElementById("dedicatedStoriesPage");
    if (storiesPage) storiesPage.style.display = "block";
    
    // Explicitly pulse the real-time Firebase reader engine to sync all incoming posts
    loadIndicNetworkStories();
}

function closeDedicatedStoriesPage() {
    // Shut down the standalone stories screen canvas container
    const storiesPage = document.getElementById("dedicatedStoriesPage");
    if (storiesPage) storiesPage.style.display = "none";
    
    // Restore primary focus visibility straight back onto your main chat control workspace
    document.getElementById("chatPage").style.display = "flex";
}