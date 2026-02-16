import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = { 
    apiKey: "AIzaSyDmFyhPz3bd1UzEZdcouQW_dgoPUbdQE04", 
    databaseURL: "https://love-look-default-rtdb.firebaseio.com", 
    projectId: "love-look" 
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUserId = null;
let currentFolder = 'inbox';
let mailDbCache = {};
let profileDbCache = {};
let activeMailId = null;

// --- MOTOR PERFILES ---
function applyPfpStyles(imgElement, pData, frameSize) {
    if(!pData || !imgElement) return;
    const zoom = pData.zoom || 100;
    const top = pData.top || 0;
    const left = pData.left || 0;
    const scale = (frameSize / 250);
    imgElement.style.width = zoom + "%";
    imgElement.style.top = (top * scale) + "px";
    imgElement.style.left = (left * scale) + "px";
}

function logicSyncProfiles() {
    onValue(ref(db, 'profiles'), (snapshot) => {
        profileDbCache = snapshot.val() || {};
        ['seo', 'hari'].forEach(id => {
            const img = document.getElementById(`gate-pfp-${id}`);
            const nameSpan = document.getElementById(`gate-name-${id}`);
            if(profileDbCache[id]) {
                if(profileDbCache[id].pfp) img.src = profileDbCache[id].pfp;
                if(profileDbCache[id].alias) nameSpan.innerText = profileDbCache[id].alias;
                applyPfpStyles(img, profileDbCache[id], 220);
            }
        });
        if(currentUserId) {
            const sideImg = document.getElementById('user-current-pfp');
            const sideName = document.getElementById('user-current-name');
            if(profileDbCache[currentUserId]) {
                if(profileDbCache[currentUserId].pfp) sideImg.src = profileDbCache[currentUserId].pfp;
                sideName.innerText = profileDbCache[currentUserId].alias || currentUserId;
                applyPfpStyles(sideImg, profileDbCache[currentUserId], 55);
            }
        }
    });
}

// --- SESIÓN ---
window.bootSession = (id) => {
    currentUserId = id;
    localStorage.setItem('love_user', id);
    const gate = document.getElementById('gatekeeper');
    const main = document.getElementById('main-container');
    gate.style.opacity = "0";
    setTimeout(() => {
        gate.style.display = "none";
        main.style.display = "grid";
        setTimeout(() => main.style.opacity = "1", 50);
        document.getElementById('e-target').value = `Para: ${id === 'seo' ? 'hari' : 'seo'}`;
        logicSyncMails();
        logicSyncEvents();
        logicSyncProfiles();
    }, 600);
};

window.sessionLogout = () => { localStorage.removeItem('love_user'); location.reload(); };

// --- MAILS ---
function logicSyncMails() {
    onValue(ref(db, 'mails_vProfessional'), (snapshot) => {
        mailDbCache = snapshot.val() || {};
        logicRenderStream();
    });
}

function logicRenderStream(searchQuery = "") {
    const listElement = document.getElementById('stream-render');
    listElement.innerHTML = "";
    let unreadTotal = 0;
    const mailArray = Object.keys(mailDbCache).map(id => ({...mailDbCache[id], id})).reverse();

    mailArray.filter(mail => {
        const isRecipient = (mail.to === currentUserId);
        const isSender = (mail.from === currentUserId);
        if(isRecipient && !mail.read && !mail.trash) unreadTotal++;
        let folderMatch = false;
        if(currentFolder === 'inbox') folderMatch = (isRecipient && !mail.trash);
        if(currentFolder === 'sent') folderMatch = (isSender && !mail.trash);
        if(currentFolder === 'trash') folderMatch = (mail.trash && (isRecipient || isSender));
        return folderMatch && (mail.subject.toLowerCase().includes(searchQuery.toLowerCase()) || mail.from.toLowerCase().includes(searchQuery.toLowerCase()));
    }).forEach(mail => {
        const card = document.createElement('div');
        card.className = `mail-card ${(!mail.read && mail.to === currentUserId) ? 'unread' : ''} ${activeMailId === mail.id ? 'active' : ''}`;
        card.innerHTML = `<button class="btn-delete-item" onclick="logicHandleTrash(event, '${mail.id}', ${mail.trash})">${mail.trash ? '×' : '🗑'}</button>
            <span class="card-time">${mail.date.split(',')[0]}</span>
            <span class="card-from">${mail.from === currentUserId ? 'Para: ' + (profileDbCache[mail.to]?.alias || mail.to) : (profileDbCache[mail.from]?.alias || mail.from)}</span>
            <div class="card-subject">${mail.subject}</div>
            <div class="card-preview">${mail.body.replace(/<[^>]*>/g, '')}</div>`;
        card.onclick = () => logicOpenMail(mail);
        listElement.appendChild(card);
    });
    document.getElementById('badge-inbox').innerText = unreadTotal;
}

function logicOpenMail(mail) {
    activeMailId = mail.id;
    if(mail.to === currentUserId && !mail.read) update(ref(db, `mails_vProfessional/${mail.id}`), { read: true });
    document.getElementById('view-placeholder').style.display = 'none';
    document.getElementById('view-active').style.display = 'block';
    document.getElementById('v-subject').innerText = mail.subject;
    document.getElementById('v-sender').innerText = `De: ${profileDbCache[mail.from]?.alias || mail.from}`;
    document.getElementById('v-date').innerText = mail.date;
    document.getElementById('v-body').innerHTML = mail.body;
    const vImg = document.getElementById('v-avatar');
    vImg.src = profileDbCache[mail.from]?.pfp || '';
    applyPfpStyles(vImg, profileDbCache[mail.from], 70);
    logicRenderStream();
}

window.logicHandleTrash = (e, id, inTrash) => {
    e.stopPropagation();
    if(inTrash) { if(confirm("¿Eliminar para siempre?")) remove(ref(db, `mails_vProfessional/${id}`)); }
    else { update(ref(db, `mails_vProfessional/${id}`), { trash: true }); }
};

window.logicSendMail = () => {
    const subject = document.getElementById('e-subject').value;
    const body = document.getElementById('e-body').innerHTML;
    if(!body.trim() || body === '<br>') return;
    push(ref(db, 'mails_vProfessional'), {
        from: currentUserId, to: (currentUserId === 'seo' ? 'hari' : 'seo'),
        subject: subject || "(Sin Asunto)", body, date: new Date().toLocaleString(), read: false, trash: false
    }).then(() => { uiToggleEditor(false); document.getElementById('e-subject').value = ""; document.getElementById('e-body').innerHTML = ""; });
};

// --- CALENDARIO ---
function logicSyncEvents() {
    onValue(ref(db, 'events_vProf'), (snapshot) => {
        const events = snapshot.val() || {};
        const render = document.getElementById('calendar-render');
        render.innerHTML = "";
        Object.keys(events).forEach(id => {
            const ev = events[id];
            const card = document.createElement('div');
            card.className = "event-card";
            card.innerHTML = `<div style="display:flex; justify-content:space-between;"><b>${ev.title}</b><button onclick="logicDeleteEvent('${id}')" style="background:none; color:red;">×</button></div><p style="font-size:12px; color:var(--p-text-light); margin-top:5px;">${ev.date}</p><div class="countdown-container" id="timer-${id}"></div>`;
            render.appendChild(card);
            startEventTimer(id, ev.date);
        });
    });
}

function startEventTimer(id, targetDate) {
    const updateTimer = () => {
        const diff = new Date(targetDate).getTime() - new Date().getTime();
        const el = document.getElementById(`timer-${id}`);
        if(!el) return;
        if(diff < 0) { el.innerHTML = "¡Hoy es el evento!"; return; }
        const d = Math.floor(diff / (1000*60*60*24));
        const h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
        const m = Math.floor((diff % (1000*60*60)) / (1000*60));
        el.innerHTML = `<div class="count-box"><span class="count-val">${d}</span><span class="count-label">Días</span></div><div class="count-box"><span class="count-val">${h}</span><span class="count-label">Horas</span></div><div class="count-box"><span class="count-val">${m}</span><span class="count-label">Min</span></div>`;
    };
    updateTimer(); setInterval(updateTimer, 60000);
}

window.logicSaveEvent = () => {
    const title = document.getElementById('ev-name').value;
    const date = document.getElementById('ev-date').value;
    if(title && date) push(ref(db, 'events_vProf'), { title, date }).then(uiCloseModals);
};
window.logicDeleteEvent = (id) => remove(ref(db, `events_vProf/${id}`));

// --- UI / INTERFAZ ---
window.uiToggleEditor = (show) => {
    const el = document.getElementById('editor-modal');
    el.style.display = 'flex';
    setTimeout(() => el.classList.toggle('active', show), 10);
};

window.uiSwitchFolder = (folder) => {
    currentFolder = folder;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${folder}`).classList.add('active');
    
    if(folder === 'calendar') {
        document.getElementById('col-list').style.display = 'none';
        document.getElementById('col-viewer').style.display = 'none';
        document.getElementById('calendar-view').style.display = 'block';
    } else {
        document.getElementById('col-list').style.display = 'flex';
        document.getElementById('col-viewer').style.display = 'flex';
        document.getElementById('calendar-view').style.display = 'none';
        logicRenderStream();
    }
};

window.uiOpenProfileEditor = () => {
    document.getElementById('modal-profile').style.display = 'flex';
    document.getElementById('pfp-name-input').value = profileDbCache[currentUserId]?.alias || "";
};

window.uiOpenEventEditor = () => document.getElementById('modal-event').style.display = 'flex';
window.uiCloseModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');

// --- PERFIL AVANZADO ---
let pfpImg = document.getElementById('pfp-preview');
let currentZoom = 100;
window.logicLoadPfp = (input) => {
    const reader = new FileReader();
    reader.onload = (e) => { 
        pfpImg.src = e.target.result; pfpImg.style.top = "0"; pfpImg.style.left = "0"; 
        currentZoom = 100; document.getElementById('pfp-zoom-slider').value = 100; pfpImg.style.width = "100%";
    };
    reader.readAsDataURL(input.files[0]);
};

window.logicZoomPfp = (val) => { 
    currentZoom = val; 
    pfpImg.style.width = val + "%"; 
};

window.logicSaveProfile = () => {
    const alias = document.getElementById('pfp-name-input').value;
    const updates = { 
        alias, 
        pfp: pfpImg.src, 
        zoom: currentZoom, 
        top: parseInt(pfpImg.style.top), 
        left: parseInt(pfpImg.style.left) 
    };
    update(ref(db, `profiles/${currentUserId}`), updates).then(uiCloseModals);
};

// --- EDITOR COMMANDS ---
window.editorCommand = (cmd) => document.execCommand(cmd, false, null);
window.editorHandleAttachment = (input) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = `<img src="${e.target.result}" style="max-width:100%; border-radius:15px;">`;
        document.getElementById('e-body').innerHTML += img;
    };
    reader.readAsDataURL(input.files[0]);
};

// Drag and drop del perfil
let isDragging = false;
let startY, startX, startTop, startLeft;
pfpImg.onmousedown = (e) => {
    isDragging = true;
    startY = e.clientY; startX = e.clientX;
    startTop = parseInt(pfpImg.style.top) || 0;
    startLeft = parseInt(pfpImg.style.left) || 0;
};
window.onmousemove = (e) => {
    if(!isDragging) return;
    pfpImg.style.top = (startTop + (e.clientY - startY)) + "px";
    pfpImg.style.left = (startLeft + (e.clientX - startX)) + "px";
};
window.onmouseup = () => isDragging = false;

// Inicialización
logicSyncProfiles();
