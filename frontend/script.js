
const API_URL = "https://parkease-backend-ilke.onrender.com/api";

const parkingContainer = document.getElementById("parkingContainer");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const locationCount = document.getElementById("locationCount");
const availableCount = document.getElementById("availableCount");
const totalCount = document.getElementById("totalCount");
const errorMessage = document.getElementById("errorMessage");

const bookingsContainer = document.getElementById("bookingsContainer");
const bookingsMessage = document.getElementById("bookingsMessage");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const profileName = document.getElementById("profileName");

let parkingLocations = [];

// Get logged-in user
function getCurrentUser() {
    try {
        return JSON.parse(
            sessionStorage.getItem("parkeaseUser") || "null"
        );
    } catch {
        return null;
    }
}

// Update navigation
function updateNavigation() {
    const user = getCurrentUser();

    if (user) {
        loginBtn.style.display = "none";
        signupBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        profileName.style.display = "inline-block";
        profileName.textContent = "Hello, " + user.name;
    } else {
        loginBtn.style.display = "inline-block";
        signupBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        profileName.style.display = "none";
        profileName.textContent = "";
    }
}

// Logout
logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("parkeaseUser");
    updateNavigation();
    fetchMyBookings();

    alert("You have logged out successfully!");
});

// Fetch parking data
async function fetchParkingData() {
    try {
        parkingContainer.innerHTML =
            '<p class="loading-message">Loading parking locations...</p>';

        errorMessage.textContent = "";

        const response = await fetch(`${API_URL}/parking`);

        if (!response.ok) {
            throw new Error("Unable to fetch parking data.");
        }

        parkingLocations = await response.json();

        updateSummary(parkingLocations);
        displayParking(parkingLocations);

    } catch (error) {
        console.error(error);

        parkingContainer.innerHTML =
            '<p class="empty-message">Unable to load parking locations.</p>';

        errorMessage.textContent =
            "Please make sure your backend and MySQL server are running.";
    }
}

// Update summary
function updateSummary(locations) {
    locationCount.textContent = locations.length;

    totalCount.textContent = locations.reduce(
        (sum, parking) => sum + Number(parking.total_slots), 0
    );

    availableCount.textContent = locations.reduce(
        (sum, parking) => sum + Number(parking.available_slots), 0
    );
}

// Display parking cards
function displayParking(locations) {
    parkingContainer.innerHTML = "";

    if (locations.length === 0) {
        parkingContainer.innerHTML =
            '<p class="empty-message">No parking locations found.</p>';
        return;
    }

    locations.forEach(parking => {
        const available = Number(parking.available_slots);
        const total = Number(parking.total_slots);

        const percentage = total > 0
            ? Math.max(0, Math.min(100, (available / total) * 100))
            : 0;

        const isAvailable = available > 0;

        const card = document.createElement("article");
        card.className = "parking-card";

        const top = document.createElement("div");
        top.className = "card-top";

        const icon = document.createElement("div");
        icon.className = "parking-icon";
        icon.textContent = "🅿️";

        const status = document.createElement("span");
        status.className = `status ${isAvailable ? "available" : "full"}`;
        status.textContent = isAvailable ? "Available" : "Full";

        top.append(icon, status);

        const title = document.createElement("h3");
        title.textContent = parking.location;

        const locationText = document.createElement("p");
        locationText.className = "location-text";
        locationText.textContent = "📍 Parking location";

        const slotInfo = document.createElement("div");
        slotInfo.className = "slot-info";

        const availableText = document.createElement("span");
        availableText.textContent = "Available slots";

        const slotCount = document.createElement("strong");
        slotCount.textContent = `${available} / ${total}`;

        slotInfo.append(availableText, slotCount);

        const track = document.createElement("div");
        track.className = "progress-track";

        const fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = `${percentage}%`;

        track.appendChild(fill);

        const bottom = document.createElement("div");
        bottom.className = "card-bottom";

        const price = document.createElement("div");
        price.className = "price";
        price.textContent =
            `₹${Number(parking.price_per_hour).toFixed(2)}`;

        const priceLabel = document.createElement("small");
        priceLabel.textContent = " / hour";
        price.appendChild(priceLabel);

        const bookButton = document.createElement("button");
        bookButton.className = "btn btn-primary book-btn";
        bookButton.textContent = "Book Now";
        bookButton.disabled = !isAvailable;

        // Booking feature
        bookButton.addEventListener("click", async () => {
            const currentUser = getCurrentUser();

            if (!currentUser || !currentUser.id) {
                alert("Please log in before booking.");
                showAuthForm("login");
                return;
            }

            const slotsInput = prompt(
                `How many slots do you want to book at ${parking.location}?`
            );

            if (slotsInput === null) return;

            const slots = Number(slotsInput);

            if (!Number.isInteger(slots) || slots < 1) {
                alert("Please enter a valid number of slots.");
                return;
            }

            if (slots > available) {
                alert(`Only ${available} slots are available.`);
                return;
            }

            try {
                bookButton.disabled = true;
                bookButton.textContent = "Booking...";

                const response = await fetch(`${API_URL}/bookings`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        parking_id: Number(parking.id),
                        customer_name: currentUser.name,
                        slots_booked: slots,
                        user_id: Number(currentUser.id)
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || "Booking failed.");
                }

                alert("Parking booked successfully!");

                await fetchParkingData();
                await fetchMyBookings();

            } catch (error) {
                alert(error.message);
                console.error(error);

            } finally {
                bookButton.disabled = false;
                bookButton.textContent = "Book Now";
            }
        });

        bottom.append(price, bookButton);

        card.append(
            top,
            title,
            locationText,
            slotInfo,
            track,
            bottom
        );

        parkingContainer.appendChild(card);
    });
}

