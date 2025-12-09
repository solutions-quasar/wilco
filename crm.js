/**
 * Wilco CRM Logic
 * Handles Firebase connection, Sidebar Navigation, Local Storage Persistence, CRUD Modals, Date Navigation, Products, Clients, and Team.
 */

const crm = {
    isMock: false,
    db: null,
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    // Close mobile sidebar on navigate
    this.toggleSidebar(false);

    if(viewId === 'daily') this.updateDateDisplay();
    },

toggleSidebar: function (forceState = null) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (forceState === false) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('open');
    } else if (forceState === true) {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('open');
    } else {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('open');
    }
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
        if (type === 'team') data = this.team.find(x => x.id == id);
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

    if (type === 'team') {
        title.innerText = id ? 'Edit Member' : 'New Team Member';
        container.innerHTML = `
                <div class="input-group">
                    <label>Full Name</label>
                    <input type="text" name="name" value="${data ? data.name : ''}" required>
                </div>
                 <div class="input-group">
                    <label>Role</label>
                    <select name="role">
                        <option value="Technician" ${data && data.role == 'Technician' ? 'selected' : ''}>Technician</option>
                        <option value="Admin" ${data && data.role == 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Owner" ${data && data.role == 'Owner' ? 'selected' : ''}>Owner</option>
                        <option value="Apprentice" ${data && data.role == 'Apprentice' ? 'selected' : ''}>Apprentice</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Email</label>
                    <input type="email" name="email" value="${data ? data.email : ''}" required>
                </div>
                <div class="input-group">
                    <label>Phone</label>
                    <input type="text" name="phone" value="${data ? data.phone : ''}">
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
    } else if (formType === 'team') {
        collectionName = 'team';
        this.updateLocalArray('team', newItem);
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
            if (type === 'team') collectionName = 'team';

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
    if (type === 'team') this.team = this.team.filter(x => x.id != id);

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
    this.renderTeam();
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

renderTeam: function () {
    const tbody = document.getElementById('team-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    this.team.forEach(u => {
        const tr = document.createElement('tr');
        tr.onclick = () => crm.openModal('team', u.id); // Row click
        tr.innerHTML = `
                <td>${u.name}</td>
                <td>${u.role}</td>
                <td>${u.email}</td>
                <td>${u.phone}</td>
                <td class="action-cell" onclick="event.stopPropagation()">
                    <button class="action-trigger" onclick="crm.toggleMenu('${u.id}', event)">⋮</button>
                    <div id="menu-${u.id}" class="action-menu">
                        <button onclick="crm.openModal('team', '${u.id}')">Edit</button>
                        <button class="danger" onclick="crm.deleteItem('team', '${u.id}')">Delete</button>
                    </div>
                </td>
            `;
        tbody.appendChild(tr);
    });
},

setupMessageListener: function () {
    if (!this.db) return;

    // Listen to messages (limit to last 50)
    this.db.collection('messages')
        .orderBy('timestamp', 'asc')
        .limit(50)
        .onSnapshot((snapshot) => {
            this.messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderMessages();
        });
},

sendMessage: async function (text) {
    if (!text) return;
    const user = this.auth.currentUser;
    if (!user) return; // Should be logged in

    // Find user name from team or use email
    const teamMember = this.team.find(m => m.email === user.email);
    const senderName = teamMember ? teamMember.name : user.email.split('@')[0];

    try {
        await this.db.collection('messages').add({
            text: text,
            sender: senderName,
            senderId: user.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp() // Server time
        });
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message: " + error.message);
    }
},

renderMessages: function () {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';

    if (this.messages.length === 0) {
        container.innerHTML = `<div class="message system"><p>Welcome to the Team Chat! Be the first to say hello.</p></div>`;
    }

    this.messages.forEach(msg => {
        const div = document.createElement('div');
        const isSelf = (this.auth && this.auth.currentUser && msg.senderId === this.auth.currentUser.uid);

        div.className = `message ${isSelf ? 'self' : 'other'}`;
        div.innerHTML = `
                <span class="sender-name">${msg.sender}</span>
                ${msg.text}
            `;
        container.appendChild(div);
    });

    // Auto scroll to bottom
    container.scrollTop = container.scrollHeight;
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
