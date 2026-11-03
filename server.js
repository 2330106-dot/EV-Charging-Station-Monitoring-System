const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const stationRoutes = require("./routes/stationRoutes");
const simulateStationData = require("./simulation/stationSimulator");
const authRoutes = require("./routes/authRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const mlRoutes = require("./routes/mlRoutes");

const {
  expireUnclaimedReservations,
  activateScheduledReservations,
} = require("./controllers/reservationController");

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// ============================================================
// STATION API ROUTES
// ============================================================

app.use("/api/stations", stationRoutes);

// ============================================================
// AUTHENTICATION API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

// ============================================================
// VEHICLE API ROUTES
// ============================================================

app.use("/api/vehicles", vehicleRoutes);

// ============================================================
// RESERVATION API ROUTES
// ============================================================

app.use("/api/reservations", reservationRoutes);

// ============================================================
// MACHINE LEARNING API ROUTES
// ============================================================

app.use("/api/ml", mlRoutes);

// ============================================================
// HOME ROUTE
// ============================================================

app.get("/", (req, res) => {
  res.send("EV Charging Station Monitoring System Backend is Running...");
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on Port ${PORT}`);

  // Update station simulation every 10 seconds.
  setInterval(() => {
    Promise.resolve(simulateStationData()).catch((error) => {
      console.error("Station simulation error:", error);
    });
  }, 10000);

  // Activate scheduled reservations whose start time has arrived.
  // Their 5-minute check-in period begins when they are activated.
  setInterval(() => {
    activateScheduledReservations();
  }, 10000);

  // Expire reservations that missed their 5-minute check-in deadline.
  setInterval(() => {
    expireUnclaimedReservations();
  }, 10000);

  console.log("Station simulation enabled (every 10 seconds).");
  console.log("Scheduled reservation activation enabled (every 10 seconds).");
  console.log("Reservation expiry checker enabled (every 10 seconds).");
  console.log("ML prediction route enabled at /api/ml/predict-wait");
});