// Fetch bookings for logged-in user
async function fetchMyBookings() {
    const currentUser = getCurrentUser();

    bookingsContainer.innerHTML = "";
    bookingsMessage.textContent = "";

    if (!currentUser || !currentUser.id) {
        bookingsContainer.innerHTML =
            '<p class="loading-message">Please log in to view your bookings.</p>';
        return;
    }

    try {
        bookingsContainer.innerHTML =
            '<p class="loading-message">Loading your bookings...</p>';

        const response = await fetch(
            `${API_URL}/bookings/${Number(currentUser.id)}`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to load bookings.");
        }

        displayMyBookings(result);

    } catch (error) {
        console.error(error);

        bookingsContainer.innerHTML = "";
        bookingsMessage.textContent = error.message;
    }
}

// Cancel booking
async function cancelBooking(bookingId, button) {
    const currentUser = getCurrentUser();

    if (!currentUser || !currentUser.id) {
        alert("Please log in first.");
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to cancel booking #${bookingId}?`
    );

    if (!confirmed) return;

    try {
        button.disabled = true;
        button.textContent = "Cancelling...";

        const response = await fetch(
            `${API_URL}/bookings/${bookingId}`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: Number(currentUser.id)
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Cancellation failed.");
        }

        alert(result.message || "Booking cancelled successfully!");

        // Refresh parking and booking information
        await fetchParkingData();
        await fetchMyBookings();

    } catch (error) {
        console.error("Cancellation error:", error);
        alert(error.message);

        button.disabled = false;
        button.textContent = "Cancel Booking";
    }
}

// Display booking history
function displayMyBookings(bookings) {
    bookingsContainer.innerHTML = "";

    if (!Array.isArray(bookings) || bookings.length === 0) {
        bookingsContainer.innerHTML = `
            <div class="empty-message">
                You haven't made any bookings yet.
                <br>
                <a href="#parking">Find Parking Now</a>
            </div>
        `;
        return;
    }

    bookings.forEach(booking => {
        const card = document.createElement("article");

        card.className = "feature-card";
        card.style.cssText = `
            margin-bottom: 18px;
            text-align: left;
            padding: 24px;
        `;

        const title = document.createElement("h3");
        title.textContent = booking.location;

        const bookingId = document.createElement("p");
        bookingId.textContent = `Booking ID: #${booking.booking_id}`;

        const customer = document.createElement("p");
        customer.textContent = `Customer: ${booking.customer_name}`;

        const slots = document.createElement("p");
        slots.textContent = `Slots booked: ${booking.slots_booked}`;

        const price = document.createElement("p");
        price.textContent =
            `Price per hour: ₹${Number(booking.price_per_hour).toFixed(2)}`;

        const date = document.createElement("p");
        const bookingDate = new Date(booking.booking_date);

        date.textContent = !Number.isNaN(bookingDate.getTime())
            ? `Booking date: ${bookingDate.toLocaleString()}`
            : "Booking date: Not available";

        const status = document.createElement("span");
        status.className = "status available";
        status.textContent = booking.status || "Booked";

        card.append(
            title,
            bookingId,
            customer,
            slots,
            price,
            date,
            status
        );

        // Cancel button
        if (booking.status !== "Cancelled") {
            const cancelButton = document.createElement("button");

            cancelButton.className = "btn btn-outline";
            cancelButton.textContent = "Cancel Booking";
            cancelButton.style.marginTop = "15px";

            cancelButton.addEventListener("click", () => {
                cancelBooking(booking.booking_id, cancelButton);
            });

            card.appendChild(cancelButton);
        }

        bookingsContainer.appendChild(card);
    });
}

