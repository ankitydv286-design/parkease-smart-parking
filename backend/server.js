
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// Home route
app.get("/", (req, res) => {
    res.send("ParkEase Smart Parking Backend is Running!");
});

// Get parking locations
app.get("/api/parking", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM parking");
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Error fetching parking locations."
        });
    }
});

// Book parking and connect booking to user
app.post("/api/bookings", async (req, res) => {
    const { parking_id, customer_name, slots_booked, user_id } = req.body;

    if (
        !Number.isInteger(parking_id) ||
        !Number.isInteger(user_id) ||
        user_id < 1 ||
        typeof customer_name !== "string" ||
        !customer_name.trim() ||
        !Number.isInteger(slots_booked) ||
        slots_booked < 1
    ) {
        return res.status(400).json({
            message: "Please provide valid booking details and log in."
        });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [users] = await connection.execute(
            "SELECT id FROM users WHERE id = ?",
            [user_id]
        );

        if (users.length === 0) {
            await connection.rollback();
            return res.status(401).json({
                message: "Please log in with a valid account."
            });
        }

        const [parkingRows] = await connection.execute(
            "SELECT available_slots FROM parking WHERE id = ? FOR UPDATE",
            [parking_id]
        );

        if (parkingRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: "Parking location not found."
            });
        }

        if (parkingRows[0].available_slots < slots_booked) {
            await connection.rollback();
            return res.status(400).json({
                message: "Not enough parking slots available."
            });
        }

        await connection.execute(
            `INSERT INTO bookings
            (parking_id, customer_name, slots_booked, user_id)
            VALUES (?, ?, ?, ?)`,
            [parking_id, customer_name.trim(), slots_booked, user_id]
        );

        await connection.execute(
            "UPDATE parking SET available_slots = available_slots - ? WHERE id = ?",
            [slots_booked, parking_id]
        );

        await connection.commit();

        res.status(201).json({
            message: "Parking booked successfully!"
        });

    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Booking error:", error);

        res.status(500).json({
            message: "Unable to complete booking."
        });

    } finally {
        if (connection) connection.release();
    }
});

// Get bookings for a particular user
app.get("/api/bookings/:userId", async (req, res) => {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId < 1) {
        return res.status(400).json({
            message: "Invalid user ID."
        });
    }

    try {
        const [bookings] = await db.execute(
            `SELECT
                b.id AS booking_id,
                b.customer_name,
                b.slots_booked,
                b.booking_date,
                b.status,
                p.location,
                p.price_per_hour
            FROM bookings b
            JOIN parking p ON b.parking_id = p.id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC`,
            [userId]
        );

        res.json(bookings);

    } catch (error) {
        console.error("My Bookings error:", error);

        res.status(500).json({
            message: "Unable to fetch bookings."
        });
    }
});

// Cancel a booking
app.delete("/api/bookings/:bookingId", async (req, res) => {
    const bookingId = Number(req.params.bookingId);
    const userId = Number(req.body.user_id);

    if (
        !Number.isInteger(bookingId) ||
        bookingId < 1 ||
        !Number.isInteger(userId) ||
        userId < 1
    ) {
        return res.status(400).json({
            message: "Invalid booking or user ID."
        });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [bookings] = await connection.execute(
            `SELECT id, parking_id, slots_booked
             FROM bookings
             WHERE id = ? AND user_id = ?
             FOR UPDATE`,
            [bookingId, userId]
        );

        if (bookings.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: "Booking not found."
            });
        }

        const booking = bookings[0];

        const [parkingRows] = await connection.execute(
            `SELECT total_slots, available_slots
             FROM parking
             WHERE id = ?
             FOR UPDATE`,
            [booking.parking_id]
        );

        if (parkingRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                message: "Parking location not found."
            });
        }

        await connection.execute(
            `UPDATE parking
             SET available_slots = LEAST(total_slots, available_slots + ?)
             WHERE id = ?`,
            [booking.slots_booked, booking.parking_id]
        );

        await connection.execute(
            "DELETE FROM bookings WHERE id = ? AND user_id = ?",
            [bookingId, userId]
        );

        await connection.commit();

        res.json({
            message: "Booking cancelled successfully!"
        });

    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Cancellation error:", error);

        res.status(500).json({
            message: "Unable to cancel booking."
        });

    } finally {
        if (connection) connection.release();
    }
});

// Signup API
app.post("/api/signup", async (req, res) => {
    const { name, email, password } = req.body;

    if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 72
    ) {
        return res.status(400).json({
            message: "Enter a valid name, email and password (8-72 characters)."
        });
    }

    try {
        const [existingUsers] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "This email is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            [name.trim(), email.trim().toLowerCase(), hashedPassword]
        );

        res.status(201).json({
            message: "Registration successful! You can now log in."
        });

    } catch (error) {
        console.error("Signup error:", error);

        res.status(500).json({
            message: "Registration failed."
        });
    }
});

// Login API
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            message: "Please enter your email and password."
        });
    }

    try {
        const [users] = await db.execute(
            "SELECT id, name, email, password FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        res.json({
            message: "Login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Login failed."
        });
    }
});


// Create admin account securely
app.post("/api/admin/setup", async (req, res) => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminName = process.env.ADMIN_NAME;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminName || !adminPassword) {
            return res.status(500).json({
                message: "Admin details are missing from .env"
            });
        }

        // Check if admin already exists
        const [existingAdmins] = await db.execute(
            "SELECT id FROM admins WHERE email = ?",
            [adminEmail]
        );

        if (existingAdmins.length > 0) {
            return res.status(409).json({
                message: "Admin account already exists."
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        // Create admin
        await db.execute(
            `INSERT INTO admins (name, email, password)
             VALUES (?, ?, ?)`,
            [adminName, adminEmail, hashedPassword]
        );

        res.status(201).json({
            message: "Admin account created successfully!"
        });

    } catch (error) {
        console.error("Admin setup error:", error);

        res.status(500).json({
            message: "Unable to create admin account."
        });
    }
});


