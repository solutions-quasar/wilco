/**
 * Wilco CRM Logic
 * Handles Firebase connection, Sidebar Navigation, Local Storage Persistence, CRUD Modals, Date Navigation, Products, Clients, and Team.
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
    team: [], // New Team state
    knowledge: [], // RAG Knowledge Base
    messages: [], // Chat messages
    aiLogs: [], // AI Audit Logs
    settings: {
        defaultView: 'month',
        workDays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00'
    },
    activeMenuId: null,
    onboardingStep: 0,
    onboardingSteps: [
        { title: "Welcome to WilcoCRM 🚀", text: "Your all-in-one command center for managing leads, clients, and jobs. Let's take a quick tour!", icon: "👋" },
        { title: "The Sidebar 📂", text: "Use the menu on the left to navigate between Leads, Schedule, Invoices, Team, and Messages.", icon: "⬅️" },
        { title: "Quick Actions ⚡", text: "Use the buttons on any item to Edit, Delete, or Archive it instantly.", icon: "✅" },
        { title: "You're Ready! ✅", text: "That's it! You can start managing your business. Click 'Finish' to jump in.", icon: "🎉" }
    ],
    currentViewDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD

    clientViewMode: 'list', // 'list' or 'grid'

    init: function () {
        console.log("Initializing CRM...");

        // Theme Init
        if (localStorage.getItem('wilco_theme') === 'dark') {
            document.body.classList.add('dark-mode');
            const btn = document.getElementById('theme-toggle');
            if (btn) btn.innerHTML = '☀️';
        }

        // --- CRITICAL INIT STEP ---
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log("Firebase App Initialized in init()");
            }
        }

        // Check for Magic Link callback
        // Now safe because app is initialized
        if (typeof firebase !== 'undefined' && firebase.auth().isSignInWithEmailLink(window.location.href)) {
            let email = window.localStorage.getItem('emailForSignIn');
            if (!email) {
                email = window.prompt('Please provide your email for confirmation');
            }
            firebase.auth().signInWithEmailLink(email, window.location.href)
                .then((result) => {
                    window.localStorage.removeItem('emailForSignIn');
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    this.startFirebaseMode(); // Proceed to app
                })
                .catch((error) => {
                    console.error("Magic Link Error", error);
                    alert("Login Link failed or expired.");
                });
            return; // Stop normal init
        }

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

        // Password Toggle Logic
        const togglePassword = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('password');
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                // Optional: Change icon opacity or style to indicate state
                togglePassword.style.opacity = type === 'text' ? '1' : '0.5';
            });
        }
    },

    // --- AUTH EXTENSIONS ---
    openForgotModal: function () {
        document.getElementById('forgot-overlay').classList.add('open');
    },

    resetPassword: function () {
        const email = document.getElementById('reset-email').value;
        if (!email) return alert("Please enter your email.");

        if (this.isMock) {
            alert("Mock Mode: Password reset email 'sent' to " + email);
            document.getElementById('forgot-overlay').classList.remove('open');
            return;
        }

        this.auth.sendPasswordResetEmail(email)
            .then(() => {
                alert("Password reset email sent!");
                document.getElementById('forgot-overlay').classList.remove('open');
            })
            .catch((error) => {
                alert("Error: " + error.message);
            });
    },

    sendMagicLink: function () {
        const email = document.getElementById('email').value;
        if (!email) return alert("Please enter your email in the login box first.");

        if (this.isMock) {
            alert("Mock Mode: Magic Login Link 'sent' to " + email);
            return;
        }

        const actionCodeSettings = {
            url: window.location.href, // Return to this page
            handleCodeInApp: true
        };

        this.auth.sendSignInLinkToEmail(email, actionCodeSettings)
            .then(() => {
                window.localStorage.setItem('emailForSignIn', email);
                alert("Magic Link sent! Check your inbox.");
            })
            .catch((error) => {
                alert("Error: " + error.message);
            });
    },

    toggleTheme: function () {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('wilco_theme', isDark ? 'dark' : 'light');
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = isDark ? '☀️' : '🌙';
    },

    setClientView: function (mode) {
        this.clientViewMode = mode;
        this.renderClients();
    },

    renderDashboard: function () {
        const dash = document.getElementById('view-dashboard');
        if (!dash || !dash.classList.contains('active')) return;

        // Stats Calculation
        const customers = this.clients.length;
        const activeJobs = this.leads.filter(l => l.status === 'In Progress').length + this.schedule.length; // Approximate
        const completedJobs = this.leads.filter(l => l.status === 'Closed').length;

        // Revenue This Week (Mock logic based on current date)
        // In real app, filter invoices by date within range
        const revenue = this.invoices
            .filter(i => i.status === 'Paid')
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        // Update Stats DOM
        if (document.getElementById('stats-customers')) document.getElementById('stats-customers').innerText = customers;
        if (document.getElementById('stats-revenue-week')) document.getElementById('stats-revenue-week').innerText = '$' + revenue.toFixed(0); // Simplified
        if (document.getElementById('stats-active')) document.getElementById('stats-active').innerText = activeJobs;
        if (document.getElementById('stats-completed')) document.getElementById('stats-completed').innerText = completedJobs;

        // Render CHARTS
        this.renderCharts();
        this.renderRecentActivity();
    },

    renderCharts: function () {
        // 1. Revenue Bar Chart (CSS-based)
        const chartRev = document.getElementById('chart-revenue');
        if (chartRev) {
            chartRev.innerHTML = '';
            // Generate mock data for last 7 days
            const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
            days.forEach(day => {
                const height = Math.floor(Math.random() * 80) + 10; // 10-90% height
                const bar = document.createElement('div');
                bar.style.height = `${height}%`;
                bar.style.width = '12%';
                bar.style.background = 'var(--accent)';
                bar.style.borderRadius = '4px';
                bar.style.position = 'relative';

                // Tooltip/Label
                const label = document.createElement('div');
                label.innerText = day;
                label.style.position = 'absolute';
                label.style.bottom = '-20px';
                label.style.width = '100%';
                label.style.textAlign = 'center';
                label.style.fontSize = '0.75rem';
                label.style.color = 'var(--text-muted)';

                bar.appendChild(label);
                chartRev.appendChild(bar);
            });
        }

        // 2. Job Status Donut Chart (Conic Gradient)
        const chartStatus = document.getElementById('chart-status');
        if (chartStatus) {
            // Mock percentages
            const active = 40;
            const completed = 30;
            const pending = 30;

            // Conic Gradient for Donut
            chartStatus.style.width = '160px';
            chartStatus.style.height = '160px';
            chartStatus.style.borderRadius = '50%';
            chartStatus.style.background = `conic-gradient(
                var(--accent) 0% ${active}%, 
                var(--success) ${active}% ${active + completed}%, 
                var(--warning) ${active + completed}% 100%
            )`;

            // Inner Circle for Donut hole
            const inner = document.createElement('div');
            inner.style.width = '110px';
            inner.style.height = '110px';
            inner.style.background = 'var(--bg-card)';
            inner.style.borderRadius = '50%';
            inner.style.position = 'absolute';
            inner.style.display = 'flex';
            inner.style.alignItems = 'center';
            inner.style.justifyContent = 'center';
            inner.style.fontSize = '1.5rem';
            inner.style.fontWeight = 'bold';
            inner.innerText = 'Total';

            chartStatus.innerHTML = '';
            chartStatus.appendChild(inner);
        }
    },

    renderRecentActivity: function () {
        const tbody = document.getElementById('dashboard-recent-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        // Take last 5 leads/jobs
        const recent = this.leads.slice(0, 5);
        recent.forEach(job => {
            const tr = document.createElement('tr');
            tr.onclick = () => crm.openModal('lead', job.id);
            tr.innerHTML = `
                <td><strong>${job.service}</strong><br><small style="color:var(--text-muted)">${job.name}</small></td>
                <td><span class="badge ${job.status === 'Closed' ? 'badge-closed' : 'badge-pending'}">${job.status}</span></td>
                <td>$${Math.floor(Math.random() * 500) + 150}</td>
             `;
            tbody.appendChild(tr);
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
        // Mock Auth
        this.auth = {
            currentUser: { uid: 'mock_user_1', email: 'demo@wilco.com' },
            signOut: () => Promise.resolve(),
            onAuthStateChanged: (cb) => cb({ uid: 'mock_user_1', email: 'demo@wilco.com' })
        };
        this.loadLocalData();
    },

    loadLocalData: function () {
        const localLeads = localStorage.getItem('wilco_leads');
        const localSchedule = localStorage.getItem('wilco_schedule');
        const localInvoices = localStorage.getItem('wilco_invoices');
        const localProducts = localStorage.getItem('wilco_products');
        const localClients = localStorage.getItem('wilco_clients');
        const localTeam = localStorage.getItem('wilco_team');

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

        if (localTeam) this.team = JSON.parse(localTeam);
        else {
            this.team = [
                { id: 'user_1', name: 'Lukas Wilson', role: 'Owner', email: 'admin@wilco.com', phone: '555-0001' },
                { id: 'user_2', name: 'Mike Plumber', role: 'Technician', email: 'mike@wilco.com', phone: '555-0002' }
            ];
            this.saveLocalData();
        }

        const localKnowledge = localStorage.getItem('wilco_knowledge');
        if (localKnowledge) this.knowledge = JSON.parse(localKnowledge);
        else {
            this.knowledge = [
                { id: 'k_1', title: 'Water Heater Warranty', content: 'Standard warranty is 6 years on tank, 1 year on parts.' },
                { id: 'k_2', title: 'Pilot Light Reset', content: 'Turn knob to Pilot, hold down for 60 seconds while lighting.' },
                { id: 'k_3', title: 'Service Areas', content: 'We serve Downtown, West End, and North Shore.' }
            ];
            this.saveLocalData();
        }

        const localMessages = localStorage.getItem('wilco_messages');
        if (localMessages) this.messages = JSON.parse(localMessages);
        else {
            this.messages = [
                { sender: "System", text: "Welcome to Wilco Chat! Type @ai to test the new agent.", senderId: "system", timestamp: Date.now() }
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
                        try {
                            if (user) {
                                console.log("User detected:", user.email);
                                this.showDashboard(user.email);
                                this.loadSettings(); // Load User Settings
                                // this.loadFirestoreData(); // Replace with Realtime
                                this.setupRealtimeListeners(); // Realtime Sync
                                this.setupMessageListener(); // Listen for chat
                                if (typeof this.startOnboarding === 'function') {
                                    this.startOnboarding();
                                } else {
                                    console.error("onboarding function missing");
                                }
                            } else {
                                this.showLogin();
                            }
                        } catch (err) {
                            console.error("Auth State Flow Error:", err);
                            alert("Critical Error in Login Flow: " + err.message);
                        }
                    });
                })
                .catch((error) => {
                    console.error("Auth Persistence Error:", error);
                    // Fallback to basic listener if persistence fails
                    this.auth.onAuthStateChanged(user => {
                        if (user) {
                            this.showDashboard(user.email);
                            this.loadSettings();
                            this.setupRealtimeListeners();
                            // this.loadFirestoreData();
                        }
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

            const teamSnap = await this.db.collection('team').get();
            const knowledgeSnap = await this.db.collection('knowledge').get();

            // Check if DB is completely fresh/empty
            if (leadsSnap.empty && tasksSnap.empty && invoicesSnap.empty && productsSnap.empty && clientsSnap.empty && teamSnap.empty) {
                console.log("Database empty. Seeding defaults...");
                await this.seedFirestoreData();
                return; // seed function will reload data
            }

            this.leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.schedule = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            this.team = teamSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.knowledge = knowledgeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
        const defaultTeam = [
            { id: 'user_1', name: 'Lukas Wilson', role: 'Owner', email: 'admin@wilco.com', phone: '555-0001' },
            { id: 'user_2', name: 'Mike Plumber', role: 'Technician', email: 'mike@wilco.com', phone: '555-0002' }
        ];

        // Add to batch
        defaultLeads.forEach(item => batch.set(this.db.collection('leads').doc(item.id), item));
        defaultTasks.forEach(item => batch.set(this.db.collection('tasks').doc(item.id), item));
        defaultInvoices.forEach(item => batch.set(this.db.collection('invoices').doc(item.id), item));
        defaultProducts.forEach(item => batch.set(this.db.collection('products').doc(item.id), item));
        defaultClients.forEach(item => batch.set(this.db.collection('clients').doc(item.id), item));
        defaultTeam.forEach(item => batch.set(this.db.collection('team').doc(item.id), item));

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
        // Login Form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value.trim();
                const rememberEmail = document.getElementById('remember-email') ? document.getElementById('remember-email').checked : false;

                if (!email || !password) {
                    alert("Please enter both email and password.");
                    return;
                }

                if (rememberEmail) localStorage.setItem('wilco_saved_email', email);
                else localStorage.removeItem('wilco_saved_email');

                if (this.isMock) {
                    console.log("Proceeding with Mock Login");
                    this.showDashboard(email);
                } else if (this.auth) {
                    console.log("Proceeding with Firebase Login");
                    this.auth.signInWithEmailAndPassword(email, password)
                        .catch((error) => {
                            console.error("Login Failed", error);
                            alert("Login Failed: " + error.message);
                        });
                } else {
                    console.error("Login State Error: Not Mock and No Auth");
                    alert("System Error: Login service not initialized.");
                }
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (this.auth) this.auth.signOut().then(() => location.reload());
                else location.reload();
            });
        }

        // Date Navigation
        const prevDay = document.getElementById('prev-day');
        const nextDay = document.getElementById('next-day');
        const dateInput = document.getElementById('workday-date');

        if (prevDay) prevDay.addEventListener('click', () => this.changeDate(-1));
        if (nextDay) nextDay.addEventListener('click', () => this.changeDate(1));
        if (dateInput) dateInput.addEventListener('change', (e) => this.setDate(e.target));

        // Chat Form Listener
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = document.getElementById('message-input');
                const text = input.value.trim();
                if (text) {
                    this.sendMessage(text);
                    input.value = '';
                }
            });
        }

        // Password Toggle
        const togglePassword = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('password');
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.style.opacity = type === 'text' ? '1' : '0.5';
            });
        }
    },

    openModal: function (type, id) {
        const container = document.getElementById('modal-fields');
        const idField = document.getElementById('modal-id');
        const typeField = document.getElementById('modal-type');
        const title = document.getElementById('modal-title');
        const modal = document.getElementById('modal-overlay');

        if (!container || !modal) return;

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
            if (type === 'knowledge') data = this.knowledge.find(x => x.id == id);
            if (type === 'team') data = this.team.find(x => x.id == id);
        }

        // Initialize Media State
        this.currentMedia = (data && data.media) ? [...data.media] : [];
        setTimeout(() => this.renderMediaPreviews(), 50);

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
                <div class="input-group">
                    <label>Media / Files</label>
                    <input type="file" multiple onchange="crm.handleFileUpload(event)" accept="image/*,application/pdf">
                    <div id="media-previews" style="margin-top:10px; display:flex; flex-wrap:wrap;"></div>
                </div>
            `;
        }

        if (type === 'task') {
            title.innerText = id ? 'Edit Task' : 'New Task';
            const defaultDate = this.currentViewDate;
            container.innerHTML = `
                <div class="input-group">
                    <label>Event Type</label>
                    <select name="calendarType" id="calendar-type-select" onchange="crm.toggleEventFields(this.value)">
                        <option value="appointment" ${!data || (data && data._source !== 'task' && data.type !== 'blocker') ? 'selected' : ''}>Appointment</option>
                        <option value="task" ${data && data._source === 'task' ? 'selected' : ''}>Task</option>
                        <option value="blocker" ${data && (data.type === 'blocker' || data.type === 'holiday') ? 'selected' : ''}>Block Date / Holiday</option>
                    </select>
                </div>

                <div class="input-group" id="field-title">
                    <label>Title / Description</label>
                    <input type="text" name="title" value="${data ? data.title : ''}" required placeholder="e.g. Install Sink">
                </div>

                <div class="input-group" style="display: flex; gap: 1rem;">
                    <div style="flex: 1;">
                        <label>Date</label>
                        <input type="date" name="date" value="${data ? data.date : defaultDate}" required>
                    </div>
                    <div style="flex: 1;">
                        <label>Time</label>
                        <input type="time" name="time" value="${data ? data.time : '09:00'}">
                    </div>
                </div>

                <div id="fields-client-info">
                    <div class="input-group">
                        <label>Client Name</label>
                        <input type="text" name="client" value="${data ? data.client : ''}">
                    </div>
                    <div class="input-group">
                        <label>Address</label>
                        <input type="text" name="address" value="${data ? data.address : ''}">
                    </div>
                </div>

                 <div class="input-group" id="field-status" style="display:none;">
                    <label>Block Type</label>
                    <select name="blockType">
                        <option value="blocker">Unavailable</option>
                        <option value="holiday">Holiday</option>
                    </select>
                </div>
            `;
            setTimeout(() => crm.toggleEventFields(document.getElementById('calendar-type-select').value), 50);

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
                <div class="input-group">
                    <label>Media / Files</label>
                    <input type="file" multiple onchange="crm.handleFileUpload(event)" accept="image/*,application/pdf">
                    <div id="media-previews" style="margin-top:10px; display:flex; flex-wrap:wrap;"></div>
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



        if (type === 'knowledge') {
            title.innerText = id ? 'Edit Article' : 'New Knowledge Article';
            container.innerHTML = `
                <div class="input-group">
                    <label>Title</label>
                    <input type="text" name="title" value="${data ? data.title : ''}" required placeholder="e.g. Warranty Policy">
                </div>
                <div class="input-group">
                    <label>Content</label>
                    <textarea name="content" rows="6" required placeholder="Enter the details...">${data ? data.content : ''}</textarea>
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

        if (type === 'blocker') {
            title.innerText = 'Block Time / Holiday';
            container.innerHTML = `
                <div class="input-group">
                    <label>Title</label>
                    <input type="text" name="title" placeholder="St. Patrick's Day / Off" required>
                </div>
                <div class="input-group">
                    <label>Date</label>
                    <input type="date" name="date" required value="${this.currentCalendarDate.toISOString().split('T')[0]}">
                </div>
                 <div class="input-group">
                    <label>Type</label>
                    <select name="type">
                        <option value="blocker">Unavailable</option>
                        <option value="holiday">Holiday</option>
                    </select>
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

        // this.recalcTotal();


        // --- DYNAMIC FOOTER BUTTONS ---
        const footer = modal.querySelector('.modal-footer');
        // Remove existing custom buttons
        const existingDelete = footer.querySelector('.btn-delete-modal');
        if (existingDelete) existingDelete.remove();

        if (id) {
            // Add Delete Button if Editing
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-text danger btn-delete-modal';
            delBtn.style.marginRight = 'auto'; // Push others to right
            delBtn.innerHTML = "<i class='bx bx-trash'></i> Delete";
            delBtn.onclick = () => {
                this.deleteItem(type, id);
                this.closeModal(); // Close after delete
            };
            footer.prepend(delBtn);
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

        // Save Media
        newItem.media = this.currentMedia;

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
            // Handle Unified Calendar Event logic
            const calendarType = document.getElementById('calendar-type-select').value;

            if (calendarType === 'task') {
                collectionName = 'tasks';
                delete newItem.calendarType; // clean up
                this.updateLocalArray('tasks', newItem);
            } else if (calendarType === 'blocker') {
                collectionName = 'schedule';
                newItem.type = document.querySelector('select[name="blockType"]').value || 'blocker';
                this.updateLocalArray('schedule', newItem);
            } else {
                // Appointment (Default)
                collectionName = 'schedule';
                newItem.type = 'job';
                this.updateLocalArray('schedule', newItem);
            }
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
        } else if (formType === 'knowledge') {
            collectionName = 'knowledge';
            this.updateLocalArray('knowledge', newItem);
        }

        console.log(`Attempting to save [${formType}] to Firestore. ID: ${newItem.id}`, newItem);

        // Firestore Write
        if (!this.isMock && collectionName) {
            try {
                await this.db.collection(collectionName).doc(newItem.id).set(newItem);
                console.log(`SUCCESS: Saved to Firestore collection [${collectionName}].`);

                // AUDIT LOG
                const actionType = this.updateLocalArray(collectionName === 'schedule' ? 'schedule' : collectionName, newItem) ? 'UPDATE' : 'CREATE';
                // Note: updateLocalArray returns true if index found (update), false otherwise (create - wait, looking at code below, it doesn't return bool, need to check implementation or assume based on ID check)

                // Better approach: check if we are editing (based on modal state or just check if item existed? `updateLocalArray` logic below handles it)
                // Let's just log "UPSERT" or check the index logic again. 
                // Actually, let's use a simpler heuristic: if the ID was passed into openModal, it's edit. But here we have form data.

                this.logSystemAction('SAVE', collectionName, newItem.id, { formType });
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


    // --- NAVIGATION ---
    toggleSidebar: function () {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('mobile-open');
        document.getElementById('mobile-overlay').classList.toggle('open');
    },

    switchView: function (viewId) {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        // Show selected view
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.add('active');
            // Save state
            localStorage.setItem('wilco_active_view', viewId);
        }

        // Update active menu state
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        // Try to find the button that triggered this or match by viewId text if simple
        // Instead, let's just highlight based on onclick attribute which is easier here
        const btns = document.querySelectorAll('.nav-btn');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${viewId}'`)) {
                btn.classList.add('active');
            }
        });

        // Close mobile sidebar if open
        document.getElementById('dashboard-wrapper').classList.remove('sidebar-open');
        document.getElementById('mobile-overlay').classList.remove('open');
    },

    toggleEventFields: function (type) {
        const clientFields = document.getElementById('fields-client-info');
        const statusField = document.getElementById('field-status');

        if (type === 'blocker') {
            if (clientFields) clientFields.style.display = 'none';
            if (statusField) statusField.style.display = 'block';
        } else {
            if (clientFields) clientFields.style.display = 'block';
            if (statusField) statusField.style.display = 'none';
        }
    },

    closeAllMenus: function () {
        document.querySelectorAll('.action-menu').forEach(el => el.classList.remove('show'));
    },

    showDashboard: function (email) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard-wrapper').style.display = 'flex';
        document.querySelector('.content-area').style.display = 'block';
        if (email) document.getElementById('user-email').innerText = email;

        // Restore View
        const savedView = localStorage.getItem('wilco_active_view');
        if (savedView) {
            this.switchView(savedView);
        } else {
            this.switchView('dashboard'); // Default
        }
    },

    showLogin: function () {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard-wrapper').style.display = 'none';
        document.querySelector('.content-area').style.display = 'none';
    },

    // --- LOGGING HELPER ---
    logSystemAction: async function (action, collection, id, details = {}) {
        if (!this.db || !this.auth.currentUser) return;
        try {
            await this.db.collection('ai_audit_logs').add({
                action, // 'CREATE', 'UPDATE', 'DELETE'
                collection,
                docId: id,
                details,
                source: 'USER', // Distinguish from AI
                performedBy: this.auth.currentUser.email,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[System Log] ${action} ${collection}/${id}`);
        } catch (e) {
            console.error("Failed to log system action:", e);
        }
    },

    deleteItem: async function (type, id) {
        if (!confirm("Are you sure you want to permanently delete this item?")) return;

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
                if (type === 'appointment') collectionName = 'schedule'; // Map appointment to schedule
                if (type === 'schedule') collectionName = 'schedule';

                if (collectionName) {
                    await this.db.collection(collectionName).doc(id).delete();
                    console.log(`Deleted from Firestore: ${collectionName}/${id}`);

                    // AUDIT LOG
                    this.logSystemAction('DELETE', collectionName, id, { type });
                }
            } catch (error) {
                console.error("Firestore Delete Error:", error);
                alert("Delete Failed: " + error.message);
                return;
            }
        }

        // Local Update
        if (type === 'lead') this.leads = this.leads.filter(x => x.id != id);
        if (type === 'task') this.schedule = this.schedule.filter(x => x.id != id); // Task is now in schedule/tasks
        // Note: For 'task'/schedule, we might need to filter both arrays if segregated, but standardizing 'schedule' array usage is better.
        if (type === 'invoice') this.invoices = this.invoices.filter(x => x.id != id);
        if (type === 'product') this.products = this.products.filter(x => x.id != id);
        if (type === 'client') this.clients = this.clients.filter(x => x.id != id);
        if (type === 'team') this.team = this.team.filter(x => x.id != id);
        if (type === 'appointment') this.schedule = this.schedule.filter(x => x.id != id);

        // Setup for combined arrays if used
        if (type === 'schedule') this.schedule = this.schedule.filter(x => x.id != id);

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
        this.renderDashboard(); // Updated from updateStats
        this.renderCalendar(); // Updated from renderSchedule
        this.renderInvoices();
        this.renderProducts();
        this.renderClients();
        this.renderTeam();
        this.renderKnowledge();
        // Chat is now floating, rendered on toggle or update
    },

    // --- CALENDAR LOGIC ---
    currentCalendarDate: new Date(),

    changeMonth: function (offset) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + offset);
        this.renderCalendar();
    },

    goToToday: function () {
        this.currentCalendarDate = new Date();
        this.renderCalendar();
    },

    renderCalendar: function () {
        const view = (this.settings && this.settings.defaultView) ? this.settings.defaultView : 'month';
        // Override if locally switched (we need a state for current view mode, separate from settings default)
        const currentView = this.currentCalendarViewMode || view;

        if (currentView === 'week') {
            this.renderWeekView();
        } else {
            this.renderMonthView();
        }
    },

    setCalendarView: function (mode) {
        this.currentCalendarViewMode = mode;
        // Update Buttons
        document.querySelectorAll('.view-controls .btn-text').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`btn-view-${mode}`);
        if (btn) btn.classList.add('active');

        this.renderCalendar();
    },

    renderMonthView: function () {
        const grid = document.getElementById('calendar-grid');
        const title = document.getElementById('calendar-title');
        // Reset Grid Class for Month
        if (grid) {
            grid.className = 'calendar-grid';
            grid.style.display = 'grid';
            grid.innerHTML = '';
        }
        if (!title) return;

        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();

        // Update Title
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        title.innerText = `${monthNames[month]} ${year}`;

        // Date Math
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const todayCheck = new Date();
        const isCurrentMonth = todayCheck.getMonth() === month && todayCheck.getFullYear() === year;

        // Previous Month Padding
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.innerHTML = `<div class="day-number">${daysInPrevMonth - i}</div>`;
            grid.appendChild(dayDiv);
        }

        // Current Month Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day';
            if (isCurrentMonth && day === todayCheck.getDate()) dayDiv.classList.add('today');

            // Drag & Drop Attributes
            dayDiv.setAttribute('data-date', dateStr);
            dayDiv.ondragover = (e) => crm.handleDragOver(e);
            dayDiv.ondrop = (e) => crm.handleDrop(e, dateStr);

            dayDiv.onclick = () => {
                // Open modal with pre-filled date
                crm.openModal('task');
                setTimeout(() => {
                    const dateInput = document.querySelector('input[name="date"]');
                    if (dateInput) dateInput.value = dateStr;
                }, 100);
            };

            let html = `<div class="day-number">${day}</div>`;

            // Find Events (Merge Schedule/Appointments and Tasks)
            const appointments = this.schedule ? this.schedule.filter(s => s.date === dateStr) : [];
            const tasks = this.tasks ? this.tasks.filter(t => t.date === dateStr) : [];

            // Normalize for display
            const dayEvents = [
                ...appointments.map(a => ({ ...a, _source: 'schedule' })),
                ...tasks.map(t => ({ ...t, title: t.title || t.description, type: 'task', _source: 'task' }))
            ];

            // Also check leads with dates
            const leadEvents = this.leads.filter(l => l.date === dateStr);

            // Render Events (Max 3)
            let eventCount = 0;

            dayEvents.forEach(ev => {
                if (eventCount < 3) {
                    const isBlocker = ev.type === 'blocker';
                    const isHoliday = ev.type === 'holiday';
                    const isTask = ev._source === 'task';

                    let pillClass = 'event-job'; // Default (Appointment)
                    if (isBlocker) pillClass = 'event-blocker';
                    if (isHoliday) pillClass = 'event-holiday';
                    if (isTask) pillClass = 'event-task'; // CSS class needed

                    // Draggable Event
                    html += `<div class="calendar-event ${pillClass}" title="${ev.title}" draggable="true" ondragstart="crm.handleDragStart(event, '${ev.id}', '${ev._source}')">${ev.title}</div>`;
                    eventCount++;
                }
            });

            leadEvents.forEach(l => {
                if (eventCount < 3) {
                    html += `<div class="calendar-event event-quote" title="Lead: ${l.name}">Lead: ${l.name}</div>`;
                    eventCount++;
                }
            });

            if (dayEvents.length + leadEvents.length > 3) {
                html += `<div class="more-events">+${(dayEvents.length + leadEvents.length) - 3} more</div>`;
            }

            dayDiv.innerHTML = html;
            grid.appendChild(dayDiv);
        }

        // Next Month Padding (Fill grid to 42 cells 6x7)
        const TotalCells = 42;
        const currentCells = firstDayOfMonth + daysInMonth;
        for (let i = 1; i <= (TotalCells - currentCells); i++) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.innerHTML = `<div class="day-number">${i}</div>`;
            grid.appendChild(dayDiv);
        }
    },

    renderWeekView: function () {
        const grid = document.getElementById('calendar-grid');
        const title = document.getElementById('calendar-title');

        // Switch Grid Mode
        grid.className = 'calendar-week-grid'; // New CSS Class
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '80px repeat(7, 1fr)'; // Timecol + 7 Days
        grid.innerHTML = '';

        // Calculate Start of Week (Sunday/Monday based on locale or preference? Let's assume Sunday for view consistency with Month)
        // Or better, align with `currentCalendarDate` as the focal point
        const curr = new Date(this.currentCalendarDate);
        const day = curr.getDay(); // 0 is Sunday
        const diff = curr.getDate() - day; // adjust when day is sunday
        const startOfWeek = new Date(curr.setDate(diff)); // First day is Sunday

        // Title: Week of ...
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        // Calculate ISO Week Number
        const oneJan = new Date(startOfWeek.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((startOfWeek - oneJan) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((startOfWeek.getDay() + 1 + numberOfDays) / 7);

        title.innerText = `Week ${weekNum} | ${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;

        // Get Settings Days/Hours
        const startHour = (this.settings && this.settings.startTime) ? parseInt(this.settings.startTime.split(':')[0]) : 8;
        const endHour = (this.settings && this.settings.endTime) ? parseInt(this.settings.endTime.split(':')[0]) : 18;

        // Header Row (Empty corner + Days)
        grid.appendChild(document.createElement('div')); // Corner
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const th = document.createElement('div');
            th.className = 'calendar-days-header';
            th.style.border = '1px solid var(--border)'; // Specific style
            th.innerText = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

            // Highlight Today
            const today = new Date();
            if (d.toDateString() === today.toDateString()) {
                th.style.background = 'rgba(37, 99, 235, 0.1)';
                th.style.color = 'var(--accent)';
            }
            grid.appendChild(th);
        }

        // Time Rows
        for (let h = startHour; h <= endHour; h++) {
            // Time Label
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-column';
            timeLabel.style.textAlign = 'right';
            timeLabel.style.padding = '5px';
            timeLabel.style.fontSize = '0.8rem';
            timeLabel.style.color = 'var(--text-muted)';
            timeLabel.innerText = `${h.toString().padStart(2, '0')}:00`;
            grid.appendChild(timeLabel);

            // 7 Days Columns for this Hour
            for (let i = 0; i < 7; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = `${h.toString().padStart(2, '0')}:00`;

                const cell = document.createElement('div');
                cell.className = 'calendar-day'; // Reuse basic style
                cell.style.minHeight = '60px'; // Taller slots

                // Drag & Drop
                cell.setAttribute('data-date', dateStr);
                cell.setAttribute('data-time', timeStr);
                cell.ondragover = (e) => crm.handleDragOver(e);
                cell.ondrop = (e) => crm.handleDrop(e, dateStr, timeStr);

                // Click to Create
                cell.onclick = () => {
                    crm.openModal('task');
                    setTimeout(() => {
                        const dateInput = document.querySelector('input[name="date"]');
                        if (dateInput) dateInput.value = dateStr;
                        const timeInput = document.querySelector('input[name="time"]');
                        if (timeInput) timeInput.value = timeStr;
                    }, 100);
                };

                // Find events for this specific Hour slot
                const checkTime = (t) => t && t.startsWith(`${h.toString().padStart(2, '0')}`);

                const slotEvents = [
                    ...(this.schedule || []).filter(s => s.date === dateStr && checkTime(s.time)).map(a => ({ ...a, _source: 'schedule' })),
                    ...(this.tasks || []).filter(t => t.date === dateStr && checkTime(t.time)).map(t => ({ ...t, _source: 'task', type: 'task' }))
                ];

                // Render events with relative positioning
                cell.style.position = 'relative'; // Ensure absolute children work

                slotEvents.forEach(ev => {
                    const isTask = ev._source === 'task';
                    const cssClass = isTask ? 'event-task' : (ev.type === 'blocker' ? 'event-blocker' : 'event-job');
                    const div = document.createElement('div');
                    div.className = `calendar-event ${cssClass}`;
                    div.innerText = (ev.time ? ev.time + ' ' : '') + (ev.title || ev.description || 'Event');

                    div.setAttribute('draggable', 'true');
                    div.setAttribute('ondragstart', `crm.handleDragStart(event, '${ev.id}', '${ev._source}')`);
                    div.onclick = (e) => {
                        e.stopPropagation(); // Prevent cell click
                        crm.openModal(isTask ? 'task' : 'appointment', ev.id);
                    }

                    // Calculate Top Position based on minutes
                    if (ev.time) {
                        const mins = parseInt(ev.time.split(':')[1]) || 0;
                        const topPercent = (mins / 60) * 100;
                        div.style.position = 'absolute';
                        div.style.top = `${topPercent}%`;
                        div.style.width = '95%';
                        div.style.zIndex = '10';
                    }

                    cell.appendChild(div);
                });

                grid.appendChild(cell);
            }
        }
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

            const mediaIcon = (lead.media && lead.media.length > 0) ? '<span title="Has Media">📷</span>' : '';

            tr.innerHTML = `
                <td>${lead.date}</td>
                <td><strong>${lead.name}</strong> ${mediaIcon}<br><small>${lead.email || ''}</small></td>
                <td>${lead.service}</td>
                <td><span class="badge ${badge}">${lead.status}</span></td>
                <td class="action-cell" onclick="event.stopPropagation()">
                    <div class="action-buttons">
                        <button class="btn-text" onclick="crm.openModal('lead', '${lead.id}')">Edit</button>
                        <button class="btn-text warning" onclick="crm.archiveItem('lead', '${lead.id}')">Archive</button>
                        <button class="btn-text danger" onclick="crm.deleteItem('lead', '${lead.id}')"><i class='bx bx-trash'></i></button>
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
                <div style="margin-left: auto;" class="action-buttons" onclick="event.stopPropagation()">
                     <button class="btn-text" onclick="crm.openModal('task', '${item.id}')">Edit</button>
                     <button class="btn-text danger" onclick="crm.deleteItem('task', '${item.id}')"><i class='bx bx-trash'></i></button>
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
                    <div class="action-buttons">
                        <button class="btn-text" onclick="crm.openModal('invoice', '${inv.id}')">Edit</button>
                        <button class="btn-text danger" onclick="crm.deleteItem('invoice', '${inv.id}')"><i class='bx bx-trash'></i></button>
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
                    <div class="action-buttons">
                        <button class="btn-text" onclick="crm.openModal('product', '${prod.id}')">Edit</button>
                        <button class="btn-text danger" onclick="crm.deleteItem('product', '${prod.id}')"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderClients: function () {
        const container = document.getElementById('view-clients').querySelector('.data-table-container');
        if (!container) return;

        container.innerHTML = '';

        if (this.clientViewMode === 'grid') {
            const grid = document.createElement('div');
            grid.className = 'clients-grid';

            this.clients.forEach(c => {
                const card = document.createElement('div');
                card.className = 'client-card';
                card.onclick = () => crm.openModal('client', c.id);

                card.innerHTML = `
                <div class="client-card-header">
                    <div class="client-avatar">${c.name.charAt(0)}</div>
                    <div class="action-buttons">
                        <button class="btn-text" onclick="event.stopPropagation(); crm.openModal('client', '${c.id}')">Edit</button>
                    </div>
                </div>
                <div class="client-info">
                     <h3 style="margin-bottom:0.5rem;">${c.name}</h3>
                     <p>📧 ${c.email}</p>
                     <p>📞 ${c.phone}</p>
                </div>
                <div class="client-stats">
                    <div class="stat-item">
                        <span>Jobs</span>
                        <strong>${Math.floor(Math.random() * 10)}</strong>
                    </div>
                    <div class="stat-item">
                         <span>Spent</span>
                         <strong>$${Math.floor(Math.random() * 5000)}</strong>
                    </div>
                </div>
               `;
                grid.appendChild(card);
            });
            container.appendChild(grid);

        } else {
            // Default List View
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="clients-table-body"></tbody>
            `;
            container.appendChild(table);
            const tbody = table.querySelector('tbody');

            this.clients.forEach(c => {
                const tr = document.createElement('tr');
                tr.onclick = () => crm.openModal('client', c.id); // Row click
                tr.innerHTML = `
                    <td>${c.name}</td>
                    <td>${c.email}</td>
                    <td>${c.phone}</td>
                    <td class="action-cell" onclick="event.stopPropagation()">
                        <div class="action-buttons">
                            <button class="btn-text" onclick="crm.openModal('client', '${c.id}')">Edit</button>
                            <button class="btn-text danger" onclick="crm.deleteItem('client', '${c.id}')"><i class='bx bx-trash'></i></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
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
                    <div class="action-buttons">
                        <button class="btn-text" onclick="crm.openModal('team', '${u.id}')">Edit</button>
                        <button class="btn-text danger" onclick="crm.deleteItem('team', '${u.id}')">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderKnowledge: function () {
        const tbody = document.getElementById('knowledge-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        const items = this.knowledge || [];
        items.forEach(k => {
            const tr = document.createElement('tr');
            tr.onclick = () => crm.openModal('knowledge', k.id);
            tr.innerHTML = `
                <td><strong>${k.title}</strong></td>
                <td>${(k.content || '').substring(0, 50)}...</td>
                <td class="action-cell" onclick="event.stopPropagation()">
                     <div class="action-buttons">
                        <button class="btn-text" onclick="crm.openModal('knowledge', '${k.id}')">Edit</button>
                        <button class="btn-text danger" onclick="crm.deleteItem('knowledge', '${k.id}')">Delete</button>
                     </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // --- DRAG AND DROP LOGIC ---
    handleDragStart: function (e, id, type) {
        e.dataTransfer.setData("text/plain", JSON.stringify({ id, type }));
        e.dataTransfer.dropEffect = "move";
    },

    handleDragOver: function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        // Visual feedback? 
        e.currentTarget.style.background = "var(--secondary)";
    },

    // Helper to clear drag highlight (simulated by just resetting on re-render or explicit leave listener if needed)
    // For now, simpler: CSS :hover handles most, but background set in dragover might stick.
    // Better: use CSS class for dragover state.
    // Let's implement handleDragLeave? 
    // MVP: Just reset background in Drop.

    handleDrop: function (e, newDate, hourBase = null) {
        e.preventDefault();
        e.currentTarget.style.background = ""; // Reset

        try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            const { id, type } = data;

            // Calculate precise time if hourBase is provided
            let newTime = hourBase;
            if (hourBase) {
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const cellHeight = rect.height;
                const minutes = Math.floor((offsetY / cellHeight) * 60);

                // Round to nearest 5 minutes
                const roundedMinutes = Math.round(minutes / 5) * 5;
                const finalMinutes = roundedMinutes >= 60 ? 55 : roundedMinutes; // Clamp

                const [h, _] = hourBase.split(':');
                newTime = `${h}:${finalMinutes.toString().padStart(2, '0')}`;
            }

            console.log(`Dropped ${type} ${id} to ${newDate} ${newTime || '(no time)'}`);

            this.updateEventLocation(id, type, newDate, newTime);
        } catch (err) {
            console.error("Drop failed:", err);
        }
    },

    updateEventLocation: function (id, type, date, time) {
        if (!this.db) return;

        // Determine Collection
        let collection = 'schedule'; // Default
        if (type === 'task') collection = 'tasks';

        const updateData = { date: date };
        if (time) updateData.time = time;

        this.db.collection(collection).doc(id).update(updateData)
            .then(() => {
                // console.log("Event moved!");
                // No need to alert, UI updates via listener
                this.logSystemAction('MOVE', collection, id, { newDate: date, newTime: time });
            })
            .catch(err => alert("Error moving event: " + err.message));
    },

    saveSettings: function () {
        console.log("Attempting to save settings...");
        if (!this.db) {
            alert("Error: Database not initialized.");
            return;
        }
        if (!this.auth.currentUser) {
            alert("Error: You must be logged in to save settings.");
            return;
        }

        const defaultView = document.getElementById('setting-default-view').value;
        // Collect checked checkboxes for workDays
        const workDays = Array.from(document.querySelectorAll('.setting-workday:checked')).map(cb => parseInt(cb.value));
        const startTime = document.getElementById('setting-start-time').value;
        const endTime = document.getElementById('setting-end-time').value;

        this.settings = { defaultView, workDays, startTime, endTime };

        console.log("Saving settings payload:", this.settings);

        this.db.collection('users').doc(this.auth.currentUser.uid).set({
            settings: this.settings
        }, { merge: true })
            .then(() => {
                console.log("Settings write success.");
                alert("Settings Saved Successfully!");
            })
            .catch(err => {
                console.error("Error saving settings:", err);
                alert("Error saving settings: " + err.message);
            });
    },

    loadSettings: function () {
        if (!this.db || !this.auth.currentUser) return;

        this.db.collection('users').doc(this.auth.currentUser.uid).get().then(doc => {
            if (doc.exists && doc.data().settings) {
                this.settings = { ...this.settings, ...doc.data().settings };
                console.log("Settings Loaded:", this.settings);

                // Update UI to match
                if (document.getElementById('setting-default-view')) {
                    document.getElementById('setting-default-view').value = this.settings.defaultView;
                    document.getElementById('setting-start-time').value = this.settings.startTime;
                    document.getElementById('setting-end-time').value = this.settings.endTime;

                    document.querySelectorAll('.setting-workday').forEach(cb => {
                        cb.checked = this.settings.workDays.includes(parseInt(cb.value));
                    });
                }
            }
        });
    },

    setupRealtimeListeners: function () {
        if (!this.db || !this.auth.currentUser) return;
        console.log("Setting up Realtime Listeners for CRM Data...");

        const collections = ['leads', 'schedule', 'tasks', 'invoices', 'products', 'clients', 'team', 'knowledge'];

        collections.forEach(col => {
            this.db.collection(col).onSnapshot(snapshot => {
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Map collections to state
                if (col === 'schedule') this.schedule = items;
                else if (col === 'tasks') this.tasks = items;
                else this[col] = items;

                console.log(`Synced [${col}]: ${items.length} items.`);
                this.renderAllViews();
            }, error => {
                console.error(`Error syncing [${col}]:`, error);
            });
        });

        // Separate listener for AI Logs (Sorted by Timestamp)
        this.db.collection('ai_audit_logs').orderBy('timestamp', 'desc').limit(50)
            .onSnapshot(snapshot => {
                this.aiLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.renderAILogs();
            });
    },

    renderAILogs: function () {
        const tbody = document.getElementById('ai-logs-list');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (this.aiLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No actions recorded yet.</td></tr>';
            return;
        }

        this.aiLogs.forEach(log => {
            const date = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now';
            const statusClass = log.status === 'success' || !log.status ? 'status-paid' : 'status-overdue'; // Success by default for manual
            const source = log.source || 'AI'; // Default to AI if missing
            const sourceIcon = source === 'AI' ? '🤖' : '👤';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td>${sourceIcon} ${source}</td>
                <td><strong>${log.action}</strong></td>
                <td><pre style="font-size: 0.8rem; margin: 0; white-space: pre-wrap;">${JSON.stringify(log.details, null, 2)}</pre></td>
                <td><span class="status-badge ${statusClass}">${log.status || 'Success'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    },


    // --- CHAT LOGIC ---
    filterMessagesByOwner: true,
    messageListenerUnsubscribe: null,

    toggleMessageFilter: function (isChecked) {
        this.filterMessagesByOwner = isChecked;
        console.log("Toggling Message Filter. My Messages Only:", this.filterMessagesByOwner);
        this.setupMessageListener(); // Re-run listener
    },

    setupMessageListener: function () {
        if (!this.db || !this.auth.currentUser) return;

        // Unsubscribe previous listener if exists
        if (this.messageListenerUnsubscribe) {
            console.log("Unsubscribing from previous message listener...");
            this.messageListenerUnsubscribe();
            this.messageListenerUnsubscribe = null;
        }

        const uid = this.auth.currentUser.uid;
        console.log(`Setting up Message Listener. User: ${uid}, FilterMyMsgs: ${this.filterMessagesByOwner}`);

        let query = this.db.collection('messages');

        if (this.filterMessagesByOwner) {
            query = query.where('ownerId', '==', uid);
        }

        // Apply ordering and limit
        // Note: If filtering by ownerId, you might need a composite index on [ownerId, timestamp]
        query = query.orderBy('timestamp', 'desc').limit(50);

        this.messageListenerUnsubscribe = query.onSnapshot((snapshot) => {
            console.log("Message Snapshot received. Docs:", snapshot.size);
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sortedLoaded = loaded.reverse(); // Reverse to show oldest first in UI

            // Preserve local temporary messages (e.g., Typing Indicator)
            const tempMessages = this.messages.filter(m => m.isTemp);

            this.messages = [...sortedLoaded, ...tempMessages];
            this.renderMessages();
        }, (error) => {
            console.error("Message Listener Error:", error);
            if (error.message.includes("index")) {
                alert("System Notice: A required database index is missing. Check console for link.");
            }
        });
    },

    // --- AUDIO HANDLING ---
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,
    isPaused: false,
    audioBlob: null, // Store blob for preview

    toggleRecording: async function () {
        if (this.isRecording) {
            this.finishRecording();
        } else {
            this.startRecording();
        }
    },

    startRecording: async function () {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = event => {
                    this.audioChunks.push(event.data);
                };

                this.mediaRecorder.onstop = () => {
                    // Create Blob and Preview
                    this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                    const audioUrl = URL.createObjectURL(this.audioBlob);

                    // Show Preview UI
                    const previewContainer = document.getElementById('audio-preview-container');
                    const audioPlayer = document.getElementById('audio-player');

                    if (previewContainer && audioPlayer) {
                        wrapper = document.querySelector('.chat-input-area');
                        if (wrapper) wrapper.style.display = 'none'; // Hide text input while reviewing

                        previewContainer.style.display = 'flex';
                        audioPlayer.src = audioUrl;
                    }

                    // Reset Mic UI
                    document.getElementById('mic-btn').classList.remove('recording-pulse');
                    const icon = document.querySelector('#mic-btn i');
                    if (icon) {
                        icon.className = 'bx bx-microphone';
                        icon.parentElement.style.color = 'var(--text-muted)';
                        icon.parentElement.title = "Click to Record";
                    }
                    this.isRecording = false;
                    this.isPaused = false;

                    // Release mic
                    stream.getTracks().forEach(track => track.stop());
                };

                this.mediaRecorder.start();
                this.isRecording = true;
                this.isPaused = false;

                // UI Update
                document.getElementById('mic-btn').classList.add('recording-pulse');
                const icon = document.querySelector('#mic-btn i');
                if (icon) {
                    icon.className = 'bx bx-stop-circle';
                    icon.parentElement.style.color = 'var(--danger)';
                    icon.parentElement.title = "Click to Stop & Review";
                }
                console.log("Recording started...");

            } catch (err) {
                console.error("Mic Access Error:", err);
                alert("Could not access microphone.");
            }
        } else {
            console.warn("Audio API not supported.");
            alert("Audio recording not supported in this browser.");
        }
    },

    finishRecording: function () {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            console.log("Recording stopped for review.");
        }
    },

    discardAudio: function () {
        this.audioBlob = null;
        document.getElementById('audio-preview-container').style.display = 'none';
        document.querySelector('.chat-input-area').style.display = 'flex'; // Show input again
    },

    sendAudio: function () {
        if (!this.audioBlob) return;

        const reader = new FileReader();
        reader.readAsDataURL(this.audioBlob);
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            this.sendMessage(null, base64String);
            this.discardAudio(); // Cleanup UI
        };
    },

    // Optional: Pause/Resume logic could be added here if we add a Pause button UI


    sendMessage: async function (text, audioBase64 = null) {
        if (!text && !audioBase64) return;
        const user = this.auth ? this.auth.currentUser : null;
        if (!user) {
            console.error("sendMessage: No user logged in");
            alert("You must be logged in to send messages.");
            return;
        }

        // Find user name from team or use email
        const teamMember = this.team.find(m => m.email === user.email);
        const senderName = teamMember ? teamMember.name : (user.email ? user.email.split('@')[0] : 'User');

        const messageData = {
            text: text || "🎤 [Audio Message]", // Fallback text for UI
            sender: senderName,
            senderId: user.uid,
            timestamp: Date.now()
        };

        // MOCK MODE HANDLE
        if (this.isMock) {
            this.messages.push(messageData);
            this.renderMessages();

            // Simulate AI thinking
            setTimeout(() => {
                this.messages.push({
                    text: this.mockAgentResponse(text || "audio"), // Simple mock response
                    sender: "Wilco AI 🤖",
                    senderId: "ai_agent",
                    timestamp: Date.now()
                });
                this.saveLocalData();
                this.renderMessages();
            }, 1000);
            return;
        }

        try {
            // 1. Send User Message (Firestore)
            // Note: We don't save the full audio to Firestore messages collection to save space, just text/placeholder.
            await this.db.collection('messages').add({
                ...messageData,
                ownerId: user.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. TRIGGER AI AGENT (Real Cloud Function)
            // Trigger ALWAYS (Chat is now AI-only)
            if (text || audioBase64) {
                const clientAgent = firebase.functions().httpsCallable('clientAgent');

                // Show "Typing..." indicator (Optimistic UI) - NOW WITH ANIMATION
                const tempId = 'ai_typing_' + Date.now();
                this.messages.push({
                    type: 'typing', // Special type for animation
                    sender: "Wilco AI 🤖",
                    senderId: "ai_agent",
                    timestamp: Date.now(),
                    isTemp: true,
                    id: tempId
                });
                // Ensure messages render immediately so user sees "Listening..."
                this.renderMessages();

                // Prepare History (Last 10 messages)
                const history = this.messages
                    .filter(m => !m.isTemp && m.text) // Filter out temp/empty
                    .slice(-10) // Last 10
                    .map(m => ({
                        role: m.senderId === 'ai_agent' ? 'model' : 'user',
                        content: [{ text: m.text }] // Genkit format
                    }));

                // Determine User Name (Check Team, then Clients, then Auth)
                let userName = user.displayName || user.email.split('@')[0];
                if (this.team) {
                    const teamMember = this.team.find(t => t.email === user.email);
                    if (teamMember) userName = teamMember.name;
                }
                if (this.clients) {
                    const client = this.clients.find(c => c.email === user.email);
                    if (client) userName = client.name;
                }

                const payload = {
                    userId: (this.clients.find(c => c.email === user.email)?.id) || undefined,
                    userName: userName,
                    history: history
                };

                if (text) payload.message = text;
                if (audioBase64) {
                    payload.audio = {
                        data: audioBase64,
                        mimeType: 'audio/webm'
                    };
                }

                clientAgent(payload).then(async (result) => {
                    console.log("AI Agent Raw Result:", result);

                    // Remove temp "Thinking..." message
                    this.messages = this.messages.filter(m => m.id !== tempId);

                    if (!result || !result.data || !result.data.text) {
                        console.error("Invalid AI response:", result);
                        this.renderMessages(); // Re-render to remove typing
                        return;
                    }

                    // Save Real Response to Firestore
                    await this.db.collection('messages').add({
                        text: result.data.text,
                        sender: 'Wilco AI 🤖',
                        senderId: 'ai_agent',
                        ownerId: user.uid,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // Note: Listener will pick up the new message and trigger re-render
                }).catch(error => {
                    console.error("AI Agent Error:", error);
                    this.messages = this.messages.filter(m => m.id !== tempId);
                    this.renderMessages();
                    alert("AI Agent Failed: " + error.message);
                });
            }

        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message: " + error.message);
        }
    },

    // Mock Agent Logic (Mirroring the Genkit Flow)
    mockAgentResponse: async function (input) {
        input = input.toLowerCase();
        if (input.includes('price') || input.includes('cost')) {
            return "I can check pricing for you. A standard water heater installation starts at $1,200. Would you like a formal quote?";
        }
        if (input.includes('schedule') || input.includes('time') || input.includes('book')) {
            return "I've checked the schedule. We have an opening tomorrow at 2:00 PM. Should I book it?";
        }
        return "I'm the AI assistant. I can help with Quotes and Scheduling. How can I facilitate?";
    },

    renderMessages: function () {
        const container = document.getElementById('chat-messages');
        if (!container) {
            console.warn("Chat container not found!");
            return;
        }

        console.log("Rendering messages. Count:", this.messages.length); // Debug log
        container.innerHTML = '';

        if (this.messages.length === 0) {
            container.innerHTML = `<div class="message system"><p>Welcome to the Team Chat! Be the first to say hello.</p></div>`;
        }

        this.messages.forEach(msg => {
            if (!msg.type && (!msg.text || (typeof msg.text === 'string' && !msg.text.trim()))) return;

            const div = document.createElement('div');
            const isSelf = (this.auth && this.auth.currentUser && msg.senderId === this.auth.currentUser.uid);

            if (msg.type === 'typing') {
                div.className = `message typing`;
                div.innerHTML = `
                    <span class="sender-name">${msg.sender}</span>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                `;
            } else {
                div.className = `message ${isSelf ? 'self' : 'other'}`;
                div.innerHTML = `
                    <span class="sender-name">${msg.sender}</span>
                    ${msg.text}
                `;
            }
            container.appendChild(div);
        });

        // Auto scroll to bottom
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
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
    },

    // --- ONBOARDING ---
    startOnboarding: function () {
        if (!localStorage.getItem('wilco_onboarding_seen')) {
            this.onboardingStep = 0;
            document.getElementById('onboarding-overlay').classList.add('open');
            this.renderOnboardingStep();
        }
    },

    renderOnboardingStep: function () {
        const step = this.onboardingSteps[this.onboardingStep];
        const content = document.getElementById('onboarding-content');
        const btn = document.getElementById('btn-onboarding-next');

        content.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 1rem;">${step.icon}</div>
            <h3 style="color: var(--accent); margin-bottom: 1rem;">${step.title}</h3>
            <p style="color: var(--text-muted); line-height: 1.6;">${step.text}</p>
            <div class="step-dots" style="display:flex; justify-content:center; gap:0.5rem; margin-top:1.5rem;">
                ${this.onboardingSteps.map((_, i) =>
            `<span style="width:10px; height:10px; border-radius:50%; background:${i === this.onboardingStep ? 'var(--accent)' : 'var(--border)'};"></span>`
        ).join('')}
            </div>
        `;

        btn.innerText = (this.onboardingStep === this.onboardingSteps.length - 1) ? "Finish" : "Next";
    },

    nextOnboardingStep: function () {
        if (this.onboardingStep < this.onboardingSteps.length - 1) {
            this.onboardingStep++;
            this.renderOnboardingStep();
        } else {
            document.getElementById('onboarding-overlay').classList.remove('open');
            localStorage.setItem('wilco_onboarding_seen', 'true');
        }
    },

    // --- MEDIA HANDLING ---

    currentMedia: [], // Temp store for modal

    handleFileUpload: async function (event) {
        const files = event.target.files;
        if (!files.length) return;

        const previewContainer = document.getElementById('media-previews');
        previewContainer.innerHTML += '<div class="loading-spinner">Uploading...</div>';

        for (let file of files) {
            try {
                // simple path: uploads/{timestamp}_{filename}
                const path = `uploads/${Date.now()}_${file.name}`;
                const ref = this.storage.ref().child(path);

                const snapshot = await ref.put(file);
                const url = await snapshot.ref.getDownloadURL();

                this.currentMedia.push({
                    url: url,
                    type: file.type,
                    name: file.name
                });
            } catch (error) {
                console.error("Upload failed:", error);
                alert("Upload failed: " + error.message);
            }
        }

        this.renderMediaPreviews();
    },

    deleteMedia: function (index) {
        this.currentMedia.splice(index, 1);
        this.renderMediaPreviews();
    },

    renderMediaPreviews: function () {
        const container = document.getElementById('media-previews');
        if (!container) return;

        container.innerHTML = '';

        this.currentMedia.forEach((media, index) => {
            const div = document.createElement('div');
            div.className = 'media-preview-item';
            div.style.position = 'relative';
            div.style.display = 'inline-block';
            div.style.margin = '5px';

            // Check if image
            if ((media.type && media.type.startsWith('image/')) || (media.url && media.url.match(/\.(jpeg|jpg|gif|png)/i))) {
                div.innerHTML = `<img src="${media.url}" alt="Preview" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;" onclick="window.open('${media.url}')">`;
            } else {
                div.innerHTML = `<div class="file-icon" style="width:60px; height:60px; background:#eee; display:flex; align-items:center; justify-content:center; border-radius:4px; cursor:pointer;" onclick="window.open('${media.url}')">📄</div>`;
            }

            div.innerHTML += `<button style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:18px; height:18px; line-height:16px; font-size:12px; cursor:pointer;" onclick="crm.deleteMedia(${index})">×</button>`;
            container.appendChild(div);
        });
    },

    toggleChat: function () {
        const win = document.getElementById('ai-chat-window');
        if (win) {
            win.classList.toggle('open');
            if (win.classList.contains('open')) {
                this.renderMessages();
                // Auto focus input
                setTimeout(() => document.getElementById('message-input').focus(), 100);
            }
        }
    }
};

// Global Error Handler for Debugging
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const errorMsg = `Global Error: ${msg}\nLine: ${lineNo}\nColumn: ${columnNo}\nError: ${error}`;
    console.error(errorMsg);
    alert(errorMsg);
    return false;
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        crm.init();
    } catch (error) {
        console.error("Critical Init Error:", error);
        alert("System Error: " + error.message);
    }
});
