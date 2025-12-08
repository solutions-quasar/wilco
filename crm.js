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
        if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey === "YOUR_API_KEY") {
            this.startMockMode();
        } else {
            this.startFirebaseMode();
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
        document.getElementById('mock-banner').style.display = 'block';
        document.getElementById('mock-banner').innerHTML = "LOCAL DATABASE MODE &bull; Changes saved to browser";
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
        console.log("Firebase mode init (placeholder)");
        this.showLogin();
    },

    setupEventListeners: function () {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            let email = document.getElementById('email').value;
            if (this.isMock) {
                if (!email) email = "admin@wilco.com";
                this.showDashboard(email);
                this.renderAllViews();
            }
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.showLogin();
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

    saveModalData: function () {
        const form = document.getElementById('modal-form');
        // Manual scraping because FormData can be finicky in pure JS simple implementations
        const id = document.getElementById('modal-id').value;
        const formType = document.getElementById('modal-type').value;

        // Base object
        const newItem = {
            id: id || `${formType}_${Date.now()}`,
        };

        // Add basic fields
        for (let i = 0; i < form.elements.length; i++) {
            const field = form.elements[i];
            if (field.name && field.type !== 'submit') {
                newItem[field.name] = field.value;
            }
        }

        // Handle Invoice Specifics
        if (formType === 'invoice') {
            const items = [];
            document.querySelectorAll('.line-item-row').forEach(row => {
                items.push({
                    productId: row.querySelector('.item-select').value,
                    qty: row.querySelector('.item-qty').value,
                    price: row.querySelector('.item-price').value
                });
            });
            newItem.items = items;

            // Map Client ID to Name for display
            const client = this.clients.find(c => c.id === newItem.clientId);
            if (client) newItem.client = client.name;
        }

        // Logic by type
        if (formType === 'lead') {
            if (!newItem.date) newItem.date = new Date().toISOString().split('T')[0];
            if (id) {
                const index = this.leads.findIndex(x => x.id == id);
                if (index !== -1) this.leads[index] = { ...this.leads[index], ...newItem };
            } else {
                this.leads.unshift(newItem);
            }
        } else if (formType === 'task') {
            if (id) {
                const index = this.schedule.findIndex(x => x.id == id);
                if (index !== -1) this.schedule[index] = { ...this.schedule[index], ...newItem };
            } else {
                this.schedule.push(newItem);
            }
        } else if (formType === 'invoice') {
            if (id) {
                const index = this.invoices.findIndex(x => x.id == id);
                if (index !== -1) this.invoices[index] = { ...this.invoices[index], ...newItem };
            } else {
                this.invoices.unshift(newItem);
            }
        } else if (formType === 'product') {
            if (id) {
                const index = this.products.findIndex(x => x.id == id);
                if (index !== -1) this.products[index] = { ...this.products[index], ...newItem };
            } else {
                this.products.push(newItem);
            }
        } else if (formType === 'client') {
            if (id) {
                const index = this.clients.findIndex(x => x.id == id);
                if (index !== -1) this.clients[index] = { ...this.clients[index], ...newItem };
            } else {
                this.clients.push(newItem);
            }
        }

        this.saveLocalData();
        this.renderAllViews();
        this.closeModal();
    },

    // --- QUICK ACTIONS ---
    toggleMenu: function (id) {
        const menu = document.getElementById(`menu-${id}`);
        const isVisible = menu.classList.contains('show');
        this.closeAllMenus();
        if (!isVisible) menu.classList.add('show');
    },

    closeAllMenus: function () {
        document.querySelectorAll('.action-menu').forEach(el => el.classList.remove('show'));
    },

    deleteItem: function (type, id) {
        if (!confirm("Delete this item?")) return;
        if (type === 'lead') this.leads = this.leads.filter(x => x.id != id);
        if (type === 'task') this.schedule = this.schedule.filter(x => x.id != id);
        if (type === 'invoice') this.invoices = this.invoices.filter(x => x.id != id);
        if (type === 'product') this.products = this.products.filter(x => x.id != id);
        if (type === 'client') this.clients = this.clients.filter(x => x.id != id);

        this.saveLocalData();
        this.renderAllViews();
    },

    archiveItem: function (type, id) {
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
                <td class="action-cell">
                    <button class="action-trigger" onclick="crm.toggleMenu('${lead.id}')">⋮</button>
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
            div.innerHTML = `
                <div class="time-slot">${item.time}</div>
                <div class="task-details">
                    <h4>${item.title}</h4>
                    <p>Client: ${item.client} • Location: ${item.address}</p>
                </div>
                <div style="margin-left: auto; position: relative;" class="action-cell">
                     <button class="action-trigger" onclick="crm.toggleMenu('${item.id}')">⋮</button>
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
            let badge = inv.status === 'Paid' ? 'badge-paid' : (inv.status === 'Sent' ? 'badge-sent' : 'badge-closed');
            tr.innerHTML = `
                <td>${inv.id}</td>
                <td>${inv.client}</td>
                <td>${inv.date}</td>
                <td><strong>$${inv.amount}</strong></td>
                <td><span class="badge ${badge}">${inv.status}</span></td>
                <td class="action-cell">
                    <button class="action-trigger" onclick="crm.toggleMenu('${inv.id}')">⋮</button>
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
            tr.innerHTML = `
                <td>${prod.name}</td>
                <td>${prod.category}</td>
                <td>$${prod.price}</td>
                <td class="action-cell">
                    <button class="action-trigger" onclick="crm.toggleMenu('${prod.id}')">⋮</button>
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
            tr.innerHTML = `
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.phone}</td>
                <td class="action-cell">
                    <button class="action-trigger" onclick="crm.toggleMenu('${c.id}')">⋮</button>
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
