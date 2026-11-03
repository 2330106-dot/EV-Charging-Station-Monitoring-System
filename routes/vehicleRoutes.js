const express = require("express");

const {
  addVehicle,
  getMyVehicles,
} = require("../controllers/vehicleController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

/*
=========================================================
ADD A VEHICLE
=========================================================

POST /api/vehicles

Authentication required.
*/

router.post("/", protect, addVehicle);

/*
=========================================================
GET THE LOGGED-IN USER'S VEHICLES
=========================================================

GET /api/vehicles/my

Authentication required.
*/

router.get("/my", protect, getMyVehicles);

module.exports = router;
