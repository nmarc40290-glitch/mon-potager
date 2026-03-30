// --- 0. SERVICE WORKER (Pour installation PWA) ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error:", err));
}

// --- 1. DATA STATE ---
// J'ai changé le nom de la clé pour éviter les conflits avec tes anciens essais manuels.
let potagerData = JSON.parse(localStorage.getItem("potager_pwa_v3")) || [];
let currentFilter = { type: 'tout', value: null };
const TODAY = new Date();
TODAY.setHours(0,0,0,0);

const MOIS_NOM = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

// --- 2. LOGIQUE DE STATUT (Calcul des Badges) ---
const GardenLogic = {
    getStatus: (p) => {
        const dStart = p.date ? new Date(p.date) : null;
        const dLevee = p.dateLevee ? new Date(p.dateLevee) : null;
        const dRecReelle = p.dateRecolteReelle ? new Date(p.dateRecolteReelle) : null;
        const dFin = (p.dateFin && p.dateFin !== "" && p.dateFin !== "Non définie") ? new Date(p.dateFin) : null;

        // 1. Arraché / Fini -> GRIS
        if (dFin && TODAY >= dFin) return { t: "Fini", c: "bg-grey" };
        
        // 2. En Récolte Réelle -> VERT
        if (dRecReelle && TODAY >= dRecReelle) return { t: "Récolte", c: "bg-green" };
        
        // 3. Cas spécifique Semis
        if (p.typeInit === 'semis') {
            // En attente récolte (levé) -> VIOLET
            if (dLevee && TODAY >= dLevee) return { t: "Levé", c: "bg-purple" };
            // Juste semé (sous terre) -> BLEU
            if (dStart && TODAY >= dStart) return { t: "Sous Terre", c: "bg-blue" };
        } else {
            // Plantation en attente récolte -> VIOLET
            if (dStart && TODAY >= dStart) return { t: "Planté", c: "bg-purple" };
        }
        
        // Défaut
        return { t: "En cours", c: "bg-blue" };
    }
};

