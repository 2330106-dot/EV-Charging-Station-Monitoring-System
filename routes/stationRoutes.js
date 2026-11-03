const express = require("express");

const {
  createStation,
  getStations,
  getStationById,
  updateSlotStates,
} = require("../controllers/stationController");

const router = express.Router();

/*
=========================================================
CREATE A CHARGING STATION
=========================================================

POST:
/api/stations

=========================================================
*/
router.post("/", createStation);

/*
=========================================================
GET ALL CHARGING STATIONS
=========================================================

GET:
/api/stations

=========================================================
*/
router.get("/", getStations);

/*
=========================================================
UPDATE PHYSICAL CHARGING SLOT STATES
=========================================================

PATCH:
/api/stations/slots

Used by Flutter after receiving BLE data
from the ESP32.

Example body:

{
  "slot1Occupied": true,
  "slot2Occupied": false,
  "slot3Occupied": false,
  "slot4Occupied": true
}

=========================================================
*/
router.patch("/slots", updateSlotStates);

/*
=========================================================
GET PHYSICAL CHARGING SLOT STATES
=========================================================

GET:
/api/stations/slots

Used to verify the current physical slot state
stored in MongoDB.

=========================================================
*/
router.get("/slots", async (req, res) => {
  try {
    const Station = require("../models/Station");

    // There is currently one physical charging station
    const station = await Station.findOne();

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    return res.status(200).json({
      success: true,

      // Application-level station identifier
      stationId: "STATION_001",

      stationName: station.name,

      totalSlots: station.totalSlots,

      availableSlots: station.availableSlots,

      slot1Occupied: station.slot1Occupied,
      slot2Occupied: station.slot2Occupied,
      slot3Occupied: station.slot3Occupied,
      slot4Occupied: station.slot4Occupied,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch charging station slot states",
      error: error.message,
    });
  }
});

/*
=========================================================
GET A SINGLE CHARGING STATION BY ID
=========================================================

GET:
/api/stations/:id

IMPORTANT:
This route must remain AFTER /slots.

=========================================================
*/
router.get("/:id", getStationById);

/*
=========================================================
EXPORT ROUTER
=========================================================
*/
module.exports = router;
