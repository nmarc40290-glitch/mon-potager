// --- 0. SERVICE WORKER (Pour installation PWA) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
}

// --- 1. DATA STATE ---
let potagerData = JSON.parse(localStorage.getItem("potager_pwa_v1")) || [];
let currentFilter = { type: 'tout', value: null };

// --- 2. LOGIQUE DE STATUT ---
const GardenLogic = {
    getStatus: (p) => {
        const today = new Date();
        today.setHours(0,0,0,0);

        if (p.dateFin && p.dateFin !== "" && today >= new Date(p.dateFin)) return { t: "Fini", c: "bg-grey" };
        if (p.dateRecolte && p.dateRecolte !== "" && today >= new Date(p.dateRecolte)) return { t: "Récolte", c: "bg-green" };
        
        if (p.typeInit === 'semis') {
            if (!p.dateLevee || p.dateLevee === "" || today < new Date(p.dateLevee)) return { t: "Sous Terre", c: "bg-blue" };
        }
        return { t: "En cours", c: "bg-purple" };
    }
};

// --- 3. INTERFACE UTILISATEUR (UI) ---
const UI = {
    init: () => {
        // Events
        document.getElementById('menuToggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('btnAdd').onclick = () => UI.openForm();
        document.getElementById('btnCancel').onclick = () => UI.switchPage('page-list');
        document.getElementById('f_typeInit').onchange = (e) => UI.updateFormLabels(e.target.value);
        document.getElementById('btnExport').onclick = UI.exportData;
        document.getElementById('fileInput').onchange = UI.importData;

        document.querySelectorAll('.nav-link').forEach(link => {
            link.onclick = () => UI.switchPage(link.dataset.target);
        });

        UI.renderAll();
    },

    switchPage: (pageId) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        document.querySelector(`[data-target="${pageId}"]`)?.classList.add('active');
        document.getElementById('sidebar').classList.remove('open');
        UI.renderAll();
    },

    updateFormLabels: (val) => {
        document.getElementById('lblDate').innerText = (val === 'semis') ? "Date du Semis" : "Date de Plantation";
        document.getElementById('fieldLevee').style.display = (val === 'semis') ? 'block' : 'none';
    },

    renderAll: () => {
        UI.renderList();
        UI.renderTable();
        UI.renderFilters();
    },

    renderList: () => {
        const container = document.getElementById('listContainer');
        container.innerHTML = "";
        const zones = [...new Set(potagerData.map(p => p.zone))].sort();

        zones.forEach(zName => {
            let html = `<div class="zone-box"><h2>Zone ${zName}</h2>`;
            const plants = potagerData.filter(p => p.zone === zName);
            let hasVisible = false;

            plants.forEach(p => {
                if (currentFilter.type === 'tout' || (currentFilter.type === 'nom' && currentFilter.value === p.nom)) {
                    hasVisible = true;
                    const st = GardenLogic.getStatus(p);
                    html += `<div class="plante-card" onclick="UI.openForm(${p.id})">
                        <span class="badge ${st.c}">${st.t}</span>
                        <strong>${p.nom}</strong><br><small>Rang ${p.rang} • ${p.typeInit}</small>
                    </div>`;
                }
            });
            html += `</div>`;
            if (hasVisible) container.innerHTML += html;
        });
        if(potagerData.length === 0) container.innerHTML = "<p style='text-align:center; margin-top:50px; opacity:0.5;'>Aucune plante. Cliquez sur + pour commencer.</p>";
    },

    renderTable: () => {
        const tbody = document.getElementById('sqlTableBody');
        tbody.innerHTML = potagerData.sort((a,b)=>a.zone.localeCompare(b.zone)).map(p => {
            const st = GardenLogic.getStatus(p);
            return `<tr>
                <td style="font-family:monospace; font-size:0.8em; color:blue;">#${p.id.toString().slice(-4)}</td>
                <td><b>${p.nom}</b></td>
                <td>${p.zone}</td>
                <td>${p.rang}</td>
                <td><span class="badge ${st.c}" style="float:none; font-size:0.8em;">${st.t}</span></td>
                <td><button onclick="UI.openForm(${p.id})">Edit</button></td>
            </tr>`;
        }).join('');
    },

    renderFilters: () => {
        const div = document.getElementById('dynamic-filters');
        const names = [...new Set(potagerData.map(p => p.nom))].sort();
        div.innerHTML = `<a class="cat-link" onclick="UI.setFilter('tout', null)">✨ Tout afficher</a>`;
        names.forEach(n => {
            div.innerHTML += `<a class="cat-link" onclick="UI.setFilter('nom', '${n}')">${n}</a>`;
        });
    },

    setFilter: (type, val) => {
        currentFilter = { type, value: val };
        UI.switchPage('page-list');
    },

    openForm: (id = null) => {
        const form = document.getElementById('potagerForm');
        form.reset();
        document.getElementById('f_id').value = "";
        document.getElementById('btnDelete').style.display = "none";
        
        if (id) {
            const p = potagerData.find(x => x.id === id);
            document.getElementById('f_id').value = p.id;
            document.getElementById('f_nom').value = p.nom;
            document.getElementById('f_zone').value = p.zone;
            document.getElementById('f_rang').value = p.rang;
            document.getElementById('f_typeInit').value = p.typeInit;
            document.getElementById('f_date').value = p.date;
            document.getElementById('f_date_levee').value = p.dateLevee || "";
            document.getElementById('f_date_recolte').value = p.dateRecolte || "";
            document.getElementById('f_date_fin').value = p.dateFin || "";
            document.getElementById('f_notes').value = p.notes || "";
            document.getElementById('btnDelete').style.display = "block";
            UI.updateFormLabels(p.typeInit);
        } else {
            UI.updateFormLabels('semis');
        }
        UI.switchPage('page-form');
    },

    exportData: () => {
        const dataStr = JSON.stringify(potagerData);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = "potager_export.json"; a.click();
    },

    importData: (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            potagerData = JSON.parse(event.target.result);
            localStorage.setItem("potager_pwa_v1", JSON.stringify(potagerData));
            UI.renderAll();
            UI.switchPage('page-list');
        };
        reader.readAsText(e.target.files[0]);
    }
};

// --- 4. FORM SUBMISSION ---
document.getElementById('potagerForm').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('f_id').value ? parseInt(document.getElementById('f_id').value) : Date.now();
    
    const plant = {
        id,
        nom: document.getElementById('f_nom').value,
        zone: document.getElementById('f_zone').value.toUpperCase() || "A",
        rang: document.getElementById('f_rang').value,
        typeInit: document.getElementById('f_typeInit').value,
        date: document.getElementById('f_date').value,
        dateLevee: document.getElementById('f_date_levee').value,
        dateRecolte: document.getElementById('f_date_recolte').value,
        dateFin: document.getElementById('f_date_fin').value,
        notes: document.getElementById('f_notes').value
    };

    potagerData = potagerData.filter(p => p.id !== id);
    potagerData.push(plant);
    localStorage.setItem("potager_pwa_v1", JSON.stringify(potagerData));
    UI.switchPage('page-list');
};

document.getElementById('btnDelete').onclick = () => {
    if (confirm("Supprimer définitivement cette fiche ?")) {
        const id = parseInt(document.getElementById('f_id').value);
        potagerData = potagerData.filter(p => p.id !== id);
        localStorage.setItem("potager_pwa_v1", JSON.stringify(potagerData));
        UI.switchPage('page-list');
    }
};

// --- START ---
UI.init();