// --- 3. INTERFACE UTILISATEUR (UI) ---
const UI = {
    init: () => {
        // Events Barre du haut et Sidebar
        document.getElementById('menuToggle').onclick = () => document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('btnAdd').onclick = () => UI.openForm();
        document.getElementById('f_typeInit').onchange = (e) => UI.updateFormLabels(e.target.value);
        document.getElementById('btnExport').onclick = UI.exportData;
        document.getElementById('fileInput').onchange = UI.importData;

        // Events Boutons Formulaire
        document.getElementById('btnCancel').onclick = () => UI.switchPage('page-list');
        document.getElementById('btnDupliquer').onclick = UI.dupliquerPlante;
        document.getElementById('btnDelete').onclick = UI.supprimerPlante;

        // Génération de la grille des mois
        const grid = document.getElementById('moisGrid');
        grid.innerHTML = "";
        MOIS_NOM.forEach(m => {
            grid.innerHTML += `
                <div class="mois-checkbox">
                    <input type="checkbox" name="f_recolte_estim" value="${m}" id="rec_${m}">
                    <label for="rec_${m}">${m}</label>
                </div>`;
        });

        // Navigation Sidebar
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
        
        // Fermeture automatique de la sidebar sur mobile
        if(window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
        
        if(pageId === 'page-list') {
            document.getElementById('header-title').innerText = "Ma Liste";
            UI.renderList();
        } else if (pageId === 'page-database') {
            document.getElementById('header-title').innerText = "Base de Données";
            UI.renderTable();
        } else if (pageId === 'page-form') {
            // Le titre est géré dans openForm
        }
    },

    updateFormLabels: (val) => {
        document.getElementById('lblDateAction').innerText = (val === 'semis') ? "Date du Semis" : "Date de Plantation";
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
        
        // Tri global par nom
        potagerData.sort((a,b) => a.nom.localeCompare(b.nom));

        // Groupement par zone
        const zones = [...new Set(potagerData.map(p => p.zone))].sort();

        zones.forEach(zName => {
            let html = `<div class="zone-box"><h2>Zone ${zName}</h2>`;
            const plants = potagerData.filter(p => p.zone === zName);
            let hasVisible = false;

            plants.forEach(p => {
                if (currentFilter.type === 'tout' || (currentFilter.type === 'nom' && currentFilter.value === p.nom)) {
                    hasVisible = true;
                    const st = GardenLogic.getStatus(p);
                    html += `
                        <div class="plante-card" onclick="UI.openForm(${p.id})">
                            <span class="badge ${st.c}">${st.t}</span>
                            <strong>${p.nom}</strong> ${p.variete ? `<small>(${p.variete})</small>` : ''}
                            <br><small>Rang ${p.rang} • ${p.typeInit}</small>
                        </div>`;
                }
            });
            html += `</div>`;
            if (hasVisible) container.innerHTML += html;
        });

        if(potagerData.length === 0) {
            container.innerHTML = "<p style='text-align:center; margin-top:50px; opacity:0.5; font-style:italic;'>Votre potager est vide.<br>Cliquez sur le + pour ajouter votre première culture.</p>";
        }
    },

    renderTable: () => {
        const tbody = document.getElementById('sqlTableBody');
        tbody.innerHTML = potagerData.sort((a,b)=>a.zone.localeCompare(b.zone)).map(p => {
            const st = GardenLogic.getStatus(p);
            return `<tr>
                <td style="font-family:monospace; font-size:0.8em; color:#7f8c8d;">#${p.id.toString().slice(-4)}</td>
                <td><b>${p.nom}</b><br><small>${p.variete || ''}</small></td>
                <td>${p.zone}</td>
                <td>${p.rang}</td>
                <td><span class="badge ${st.c}" style="float:none; font-size:0.8em;">${st.t}</span></td>
                <td><button class="btn-table-edit" onclick="UI.openForm(${p.id})">Éditer</button></td>
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
        document.getElementById('filter-indicator').innerText = val ? `(${val})` : "";
        UI.switchPage('page-list');
    },

    openForm: (id = null) => {
        const form = document.getElementById('potagerForm');
        form.reset(); // Reset basique
        
        // Reset manuel des checkbox
        document.querySelectorAll('input[name="f_recolte_estim"]').forEach(cb => cb.checked = false);
        
        document.getElementById('f_id').value = "";
        
        // Cache les boutons d'édition
        document.getElementById('area-edit-actions').style.display = "none";
        
        if (id) {
            // MODE ÉDITION
            const p = potagerData.find(x => x.id === id);
            if(!p) return;

            document.getElementById('header-title').innerText = "Modifier " + p.nom;
            document.getElementById('f_id').value = p.id;
            document.getElementById('f_nom').value = p.nom;
            document.getElementById('f_variete').value = p.variete || "";
            document.getElementById('f_zone').value = p.zone;
            document.getElementById('f_rang').value = p.rang;
            document.getElementById('f_typeInit').value = p.typeInit;
            document.getElementById('f_date').value = p.date || "";
            document.getElementById('f_date_levee').value = p.dateLevee || "";
            document.getElementById('f_date_recolte_reelle').value = p.dateRecolteReelle || "";
            document.getElementById('f_date_fin').value = (p.dateFin === "Non définie") ? "" : p.dateFin;
            document.getElementById('f_notes').value = p.notes || "";
            
            // Coche les mois estimés
            if(p.recolteEstim && Array.isArray(p.recolteEstim)) {
                p.recolteEstim.forEach(mois => {
                    const cb = document.getElementById('rec_' + mois);
                    if(cb) cb.checked = true;
                });
            }

            // Affiche les boutons Dupliquer/Supprimer
            document.getElementById('area-edit-actions').style.display = "flex";
            UI.updateFormLabels(p.typeInit);
        } else {
            // MODE CRÉATION
            document.getElementById('header-title').innerText = "Nouvelle culture";
            document.getElementById('f_typeInit').value = "semis";
            UI.updateFormLabels('semis');
        }
        UI.switchPage('page-form');
    },

    // --- ACTIONS DU FORMULAIRE ---
    dupliquerPlante: () => {
        // On vide l'ID pour forcer la création d'une nouvelle entrée
        document.getElementById('f_id').value = "";
        // On soumet le formulaire normalement
        document.getElementById('potagerForm').requestSubmit(); 
    },

    supprimerPlante: () => {
        const idStr = document.getElementById('f_id').value;
        if(!idStr) return;
        const id = parseInt(idStr);
        const p = potagerData.find(x => x.id === id);
        
        if (confirm(`Supprimer définitivement la fiche de "${p.nom}" ?`)) {
            potagerData = potagerData.filter(p => p.id !== id);
            UI.saveAndReturn();
        }
    },

    // --- SAUVEGARDE & DONNÉES ---
    saveAndReturn: () => {
        localStorage.setItem("potager_pwa_v3", JSON.stringify(potagerData));
        UI.switchPage('page-list');
    },

    exportData: () => {
        if(potagerData.length === 0) return alert("Rien à exporter.");
        const dataStr = JSON.stringify(potagerData, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = TODAY.toISOString().slice(0,10);
        a.href = url; a.download = `potager_backup_${dateStr}.json`; a.click();
    },

    importData: (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if(Array.isArray(imported)) {
                    if(confirm(`Importer ${imported.length} plantes ? Cela remplacera vos données actuelles.`)) {
                        potagerData = imported;
                        localStorage.setItem("potager_pwa_v3", JSON.stringify(potagerData));
                        location.reload(); // Recharge pour tout réinitialiser proprement
                    }
                } else {
                    alert("Fichier JSON invalide (pas un tableau).");
                }
            } catch(err) {
                alert("Erreur lors de la lecture du fichier.");
            }
        };
        reader.readAsText(file);
    }
};

// --- 4. SOUMISSION DU FORMULAIRE (CREATION / EDITION) ---
document.getElementById('potagerForm').onsubmit = (e) => {
    e.preventDefault();
    
    const nom = document.getElementById('f_nom').value;
    if(!nom) return alert("Le nom est obligatoire.");

    // Récupère l'ID existant ou en crée un nouveau
    const idField = document.getElementById('f_id').value;
    const id = idField ? parseInt(idField) : Date.now();
    
    // Récupère les mois cochés
    const recolteEstim = [];
    document.querySelectorAll('input[name="f_recolte_estim"]:checked').forEach(cb => {
        recolteEstim.push(cb.value);
    });

    const plant = {
        id,
        nom: nom,
        variete: document.getElementById('f_variete').value,
        zone: document.getElementById('f_zone').value.toUpperCase() || "A",
        rang: parseInt(document.getElementById('f_rang').value) || 1,
        typeInit: document.getElementById('f_typeInit').value,
        date: document.getElementById('f_date').value, // Date Action
        dateLevee: document.getElementById('f_date_levee').value,
        recolteEstim: recolteEstim, // Tableau des mois
        dateRecolteReelle: document.getElementById('f_date_recolte_reelle').value,
        dateFin: document.getElementById('f_date_fin').value || "Non définie",
        notes: document.getElementById('f_notes').value
    };

    // Supprime l'ancienne version (si édition) pour éviter les doublons
    potagerData = potagerData.filter(p => p.id !== id);
    
    // Ajoute la nouvelle
    potagerData.push(plant);
    
    UI.saveAndReturn();
};

// --- START ---
UI.init();