// Admin Login API
app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            message: "Please enter email and password."
        });
    }

    try {
        const [admins] = await db.execute(
            "SELECT id, name, email, password FROM admins WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                message: "Invalid admin email or password."
            });
        }

        const admin = admins[0];

        const passwordMatches = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid admin email or password."
            });
        }

        res.json({
            message: "Admin login successful!",
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email
            }
        });

    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            message: "Admin login failed."
        });
    }
});


// Admin: Get all parking locations
app.get("/api/admin/parking", async (req, res) => {
    try {
        const [parking] = await db.execute(
            "SELECT * FROM parking ORDER BY id DESC"
        );

        res.json(parking);

    } catch (error) {
        console.error("Admin parking error:", error);

        res.status(500).json({
            message: "Unable to fetch parking locations."
        });
    }
});


// Add new parking location
app.post("/api/admin/parking", async (req, res) => {
    try {
        const {
            location,
            total_slots,
            available_slots,
            price_per_hour
        } = req.body;

        if (
            !location ||
            !Number.isInteger(Number(total_slots)) ||
            !Number.isInteger(Number(available_slots)) ||
            Number(total_slots) < 1 ||
            Number(available_slots) < 0 ||
            Number(available_slots) > Number(total_slots) ||
            !Number.isFinite(Number(price_per_hour)) ||
            Number(price_per_hour) < 0
        ) {
            return res.status(400).json({
                message: "Please enter valid parking details."
            });
        }

        const [result] = await db.query(
            `INSERT INTO parking
            (location, total_slots, available_slots, price_per_hour)
            VALUES (?, ?, ?, ?)`,
            [
                location.trim(),
                Number(total_slots),
                Number(available_slots),
                Number(price_per_hour)
            ]
        );

        res.status(201).json({
            message: "Parking location added successfully!",
            parkingId: result.insertId
        });

    } catch (error) {
        console.error("Add parking error:", error);

        res.status(500).json({
            message: "Unable to add parking location."
        });
    }
});



// Update parking location
app.put("/api/admin/parking/:id", async (req, res) => {
    try {
        const parkingId = Number(req.params.id);

        const {
            location,
            total_slots,
            available_slots,
            price_per_hour
        } = req.body;

        if (
            !Number.isInteger(parkingId) ||
            parkingId < 1 ||
            typeof location !== "string" ||
            !location.trim() ||
            !Number.isInteger(Number(total_slots)) ||
            !Number.isInteger(Number(available_slots)) ||
            Number(total_slots) < 1 ||
            Number(available_slots) < 0 ||
            Number(available_slots) > Number(total_slots) ||
            !Number.isFinite(Number(price_per_hour)) ||
            Number(price_per_hour) < 0
        ) {
            return res.status(400).json({
                message: "Please enter valid parking details."
            });
        }

        const [result] = await db.query(
            `UPDATE parking
             SET location = ?,
                 total_slots = ?,
                 available_slots = ?,
                 price_per_hour = ?
             WHERE id = ?`,
            [
                location.trim(),
                Number(total_slots),
                Number(available_slots),
                Number(price_per_hour),
                parkingId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Parking location not found."
            });
        }

        res.json({
            message: "Parking location updated successfully!"
        });

    } catch (error) {
        console.error("Update parking error:", error);

        res.status(500).json({
            message: "Unable to update parking location."
        });
    }
});


// Delete parking location
app.delete("/api/admin/parking/:id", async (req, res) => {
    try {
        const parkingId = Number(req.params.id);

        if (!Number.isInteger(parkingId) || parkingId < 1) {
            return res.status(400).json({
                message: "Invalid parking ID."
            });
        }

        // Check whether bookings exist
        const [bookings] = await db.query(
            "SELECT id FROM bookings WHERE parking_id = ? LIMIT 1",
            [parkingId]
        );

        if (bookings.length > 0) {
            return res.status(409).json({
                message: "Cannot delete this location because bookings exist."
            });
        }

        // Delete parking location
        const [result] = await db.query(
            "DELETE FROM parking WHERE id = ?",
            [parkingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Parking location not found."
            });
        }

        res.json({
            message: "Parking location deleted successfully!"
        });

    } catch (error) {
        console.error("Delete parking error:", error);

        res.status(500).json({
            message: "Unable to delete parking location."
        });
    }
});



 // Admin: Get all bookings
app.get("/api/admin/bookings", async (req, res) => {
    try {
        const [bookings] = await db.execute(
            `SELECT
                b.id AS booking_id,
                b.customer_name,
                b.slots_booked,
                b.booking_date,
                b.status,
                p.location,
                p.price_per_hour,
                u.email AS customer_email
            FROM bookings b
            JOIN parking p ON b.parking_id = p.id
            LEFT JOIN users u ON b.user_id = u.id
            ORDER BY b.booking_date DESC`
        );

        res.json(bookings);

    } catch (error) {
        console.error("Admin bookings error:", error);

        res.status(500).json({
            message: "Unable to fetch all bookings."
        });
    }
});


// Admin: Get all registered users
app.get("/api/admin/users", async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT id, name, email, created_at
             FROM users
             ORDER BY created_at DESC`
        );

        res.json(users);

    } catch (error) {
        console.error("Admin users error:", error);

        res.status(500).json({
            message: "Unable to fetch registered users."
        });
    }
});





// Start server
async function startServer() {
    try {
        const connection = await db.getConnection();

        console.log("MySQL Connected Successfully!");

        connection.release();

        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("MySQL connection failed:", error.message);
    }
}

startServer();
