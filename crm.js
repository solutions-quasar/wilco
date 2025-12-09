/**
 * Wilco CRM Logic
 * Handles Firebase connection, Sidebar Navigation, Local Storage Persistence, CRUD Modals, Date Navigation, Products, and Clients.
 */

const crm = {
    isMock: false,
    db: null,
    auth: null,
    leads: [],
    invoices: [],
    schedule: [],
    products: [],
    clients: [],
    activeMenuId: null,
    currentViewDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD

    init: function () {
        if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
            this.startFirebaseMode();
        } else {
            this.startMockMode();
        }

        // Pre-fill email if remembered
        const savedEmail = localStorage.getItem('wilco_saved_email');
        if (savedEmail) {
            const emailInput = document.getElementById('email');
            const rememberCheckbox = document.getElementById('remember-email');
            if (emailInput) emailInput.value = savedEmail;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }

        this.setupEventListeners();
        this.updateDateDisplay();

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.action-cell')) {
                this.closeAllMenus();
            }
        });
    },

    updateDateDisplay: function () {
        const dateEl = document.getElementById('current-date-display');
        const inputEl = document.getElementById('workday-date');

        if (dateEl && inputEl) {
            const dateObj = new Date(this.currentViewDate + 'T12:00:00');
            const options = { weekday: 'short', month: 'short', day: 'numeric' };
            dateEl.innerText = dateObj.toLocaleDateString('en-US', options);
            inputEl.value = this.currentViewDate;
        }

        this.renderSchedule();
    },

    changeDate: function (offset) {
        const date = new Date(this.currentViewDate);
        date.setDate(date.getDate() + offset);
        this.currentViewDate = date.toISOString().split('T')[0];
        this.updateDateDisplay();
    },

    setDate: function (details) {
        if (typeof details === 'string') {
            this.currentViewDate = details;
        } else {
            this.currentViewDate = details.value;
        }
        this.updateDateDisplay();
    },

    startMockMode: function () {
        this.isMock = true;
        // Banner removed per user request
        this.loadLocalData();
    },

    loadLocalData: function () {
        const localLeads = localStorage.getItem('wilco_leads');
        const localSchedule = localStorage.getItem('wilco_schedule');
        const localInvoices = localStorage.getItem('wilco_invoices');
        const localProducts = localStorage.getItem('wilco_products');
        const localClients = localStorage.getItem('wilco_clients');

        const today = new Date().toISOString().split('T')[0];

        if (localLeads) this.leads = JSON.parse(localLeads);
        else {
            this.leads = [
                { id: 'lead_1', name: 'John Doe', email: 'john@example.com', service: 'Emergency Repair', status: 'New', date: today },
                { id: 'lead_2', name: 'Sarah Smith', email: 'sarah@test.com', service: 'Water Heater', status: 'In Progress', date: today },
            ];
            this.saveLocalData();
        }

        if (localSchedule) this.schedule = JSON.parse(localSchedule);
        else {
            this.schedule = [
                { id: 'task_1', date: today, time: '09:00', title: 'Install Water Heater', address: '123 Maple St', client: 'Sarah Smith' },
            ];
            this.saveLocalData();
        }

        if (localInvoices) this.invoices = JSON.parse(localInvoices);
        else {
            this.invoices = [
                { id: 'INV-1001', client: 'Sarah Smith', clientId: 'client_2', date: today, amount: '450.00', status: 'Paid', items: [] },
            ];
            this.saveLocalData();
        }

        if (localProducts) this.products = JSON.parse(localProducts);
        else {
            this.products = [
                { id: 'prod_1', name: 'Service Call', category: 'Service', price: '99.00' },
                { id: 'prod_2', name: 'Water Heater Install', category: 'Labor', price: '450.00' },
                { id: 'prod_3', name: 'Copper Pipe (10ft)', category: 'Materials', price: '25.50' },
            ];
            this.saveLocalData();
        }

        if (localClients) this.clients = JSON.parse(localClients);
        else {
            this.clients = [
                { id: 'client_1', name: 'John Doe', email: 'john@example.com', phone: '555-0101', address: '456 Oak Ave' },
                { id: 'client_2', name: 'Sarah Smith', email: 'sarah@test.com', phone: '555-0102', address: '123 Maple St' },
            ];
            this.saveLocalData();
        }

        this.renderAllViews();
    },

    saveLocalData: function () {
        if (!this.isMock) return;
        localStorage.setItem('wilco_leads', JSON.stringify(this.leads));
        localStorage.setItem('wilco_schedule', JSON.stringify(this.schedule));
        localStorage.setItem('wilco_invoices', JSON.stringify(this.invoices));
        localStorage.setItem('wilco_products', JSON.stringify(this.products));
        localStorage.setItem('wilco_clients', JSON.stringify(this.clients));
    },

    startFirebaseMode: function () {
        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK not loaded");
            alert("Critical Error: Firebase SDK not found. Check internet connection.");
            return;
        }

        try {
            // Initialize Firebase if not already done
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.firestore();
            this.auth = firebase.auth();
            console.log("Firebase initialized successfully");

            // Explicitly set persistence
            this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => {
                    this.auth.onAuthStateChanged(user => {
                        if (user) {
                            this.showDashboard(user.email);
                            this.loadFirestoreData();
                        } else {
                            this.showLogin();
                        }
                    });
                })
                .catch((error) => {
                    console.error("Auth Persistence Error:", error);
                    // Fallback to basic listener if persistence fails
                    this.auth.onAuthStateChanged(user => {
                        if (user) { this.showDashboard(user.email); this.loadFirestoreData(); }
                        else { this.showLogin(); }
                    });
                });

        } catch (e) {
            console.error("Firebase Init Error:", e);
            alert("Firebase Init Failed: " + e.message + "\nCheck your firebase_config.js!");
        }
    },

    loadFirestoreData: async function () {
        if (!this.db) return;

        try {
            const leadsSnap = await this.db.collection('leads').get();
            const tasksSnap = await this.db.collection('tasks').get();
            const invoicesSnap = await this.db.collection('invoices').get();
            const productsSnap = await this.db.collection('products').get();
            const clientsSnap = await this.db.collection('clients').get();

            // Check if DB is completely fresh/empty
            if (leadsSnap.empty && tasksSnap.empty && invoicesSnap.empty && productsSnap.empty && clientsSnap.empty) {
                console.log("Database empty. Seeding defaults...");
                await this.seedFirestoreData();
                return; // seed function will reload data
            }

            this.leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.schedule = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.renderAllViews();
            console.log("Firestore Data Loaded");
        } catch (error) {
            console.error("Error loading Firestore data:", error);
            alert("Database Error: " + error.message + "\n\nCheck your Firestore Security Rules!");
        }
    },

    forceSeed: async function () {
        if (confirm("This will attempt to write default data to your database. Continue?")) {
            await this.seedFirestoreData();
        }
    },

    seedFirestoreData: async function () {
        const today = new Date().toISOString().split('T')[0];
        const batch = this.db.batch();

        const defaultLeads = [
            { id: 'lead_1', name: 'John Doe', email: 'john@example.com', service: 'Emergency Repair', status: 'New', date: today }
        ];
        const defaultTasks = [
            { id: 'task_1', date: today, time: '09:00', title: 'Install Water Heater', address: '123 Maple St', client: 'Sarah Smith' }
        ];
        const defaultInvoices = [
            { id: 'INV-1001', client: 'Sarah Smith', clientId: 'client_2', date: today, amount: '450.00', status: 'Paid', items: [] }
        ];
        const defaultProducts = [
            { id: 'prod_1', name: 'Service Call', category: 'Service', price: '99.00' },
            { id: 'prod_2', name: 'Water Heater Install', category: 'Labor', price: '450.00' },
            { id: 'prod_3', name: 'Copper Pipe (10ft)', category: 'Materials', price: '25.50' }
        ];
        const defaultClients = [
            { id: 'client_1', name: 'John Doe', email: 'john@example.com', phone: '555-0101', address: '456 Oak Ave' },
            { id: 'client_2', name: 'Sarah Smith', email: 'sarah@test.com', phone: '555-0102', address: '123 Maple St' }
        ];

        // Add to batch
        defaultLeads.forEach(item => batch.set(this.db.collection('leads').doc(item.id), item));
        defaultTasks.forEach(item => batch.set(this.db.collection('tasks').doc(item.id), item));
        defaultInvoices.forEach(item => batch.set(this.db.collection('invoices').doc(item.id), item));
        defaultProducts.forEach(item => batch.set(this.db.collection('products').doc(item.id), item));
        defaultClients.forEach(item => batch.set(this.db.collection('clients').doc(item.id), item));

        try {
            await batch.commit();
            console.log("Database Seeded Successfully.");
            alert("Success! Default data has been written to your database.");
            this.loadFirestoreData(); // Reload to render
        } catch (error) {
            console.error("Error Seeding DB:", error);
            alert("Seeding Failed: " + error.message + "\n\nLikely a permission issue.");
        }
    },

    setupEventListeners: function () {
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberEmail = document.getElementById('remember-email') ? document.getElementById('remember-email').checked : false;
            const staySignedIn = document.getElementById('stay-signed-in') ? document.getElementById('stay-signed-in').checked : true;

            // Handle "Remember Email"
            if (rememberEmail) {
                localStorage.setItem('wilco_saved_email', email);
            } else {
                localStorage.removeItem('wilco_saved_email');
            }

            if (this.isMock) {
                const userEmail = email || "admin@wilco.com";
                this.showDashboard(userEmail);
                this.renderAllViews();
            } else {
                // Firebase Login
                try {
                    const persistence = staySignedIn
                        ? firebase.auth.Auth.Persistence.LOCAL
                        : firebase.auth.Auth.Persistence.SESSION;

                    await this.auth.setPersistence(persistence);
                    await this.auth.signInWithEmailAndPassword(email, password);
                    // onAuthStateChanged will handle the redirect
                } catch (error) {
                    console.error("Login Error:", error);
                    alert("Login Failed: " + error.message);
                }
            }
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            if (!this.isMock && this.auth) {
                this.auth.signOut().then(() => this.showLogin());
            } else {
                this.showLogin();
            }
        });

        document.getElementById('modal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveModalData();
        });
    },

    showDashboard: function (email) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-wrapper').style.display = 'flex';
        document.getElementById('user-email').innerText = email;
        this.updateDateDisplay();
    },

    showLogin: function () {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-wrapper').style.display = 'none';
    },

    switchView: function (viewId) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        if (viewId === 'daily') this.updateDateDisplay();
    },

    // --- MODAL SYSTEM ---

    openModal: function (type, id = null) {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const container = document.getElementById('modal-fields');
        const idField = document.getElementById('modal-id');
        const typeField = document.getElementById('modal-type');

        container.innerHTML = '';
        idField.value = id || '';
        typeField.value = type;

        let data = null;
        if (id) {
            if (type === 'lead') data = this.leads.find(x => x.id == id);
            if (type === 'task') data = this.schedule.find(x => x.id == id);
            if (type === 'invoice') data = this.invoices.find(x => x.id == id);
            if (type === 'product') data = this.products.find(x => x.id == id);
            if (type === 'client') data = this.clients.find(x => x.id == id);
        }

        if (type === 'lead') {
            title.innerText = id ? 'Edit Lead' : 'New Lead';
            container.innerHTML = `
                <div class="input-group">
                    <label>Customer Name</label>
                    <input type="text" name="name" value="${data ? data.name : ''}" required>
                </div>
                <div class="input-group">
                    <label>Email / Phone</label>
                    <input type="text" name="email" value="${data ? data.email : ''}">
                </div>
                <div class="input-group">
                    <label>Service Type</label>
                    <select name="service">
                        <option value="Emergency Repair" ${data && data.service == 'Emergency Repair' ? 'selected' : ''}>Emergency Repair</option>
                        <option value="Water Heater" ${data && data.service == 'Water Heater' ? 'selected' : ''}>Water Heater</option>
                        <option value="Renovation" ${data && data.service == 'Renovation' ? 'selected' : ''}>Renovation</option>
                        <option value="Inspection" ${data && data.service == 'Inspection' ? 'selected' : ''}>Inspection</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="New" ${data && data.status == 'New' ? 'selected' : ''}>New</option>
                        <option value="In Progress" ${data && data.status == 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Closed" ${data && data.status == 'Closed' ? 'selected' : ''}>Closed</option>
                        <option value="Archived" ${data && data.status == 'Archived' ? 'selected' : ''}>Archived</option>
                    </select>
                </div>
            `;
        }

        if (type === 'task') {
            title.innerText = id ? 'Edit Task' : 'New Task';
            const defaultDate = this.currentViewDate;
            container.innerHTML = `
                <div class="input-group">
                    <label>Job Title</label>
                    <input type="text" name="title" value="${data ? data.title : ''}" required placeholder="e.g. Install Sink">
                </div>
                <div class="input-group" style="display: flex; gap: 1rem;">
                    <div style="flex: 1;">
                        <label>Date</label>
                        <input type="date" name="date" value="${data ? data.date : defaultDate}" required>
                    </div>
                    <div style="flex: 1;">
                        <label>Time</label>
                        <input type="time" name="time" value="${data ? data.time : '09:00'}" required>
                    </div>
                </div>
                <div class="input-group">
                    <label>Client Name</label>
                    <input type="text" name="client" value="${data ? data.client : ''}">
                </div>
                <div class="input-group">
                    <label>Address</label>
                    <input type="text" name="address" value="${data ? data.address : ''}">
                </div>
            `;
        }

        if (type === 'product') {
            title.innerText = id ? 'Edit Product' : 'New Product';
            container.innerHTML = `
                <div class="input-group">
                    <label>Product Name</label>
                    <input type="text" name="name" value="${data ? data.name : ''}" required>
                </div>
                <div class="input-group">
                    <label>Category</label>
                    <select name="category">
                        <option value="Service" ${data && data.category == 'Service' ? 'selected' : ''}>Service</option>
                        <option value="Labor" ${data && data.category == 'Labor' ? 'selected' : ''}>Labor</option>
                        <option value="Materials" ${data && data.category == 'Materials' ? 'selected' : ''}>Materials</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Price ($)</label>
                    <input type="number" name="price" step="0.01" value="${data ? data.price : ''}" required placeholder="0.00">
                </div>
            `;
        }

        if (type === 'client') {
            title.innerText = id ? 'Edit Client' : 'New Client';
            container.innerHTML = `
                <div class="input-group">
                    <label>Client Name</label>
                    <input type="text" name="name" value="${data ? data.name : ''}" required>
                </div>
                <div class="input-group">
                    <label>Email</label>
                    <input type="email" name="email" value="${data ? data.email : ''}" required>
                </div>
                <div class="input-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value="${data ? data.phone : ''}">
                </div>
                <div class="input-group">
                    <label>Address</label>
                    <input type="text" name="address" value="${data ? data.address : ''}">
                </div>
            `;
        }

        if (type === 'invoice') {
            title.innerText = id ? 'Edit Invoice' : 'New Invoice';
            const today = new Date().toISOString().split('T')[0];

            // Client Dropdown Options
            const clientOptions = this.clients.map(c =>
                `<option value="${c.id}" ${data && (data.clientId === c.id || data.client === c.name) ? 'selected' : ''}>${c.name}</option>`
            ).join('');

            container.innerHTML = `
                <div class="input-group">
                    <label>Client</label>
                    <select name="clientId" required>
                        <option value="">Select a Client...</option>
                        ${clientOptions}
                    </select>
                </div>
                <div class="input-group">
                    <label>Date Issued</label>
                    <input type="date" name="date" value="${data ? data.date : today}" required>
                </div>
                <div class="input-group">
                    <label>Status</label>
                    <select name="status">
                        <option value="Draft" ${data && data.status == 'Draft' ? 'selected' : ''}>Draft</option>
                        <option value="Sent" ${data && data.status == 'Sent' ? 'selected' : ''}>Sent</option>
                        <option value="Paid" ${data && data.status == 'Paid' ? 'selected' : ''}>Paid</option>
                        <option value="Cancelled" ${data && data.status == 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                
                <hr style="border: 0; border-top: 1px solid var(--border); margin: 1.5rem 0;">
                
                <label style="display:block; margin-bottom: 0.5rem; color: var(--text-muted);">Line Items</label>
                <div id="line-items-container"></div>
                <button type="button" class="btn-secondary small" onclick="crm.addLineItem()">+ Add Item</button>

                <div class="invoice-total-row">
                    <span>Total:</span>
                    <span id="invoice-total">$${data ? data.amount : '0.00'}</span>
                    <input type="hidden" name="amount" id="invoice-amount-input" value="${data ? data.amount : '0.00'}">
                </div>
            `;

            // Add existing items or one blank
            if (data && data.items && data.items.length > 0) {
                data.items.forEach(item => crm.addLineItem(item));
            } else {
                crm.addLineItem(); // One empty row
            }

            this.recalcTotal();
        }

        modal.classList.add('open');
    },

    addLineItem: function (item = null) {
        const container = document.getElementById('line-items-container');
        const row = document.createElement('div');
        row.className = 'line-item-row';

        const productOptions = this.products.map(p =>
            `<option value="${p.id}" data-price="${p.price}" ${item && item.productId == p.id ? 'selected' : ''}>${p.name}</option>`
        ).join('');

        row.innerHTML = `
            <select class="item-select" onchange="crm.updateLineItem(this)">
                <option value="">Select Product...</option>
                ${productOptions}
            </select>
            <input type="number" class="item-qty" value="${item ? item.qty : 1}" min="1" onchange="crm.recalcTotal()">
            <input type="number" class="item-price" value="${item ? item.price : '0.00'}" step="0.01" onchange="crm.recalcTotal()">
            <button type="button" class="btn-icon danger" onclick="this.parentElement.remove(); crm.recalcTotal()">×</button>
        `;
        container.appendChild(row);

        if (!item) {
            // New item logic if needed
        }
    },

    updateLineItem: function (selectEl) {
        const row = selectEl.parentElement;
        const priceInput = row.querySelector('.item-price');
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const price = selectedOption.getAttribute('data-price');

        if (price) {
            priceInput.value = price;
        }
        this.recalcTotal();
    },

    recalcTotal: function () {
        const rows = document.querySelectorAll('.line-item-row');
        let total = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const price = parseFloat(row.querySelector('.item-price').value) || 0;
            total += qty * price;
        });

        document.getElementById('invoice-total').innerText = '$' + total.toFixed(2);
        document.getElementById('invoice-amount-input').value = total.toFixed(2);
    },

    closeModal: function () {
        document.getElementById('modal-overlay').classList.remove('open');
    },

    saveModalData: async function () {
        const form = document.getElementById('modal-form');
        const id = document.getElementById('modal-id').value;
        const formType = document.getElementById('modal-type').value;

        // Base object
        const newItem = {
            id: id || `${formType}_${Date.now()}`,
        };

        // Extract Data using FormData (Robust)
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
            if (key !== 'id' && key !== 'type') {
                newItem[key] = value;
            }
        }

        // Handle Invoice Specifics (Line Items)
        if (formType === 'invoice') {
            const items = [];
            document.querySelectorAll('.line-item-row').forEach(row => {
                const prodId = row.querySelector('.item-select').value;
                if (prodId) {
                    items.push({
                        productId: prodId,
                        qty: row.querySelector('.item-qty').value,
                        price: row.querySelector('.item-price').value
                    });
                }
            });
            newItem.items = items;

            // Map Client ID to Name
            const client = this.clients.find(c => c.id === newItem.clientId);
            if (client) newItem.client = client.name;
        }

        // Collection Mapping & Local Update
        let collectionName = '';
        if (formType === 'lead') {
            if (!newItem.date) newItem.date = new Date().toISOString().split('T')[0];
            collectionName = 'leads';
            this.updateLocalArray('leads', newItem);
        } else if (formType === 'task') {
            collectionName = 'tasks';
            this.updateLocalArray('schedule', newItem);
        } else if (formType === 'invoice') {
            collectionName = 'invoices';
            this.updateLocalArray('invoices', newItem);
        } else if (formType === 'product') {
            collectionName = 'products';
            this.updateLocalArray('products', newItem);
        } else if (formType === 'client') {
            collectionName = 'clients';
            this.updateLocalArray('clients', newItem);
        }

        console.log(`Attempting to save [${formType}] to Firestore. ID: ${newItem.id}`, newItem);

        // Firestore Write
        if (!this.isMock && collectionName) {
            try {
                await this.db.collection(collectionName).doc(newItem.id).set(newItem);
                console.log(`SUCCESS: Saved to Firestore collection [${collectionName}].`);
            } catch (error) {
                console.error("Firestore Save Error:", error);
                alert("Error Saving Data to Database:\n" + error.message);
                return; // Stop local save if DB failed
            }
        }

        this.saveLocalData();
        this.renderAllViews();
        this.closeModal();
    },

    updateLocalArray: function (arrayName, newItem) {
        const index = this[arrayName].findIndex(x => x.id == newItem.id);
        if (index !== -1) {
            this[arrayName][index] = { ...this[arrayName][index], ...newItem };
        } else {
            // Add to beginning for invoices/leads, end for others logic preserved
            if (arrayName === 'leads' || arrayName === 'invoices') {
                this[arrayName].unshift(newItem);
            } else {
                this[arrayName].push(newItem);
            }
        }
    },

    // --- QUICK ACTIONS ---
    toggleMenu: function (id, event) {
        if (event) event.stopPropagation();
        const menu = document.getElementById(`menu-${id}`);
        const isVisible = menu.classList.contains('show');
        this.closeAllMenus();
        if (!isVisible) menu.classList.add('show');
    },

    closeAllMenus: function () {
        document.querySelectorAll('.action-menu').forEach(el => el.classList.remove('show'));
    },

    deleteItem: async function (type, id) {
        if (!confirm("Delete this item?")) return;

        // Firestore Delete
        if (!this.isMock) {
            try {
                let collectionName = '';
                if (type === 'lead') collectionName = 'leads';
                if (type === 'task') collectionName = 'tasks';
                if (type === 'invoice') collectionName = 'invoices';
                if (type === 'product') collectionName = 'products';
                if (type === 'client') collectionName = 'clients';

                if (collectionName) {
                    await this.db.collection(collectionName).doc(id).delete();
                    console.log(`Deleted from Firestore: ${collectionName}/${id}`);
                }
            } catch (error) {
                console.error("Firestore Delete Error:", error);
                alert("Delete Failed: " + error.message);
                return;
            }
        }

        // Local Update
        if (type === 'lead') this.leads = this.leads.filter(x => x.id != id);
        if (type === 'task') this.schedule = this.schedule.filter(x => x.id != id);
        if (type === 'invoice') this.invoices = this.invoices.filter(x => x.id != id);
        if (type === 'product') this.products = this.products.filter(x => x.id != id);
        if (type === 'client') this.clients = this.clients.filter(x => x.id != id);

        this.saveLocalData();
        this.renderAllViews();
    },

    archiveItem: async function (type, id) {
        // Firestore Update
        if (!this.isMock && type === 'lead') {
            try {
                await this.db.collection('leads').doc(id).update({ status: 'Archived' });
            } catch (error) {
                console.error("Firestore Archive Error:", error);
                alert("Archive Failed: " + error.message);
                return;
            }
        }

        if (type === 'lead') {
            const item = this.leads.find(x => x.id == id);
            if (item) item.status = 'Archived';
        }
        this.saveLocalData();
        this.renderAllViews();
    },

    // --- RENDERERS ---

    renderAllViews: function () {
        this.renderLeads();
        this.updateStats();
        this.renderSchedule();
        this.renderInvoices();
        this.renderProducts();
        this.renderClients();
    },

    renderLeads: function () {
        const tbody = document.getElementById('leads-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.leads.forEach(lead => {
            const tr = document.createElement('tr');
            tr.onclick = () => crm.openModal('lead', lead.id); // Row click
            if (lead.status === 'Archived') tr.classList.add('archived');

            let badge = 'badge-new';
            if (lead.status === 'In Progress') badge = 'badge-pending';
            if (lead.status === 'Closed') badge = 'badge-closed';
            if (lead.status === 'Archived') badge = 'badge-archived';

            tr.innerHTML = `
                <td>${lead.date}</td>
                <td><strong>${lead.name}</strong><br><small>${lead.email || ''}</small></td>
                <td>${lead.service}</td>
                <td><span class="badge ${badge}">${lead.status}</span></td>
                <td class="action-cell" onclick="event.stopPropagation()"> <!-- Stop propagation for cell -->
                    <button class="action-trigger" onclick="crm.toggleMenu('${lead.id}', event)">⋮</button>
                    <div id="menu-${lead.id}" class="action-menu">
                        <button onclick="crm.openModal('lead', '${lead.id}')">Edit</button>
                        <button onclick="crm.archiveItem('lead', '${lead.id}')">Archive</button>
                        <button class="danger" onclick="crm.deleteItem('lead', '${lead.id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderSchedule: function () {
        const container = document.getElementById('schedule-list');
        if (!container) return;
        container.innerHTML = '';

        const daysTasks = this.schedule.filter(x => x.date === this.currentViewDate);
        daysTasks.sort((a, b) => a.time.localeCompare(b.time));

        if (daysTasks.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:2rem;">No tasks scheduled for this day.</div>`;
            return;
        }

        daysTasks.forEach(item => {
            const div = document.createElement('div');
            div.className = 'schedule-item';
            div.onclick = () => crm.openModal('task', item.id); // Item click
            div.innerHTML = `
                <div class="time-slot">${item.time}</div>
                <div class="task-details">
                    <h4>${item.title}</h4>
                    <p>Client: ${item.client} • Location: ${item.address}</p>
                </div>
                <div style="margin-left: auto; position: relative;" class="action-cell" onclick="event.stopPropagation()">
                     <button class="action-trigger" onclick="crm.toggleMenu('${item.id}', event)">⋮</button>
                     <div id="menu-${item.id}" class="action-menu">
                        <button onclick="crm.openModal('task', '${item.id}')">Edit</button>
                        <button class="danger" onclick="crm.deleteItem('task', '${item.id}')">Delete</button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    renderInvoices: function () {
        const tbody = document.getElementById('invoices-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.invoices.forEach(inv => {
            const tr = document.createElement('tr');
            tr.onclick = () => crm.openModal('invoice', inv.id); // Row click
            let badge = inv.status === 'Paid' ? 'badge-paid' : (inv.status === 'Sent' ? 'badge-sent' : 'badge-closed');
            tr.innerHTML = `
                <td>${inv.id}</td>
                <td>${inv.client}</td>
                <td>${inv.date}</td>
                <td><strong>$${inv.amount}</strong></td>
                <td><span class="badge ${badge}">${inv.status}</span></td>
                <td class="action-cell" onclick="event.stopPropagation()">
                    <button class="action-trigger" onclick="crm.toggleMenu('${inv.id}', event)">⋮</button>
                    <div id="menu-${inv.id}" class="action-menu">
                        <button onclick="crm.openModal('invoice', '${inv.id}')">Edit</button>
                        <button class="danger" onclick="crm.deleteItem('invoice', '${inv.id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderProducts: function () {
        const tbody = document.getElementById('products-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.products.forEach(prod => {
            const tr = document.createElement('tr');
            tr.onclick = () => crm.openModal('product', prod.id); // Row click
            tr.innerHTML = `
                <td>${prod.name}</td>
                <td>${prod.category}</td>
                <td>$${prod.price}</td>
                <td class="action-cell" onclick="event.stopPropagation()">
                    <button class="action-trigger" onclick="crm.toggleMenu('${prod.id}', event)">⋮</button>
                    <div id="menu-${prod.id}" class="action-menu">
                        <button onclick="crm.openModal('product', '${prod.id}')">Edit</button>
                        <button class="danger" onclick="crm.deleteItem('product', '${prod.id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderClients: function () {
        const tbody = document.getElementById('clients-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.clients.forEach(c => {
            const tr = document.createElement('tr');
            tr.onclick = () => crm.openModal('client', c.id); // Row click
            tr.innerHTML = `
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.phone}</td>
                <td class="action-cell" onclick="event.stopPropagation()">
                    <button class="action-trigger" onclick="crm.toggleMenu('${c.id}', event)">⋮</button>
                    <div id="menu-${c.id}" class="action-menu">
                        <button onclick="crm.openModal('client', '${c.id}')">Edit</button>
                        <button class="danger" onclick="crm.deleteItem('client', '${c.id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    updateStats: function () {
        const newLeads = this.leads.filter(l => l.status === 'New').length;
        const active = this.leads.filter(l => l.status === 'In Progress').length;
        const invoiceRevenue = this.invoices
            .filter(i => i.status === 'Paid')
            .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

        document.getElementById('stats-new').innerText = newLeads;
        document.getElementById('stats-active').innerText = active;
        document.getElementById('stats-revenue').innerText = '$' + invoiceRevenue.toLocaleString();
    }
};

document.addEventListener('DOMContentLoaded', () => crm.init());