// Search parking
function searchParking() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filteredLocations = parkingLocations.filter(parking =>
        parking.location.toLowerCase().includes(searchTerm)
    );

    updateSummary(filteredLocations);
    displayParking(filteredLocations);
}

searchBtn.addEventListener("click", searchParking);
searchInput.addEventListener("input", searchParking);

// Mobile navigation
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("active");
    });

    navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
        });
    });
}

// Create login/signup popup
function showAuthForm(mode) {
    const oldModal = document.getElementById("authModal");

    if (oldModal) oldModal.remove();

    const isSignup = mode === "signup";

    const modal = document.createElement("div");
    modal.id = "authModal";

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.75);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        padding: 20px;
    `;

    const form = document.createElement("form");

    form.style.cssText = `
        background: white;
        color: #172033;
        padding: 30px;
        border-radius: 15px;
        width: 100%;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    `;

    form.innerHTML = `
        <h2 style="margin:0">
            ${isSignup ? "Create Account" : "Welcome Back"}
        </h2>

        <p style="margin:0;color:#667085">
            ${isSignup ? "Register for ParkEase" : "Login to your ParkEase account"}
        </p>

        ${isSignup ? `
            <label for="authName">Full Name</label>
            <input id="authName" type="text" required maxlength="100"
                placeholder="Enter your name"
                style="padding:12px;border:1px solid #ccc;border-radius:7px">
        ` : ""}

        <label for="authEmail">Email Address</label>
        <input id="authEmail" type="email" required maxlength="150"
            placeholder="Enter your email"
            style="padding:12px;border:1px solid #ccc;border-radius:7px">

        <label for="authPassword">Password</label>
        <input id="authPassword" type="password" required
            minlength="${isSignup ? 8 : 1}" maxlength="72"
            placeholder="Enter your password"
            style="padding:12px;border:1px solid #ccc;border-radius:7px">

        <p id="authMessage" style="margin:0;color:#dc2626"></p>

        <button type="submit"
            style="padding:13px;background:#2563eb;color:white;border:0;border-radius:7px;cursor:pointer">
            ${isSignup ? "Create Account" : "Login"}
        </button>

        <button type="button" id="switchAuth"
            style="padding:10px;background:#eef2ff;color:#1d4ed8;border:0;border-radius:7px;cursor:pointer">
            ${isSignup ? "Already have an account? Login" : "New user? Create an account"}
        </button>

        <button type="button" id="closeAuth"
            style="padding:8px;background:transparent;color:#555;border:0;cursor:pointer">
            Close
        </button>
    `;

    modal.appendChild(form);
    document.body.appendChild(modal);

    document.getElementById("closeAuth").addEventListener("click", () => {
        modal.remove();
    });

    document.getElementById("switchAuth").addEventListener("click", () => {
        showAuthForm(isSignup ? "login" : "signup");
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) modal.remove();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const message = document.getElementById("authMessage");
        const submitButton = form.querySelector('button[type="submit"]');

        const email = document.getElementById("authEmail").value.trim();
        const password = document.getElementById("authPassword").value;

        const payload = { email, password };

        if (isSignup) {
            payload.name = document.getElementById("authName").value.trim();
        }

        try {
            submitButton.disabled = true;
            submitButton.textContent = "Please wait...";
            message.style.color = "#667085";
            message.textContent = "Connecting to server...";

            const response = await fetch(
                `${API_URL}/${isSignup ? "signup" : "login"}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Something went wrong.");
            }

            message.style.color = "green";
            message.textContent = result.message || "Success!";

            if (!isSignup) {
                sessionStorage.setItem(
                    "parkeaseUser",
                    JSON.stringify(result.user)
                );

                updateNavigation();

                setTimeout(async () => {
                    modal.remove();
                    alert(`Welcome, ${result.user.name}!`);
                    await fetchMyBookings();
                }, 700);
            }

        } catch (error) {
            message.style.color = "#dc2626";
            message.textContent = error.message;

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isSignup ? "Create Account" : "Login";
        }
    });
}

// Login button
loginBtn.addEventListener("click", () => {
    showAuthForm("login");
});

// Signup button
signupBtn.addEventListener("click", () => {
    showAuthForm("signup");
});

// Initial loading
updateNavigation();
fetchParkingData();
fetchMyBookings();
