// ═══════════════════════════════════════════════════════════
//  Lost & Found DApp — Frontend Logic (Ethers.js + MetaMask)
// ═══════════════════════════════════════════════════════════

// ── CONTRACT CONFIG ────────────────────────────────────────
// Update these after deploying the contract via Remix IDE.
const CONTRACT_ADDRESS = "0xe0803CfE4300A54182487B1BCA54cB517d5C6047";

const CONTRACT_ABI = [
    // ── Read-only functions ──
    "function owner() view returns (address)",
    "function itemCount() view returns (uint256)",
    "function getItem(uint256 _id) view returns (uint256 id, address reporter, string title, string description, string location, string contactInfo, uint8 itemType, uint8 status, uint256 timestamp)",
    "function getItemCount() view returns (uint256)",

    // ── State-changing functions ──
    "function reportItem(string _title, string _description, string _location, string _contactInfo, uint8 _itemType)",
    "function resolveItem(uint256 _id)",
    "function adminResolve(uint256 _id)",

    // ── Events ──
    "event ItemReported(uint256 indexed id, address indexed reporter, string title, uint8 itemType, uint256 timestamp)",
    "event ItemResolved(uint256 indexed id, address indexed resolver, uint256 timestamp)"
];

// ── Globals ────────────────────────────────────────────────
let provider = null;
let signer = null;
let contract = null;
let userAddress = null;

// ── UI Helpers ─────────────────────────────────────────────

function showStatus(message, type = "info") {
    const bar = document.getElementById("status-bar");
    const msg = document.getElementById("status-message");
    bar.className = type;           // info | success | error
    msg.textContent = message;
    bar.classList.remove("hidden");

    // Auto-hide after 6 seconds
    setTimeout(() => {
        bar.classList.add("hidden");
    }, 6000);
}

function shortAddr(addr) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatDate(timestamp) {
    return new Date(Number(timestamp) * 1000).toLocaleString();
}

// ── Wallet Connection ──────────────────────────────────────

async function connectWallet() {
    // Check MetaMask is installed
    if (typeof window.ethereum === "undefined") {
        showStatus("MetaMask is not installed. Please install it to continue.", "error");
        return;
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAddress = accounts[0];

        // Create provider + signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();

        // Create contract instance
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Update UI
        document.getElementById("btn-connect").textContent = "Connected ✓";
        document.getElementById("btn-connect").disabled = true;

        document.getElementById("wallet-address").textContent = shortAddr(userAddress);

        // Show network name
        const network = await provider.getNetwork();
        document.getElementById("network-name").textContent = network.name === "unknown"
            ? `Chain ${network.chainId}`
            : network.name;

        document.getElementById("wallet-info").classList.remove("hidden");

        showStatus("Wallet connected successfully!", "success");

        // Load existing items
        await loadAllItems();

    } catch (err) {
        console.error(err);
        showStatus("Connection failed: " + err.message, "error");
    }
}

// Listen for account / network changes
if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
            location.reload();
        } else {
            userAddress = accounts[0];
            document.getElementById("wallet-address").textContent = shortAddr(userAddress);
            loadAllItems();
        }
    });
    window.ethereum.on("chainChanged", () => location.reload());
}

// ── Report Item ────────────────────────────────────────────

async function reportItem(event) {
    event.preventDefault();

    if (!contract) {
        showStatus("Please connect your wallet first.", "error");
        return;
    }

    const title = document.getElementById("input-title").value.trim();
    const description = document.getElementById("input-description").value.trim();
    const location = document.getElementById("input-location").value.trim();
    const contactInfo = document.getElementById("input-contact").value.trim();
    const itemType = parseInt(document.getElementById("input-type").value);

    // Client-side validation
    if (!title || title.length > 100) {
        showStatus("Title must be 1-100 characters.", "error");
        return;
    }
    if (!description || description.length > 500) {
        showStatus("Description must be 1-500 characters.", "error");
        return;
    }
    if (!location) {
        showStatus("Location cannot be empty.", "error");
        return;
    }
    if (!contactInfo) {
        showStatus("Contact info cannot be empty.", "error");
        return;
    }

    try {
        showStatus("Sending transaction... please confirm in MetaMask.", "info");

        const tx = await contract.reportItem(title, description, location, contactInfo, itemType);
        showStatus("Transaction submitted. Waiting for confirmation...", "info");

        await tx.wait();
        showStatus("✅ Item reported successfully! TX: " + shortAddr(tx.hash), "success");

        // Reset form and reload items
        document.getElementById("report-form").reset();
        await loadAllItems();

    } catch (err) {
        console.error(err);
        const reason = err.reason || err.data?.message || err.message;
        showStatus("❌ Transaction failed: " + reason, "error");
    }
}

// ── Get Item by ID ─────────────────────────────────────────

