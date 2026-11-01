
const API_URL = "https://parkease-backend-ilke.onrender.com/api";

const adminLoginForm = document.getElementById("adminLoginForm");
const adminMessage = document.getElementById("adminMessage");

adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    adminMessage.textContent = "Logging in...";

    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            adminMessage.textContent = data.message;
            return;
        }

        sessionStorage.setItem(
            "parkeaseAdmin",
            JSON.stringify(data.admin)
        );

        adminMessage.textContent = "Login successful!";

        // Open the main website after successful admin login
        window.location.href = "index.html";

    } catch (error) {
        console.error(error);

        adminMessage.textContent =
            "Cannot connect to server. Please try again.";
    }
});
