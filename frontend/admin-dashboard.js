
// ParkEase Admin Dashboard

// Use window.API_URL to avoid duplicate API_URL declarations
window.API_URL = "https://parkease-backend-ilke.onrender.com/api";

const adminDashboardSection = document.getElementById("adminDashboardSection");

// Check admin login safely
let admin = null;

try {
    admin = JSON.parse(sessionStorage.getItem("parkeaseAdmin"));
} catch (error) {
    console.error("Invalid admin session:", error);
    sessionStorage.removeItem("parkeaseAdmin");
}

// Run dashboard only when admin is logged in
if (adminDashboardSection && admin) {

    // Show admin dashboard
    adminDashboardSection.style.display = "block";

    // Hide normal website
    const mainWebsite = document.getElementById("mainWebsite");
    if (mainWebsite) {
        mainWebsite.style.display = "none";
    }

    // Hide footer
    const footer = document.querySelector(".footer");
    if (footer) {
        footer.style.display = "none";
    }

    // Hide main navigation
    const navbar = document.querySelector("body > .navbar");
    if (navbar) {
        navbar.style.display = "none";
    }

    // Display admin name
    const adminName = document.getElementById("adminName");
    if (adminName) {
        adminName.textContent = admin.name || "Admin";
    }

    // Admin logout
    const logoutButton = document.getElementById("adminLogoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            sessionStorage.removeItem("parkeaseAdmin");
            window.location.href = "index.html";
        });
    }

    // Safely display database text
    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    // Fetch and display parking locations
    async function fetchAdminParking() {
        const container = document.getElementById("adminParkingContainer");

        if (!container) return;

        try {
            const response = await fetch(
                `${window.API_URL}/admin/parking`
            );

            if (!response.ok) {
                throw new Error("Unable to fetch parking");
            }

            const parkingData = await response.json();

            const totalSlots = parkingData.reduce(
                (sum, item) => sum + Number(item.total_slots), 0
            );

            const availableSlots = parkingData.reduce(
                (sum, item) => sum + Number(item.available_slots), 0
            );

            document.getElementById("totalLocations").textContent =
                parkingData.length;

            document.getElementById("totalSlots").textContent =
                totalSlots;

            document.getElementById("availableSlots").textContent =
                availableSlots;

            if (parkingData.length === 0) {
                container.textContent = "No parking locations found.";
                return;
            }

            container.innerHTML = parkingData.map(item => `
                <div class="feature-card">
                    <h3>${escapeHTML(item.location)}</h3>

                    <p>Total Slots: ${Number(item.total_slots)}</p>

                    <p>Available Slots: ${Number(item.available_slots)}</p>

                    <p>Price Per Hour: ₹${Number(item.price_per_hour).toFixed(2)}</p>

                    <button
                        class="btn btn-primary"
                        onclick="editParking(${Number(item.id)})">
                        Edit
                    </button>

                    <button
                        class="btn btn-danger"
                        onclick="deleteParking(${Number(item.id)})">
                        Delete
                    </button>
                </div>
            `).join("");

        } catch (error) {
            console.error("Parking error:", error);
            container.textContent = "Unable to load parking locations.";
        }
    }

    // Fetch and display all bookings
    async function fetchAdminBookings() {
        const container = document.getElementById("adminBookingsContainer");

        if (!container) return;

        try {
            const response = await fetch(
                `${window.API_URL}/admin/bookings`
            );

            if (!response.ok) {
                throw new Error("Unable to fetch bookings");
            }

            const bookings = await response.json();

            document.getElementById("totalBookings").textContent =
                bookings.length;

            if (bookings.length === 0) {
                container.textContent = "No bookings found yet.";
                return;
            }

            container.innerHTML = bookings.map(booking => `
                <div class="feature-card">
                    <h3>Booking #${Number(booking.booking_id)}</h3>

                    <p><strong>Customer:</strong>
                        ${escapeHTML(booking.customer_name)}</p>

                    <p><strong>Email:</strong>
                        ${escapeHTML(booking.customer_email || "Not available")}</p>

                    <p><strong>Location:</strong>
                        ${escapeHTML(booking.location)}</p>

                    <p><strong>Slots:</strong>
                        ${Number(booking.slots_booked)}</p>

                    <p><strong>Price/hour:</strong>
                        ₹${Number(booking.price_per_hour).toFixed(2)}</p>

                    <p><strong>Date:</strong>
                        ${escapeHTML(new Date(booking.booking_date).toLocaleString())}</p>

                    <p><strong>Status:</strong>
                        ${escapeHTML(booking.status)}</p>
                </div>
            `).join("");

        } catch (error) {
            console.error("Bookings error:", error);
            container.textContent = "Unable to load bookings.";
        }
    }

    // Fetch and display registered users
    async function fetchAdminUsers() {
        const container = document.getElementById("adminUsersContainer");

        if (!container) return;

        try {
            const response = await fetch(
                `${window.API_URL}/admin/users`
            );

            if (!response.ok) {
                throw new Error("Unable to fetch users");
            }

            const users = await response.json();

            if (users.length === 0) {
                container.textContent = "No registered users found.";
                return;
            }

            container.innerHTML = users.map(user => `
                <div class="feature-card">
                    <h3>${escapeHTML(user.name)}</h3>

                    <p><strong>User ID:</strong> ${Number(user.id)}</p>

                    <p><strong>Email:</strong>
                        ${escapeHTML(user.email)}</p>

                    <p><strong>Registered:</strong>
                        ${escapeHTML(new Date(user.created_at).toLocaleString())}
                    </p>
                </div>
            `).join("");

        } catch (error) {
            console.error("Users error:", error);
            container.textContent = "Unable to load registered users.";
        }
    }

    // Add new parking location
    const addParkingForm = document.getElementById("addParkingForm");

    if (addParkingForm) {
        addParkingForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const location = document.getElementById("parkingLocation").value.trim();

            const total_slots = Number(
                document.getElementById("totalParkingSlots").value
            );

            const available_slots = Number(
                document.getElementById("availableParkingSlots").value
            );

            const price_per_hour = Number(
                document.getElementById("parkingPrice").value
            );

            const message = document.getElementById("parkingFormMessage");

            if (
                !location ||
                !Number.isInteger(total_slots) ||
                total_slots < 1 ||
                !Number.isInteger(available_slots) ||
                available_slots < 0 ||
                available_slots > total_slots ||
                !Number.isFinite(price_per_hour) ||
                price_per_hour < 0
            ) {
                message.textContent = "Please enter valid parking details.";
                return;
            }

            message.textContent = "Adding parking location...";

            try {
                const response = await fetch(
                    `${window.API_URL}/admin/parking`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            location,
                            total_slots,
                            available_slots,
                            price_per_hour
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    message.textContent =
                        data.message || "Unable to add parking location.";
                    return;
                }

                message.textContent =
                    data.message || "Parking location added successfully.";

                addParkingForm.reset();

                await fetchAdminParking();

            } catch (error) {
                console.error(error);
                message.textContent = "Unable to connect to server.";
            }
        });
    }

    // Edit parking location
    window.editParking = async function (id) {

        const newLocation = prompt("Enter new parking location name:");
        if (newLocation === null) return;

        const location = newLocation.trim();

        if (!location) {
            alert("Location name cannot be empty.");
            return;
        }

        const totalSlots = prompt("Enter total parking slots:");
        if (totalSlots === null) return;

        const availableSlots = prompt("Enter available parking slots:");
        if (availableSlots === null) return;

        const price = prompt("Enter price per hour:");
        if (price === null) return;

        const total = Number(totalSlots);
        const available = Number(availableSlots);
        const hourlyPrice = Number(price);

        if (
            !Number.isInteger(total) ||
            total < 1 ||
            !Number.isInteger(available) ||
            available < 0 ||
            available > total ||
            !Number.isFinite(hourlyPrice) ||
            hourlyPrice < 0
        ) {
            alert("Please enter valid parking details.");
            return;
        }

        try {
            const response = await fetch(
                `${window.API_URL}/admin/parking/${id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        location,
                        total_slots: total,
                        available_slots: available,
                        price_per_hour: hourlyPrice
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Unable to update parking.");
                return;
            }

            alert(data.message || "Parking updated successfully.");

            await fetchAdminParking();

        } catch (error) {
            console.error(error);
            alert("Unable to update parking location.");
        }
    };

    // Delete parking location
    window.deleteParking = async function (id) {

        const confirmDelete = confirm(
            "Are you sure you want to delete this parking location?"
        );

        if (!confirmDelete) return;

        try {
            const response = await fetch(
                `${window.API_URL}/admin/parking/${id}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Unable to delete parking.");
                return;
            }

            alert(data.message || "Parking deleted successfully.");

            await fetchAdminParking();

        } catch (error) {
            console.error("Delete parking error:", error);
            alert("Unable to delete parking location.");
        }
    };

    // Load dashboard data
    fetchAdminParking();
    fetchAdminBookings();
    fetchAdminUsers();
}