async function getItemById() {
    if (!contract) {
        showStatus("Please connect your wallet first.", "error");
        return;
    }

    const id = parseInt(document.getElementById("input-search-id").value);
    if (!id || id < 1) {
        showStatus("Please enter a valid item ID.", "error");
        return;
    }

    try {
        const item = await contract.getItem(id);
        const resultDiv = document.getElementById("search-result");
        resultDiv.classList.remove("hidden");
        resultDiv.innerHTML = buildItemHTML(item);
    } catch (err) {
        console.error(err);
        const reason = err.reason || err.data?.message || err.message;
        showStatus("❌ " + reason, "error");
        document.getElementById("search-result").classList.add("hidden");
    }
}

// ── Resolve Item ───────────────────────────────────────────

async function resolveItem() {
    if (!contract) {
        showStatus("Please connect your wallet first.", "error");
        return;
    }

    const id = parseInt(document.getElementById("input-resolve-id").value);
    if (!id || id < 1) {
        showStatus("Please enter a valid item ID.", "error");
        return;
    }

    try {
        showStatus("Sending resolve transaction... confirm in MetaMask.", "info");
        const tx = await contract.resolveItem(id);
        showStatus("Transaction submitted. Waiting for confirmation...", "info");
        await tx.wait();
        showStatus("✅ Item #" + id + " marked as resolved!", "success");
        await loadAllItems();
    } catch (err) {
        console.error(err);
        const reason = err.reason || err.data?.message || err.message;
        showStatus("❌ " + reason, "error");
    }
}

// ── Admin Resolve ──────────────────────────────────────────

async function adminResolve() {
    if (!contract) {
        showStatus("Please connect your wallet first.", "error");
        return;
    }

    const id = parseInt(document.getElementById("input-admin-id").value);
    if (!id || id < 1) {
        showStatus("Please enter a valid item ID.", "error");
        return;
    }

    try {
        showStatus("Sending admin resolve transaction... confirm in MetaMask.", "info");
        const tx = await contract.adminResolve(id);
        showStatus("Transaction submitted. Waiting for confirmation...", "info");
        await tx.wait();
        showStatus("✅ Item #" + id + " admin-resolved!", "success");
        await loadAllItems();
    } catch (err) {
        console.error(err);
        const reason = err.reason || err.data?.message || err.message;
        showStatus("❌ " + reason, "error");
    }
}

// ── Load All Items ─────────────────────────────────────────

async function loadAllItems() {
    if (!contract) return;

    const container = document.getElementById("items-container");

    try {
        const count = await contract.getItemCount();
        const total = Number(count);

        if (total === 0) {
            container.innerHTML = '<p class="placeholder-text">No items reported yet. Be the first!</p>';
            return;
        }

        let html = "";
        // Show newest first
        for (let i = total; i >= 1; i--) {
            const item = await contract.getItem(i);
            html += buildItemCardHTML(item);
        }
        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="placeholder-text">Error loading items.</p>';
    }
}

// ── HTML Builders ──────────────────────────────────────────

function buildItemCardHTML(item) {
    const typeLabel = Number(item.itemType) === 0 ? "Lost" : "Found";
    const typeClass = Number(item.itemType) === 0 ? "tag-lost" : "tag-found";
    const statusLabel = Number(item.status) === 0 ? "Open" : "Resolved";
    const statusClass = Number(item.status) === 0 ? "tag-open" : "tag-resolved";

    return `
    <div class="item-card">
        <div class="item-header">
            <span class="item-id">#${item.id}</span>
            <div>
                <span class="item-tag ${typeClass}">${typeLabel}</span>
                <span class="item-tag ${statusClass}">${statusLabel}</span>
            </div>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="item-desc">${escapeHTML(item.description)}</p>
        <div class="item-meta">
            <span>📍 ${escapeHTML(item.location)}</span>
            <span>📞 ${escapeHTML(item.contactInfo)}</span>
            <span>👤 ${shortAddr(item.reporter)}</span>
            <span>🕐 ${formatDate(item.timestamp)}</span>
        </div>
    </div>`;
}

function buildItemHTML(item) {
    const typeLabel = Number(item.itemType) === 0 ? "Lost" : "Found";
    const statusLabel = Number(item.status) === 0 ? "Open" : "Resolved";

    return `
        <p><strong>ID:</strong> ${item.id}</p>
        <p><strong>Type:</strong> ${typeLabel}</p>
        <p><strong>Status:</strong> ${statusLabel}</p>
        <p><strong>Title:</strong> ${escapeHTML(item.title)}</p>
        <p><strong>Description:</strong> ${escapeHTML(item.description)}</p>
        <p><strong>Location:</strong> ${escapeHTML(item.location)}</p>
        <p><strong>Contact:</strong> ${escapeHTML(item.contactInfo)}</p>
        <p><strong>Reporter:</strong> ${item.reporter}</p>
        <p><strong>Time:</strong> ${formatDate(item.timestamp)}</p>
    `;
}

function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
