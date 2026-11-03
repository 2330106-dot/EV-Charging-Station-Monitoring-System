const Station = require("../models/Station");
const { promoteNextQueuedUser } = require("./reservationController");

// Create a new charging station
const createStation = async (req, res) => {
  try {
    const station = await Station.create(req.body);

    res.status(201).json({
      success: true,
      message: "Charging station created successfully",
      station,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create charging station",
      error: error.message,
    });
  }
};

// Get all charging stations
const getStations = async (req, res) => {
  try {
    const stations = await Station.find();

    res.status(200).json({
      success: true,
      count: stations.length,
      stations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch charging stations",
      error: error.message,
    });
  }
};

// Get a single charging station by ID
const getStationById = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    res.status(200).json({
      success: true,
      station,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch charging station",
      error: error.message,
    });
  }
};

// Update physical charging slot states
const updateSlotStates = async (req, res) => {
  try {
    const { slot1Occupied, slot2Occupied, slot3Occupied, slot4Occupied } =
      req.body;

    // Validate all four slot states
    if (
      typeof slot1Occupied !== "boolean" ||
      typeof slot2Occupied !== "boolean" ||
      typeof slot3Occupied !== "boolean" ||
      typeof slot4Occupied !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "slot1Occupied, slot2Occupied, slot3Occupied and slot4Occupied must all be boolean values",
      });
    }

    // Get the charging station
    const station = await Station.findOne();

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    // Save previous physical slot states
    const previousSlot1Occupied = station.slot1Occupied;
    const previousSlot2Occupied = station.slot2Occupied;
    const previousSlot3Occupied = station.slot3Occupied;
    const previousSlot4Occupied = station.slot4Occupied;

    // Detect occupied -> available transitions
    const slot1BecameAvailable =
      previousSlot1Occupied === true && slot1Occupied === false;

    const slot2BecameAvailable =
      previousSlot2Occupied === true && slot2Occupied === false;

    const slot3BecameAvailable =
      previousSlot3Occupied === true && slot3Occupied === false;

    const slot4BecameAvailable =
      previousSlot4Occupied === true && slot4Occupied === false;

    // Update physical slot states
    station.slot1Occupied = slot1Occupied;
    station.slot2Occupied = slot2Occupied;
    station.slot3Occupied = slot3Occupied;
    station.slot4Occupied = slot4Occupied;

    // Calculate occupied slots
    const occupiedSlots =
      (slot1Occupied ? 1 : 0) +
      (slot2Occupied ? 1 : 0) +
      (slot3Occupied ? 1 : 0) +
      (slot4Occupied ? 1 : 0);

    // Physical station has 4 slots
    station.totalSlots = 4;

    // Calculate available slots
    station.availableSlots = 4 - occupiedSlots;

    // Update station status
    if (occupiedSlots > 0) {
      station.status = "Busy";
    } else {
      station.status = "Available";
    }

    // Update timestamp
    station.lastUpdated = new Date();

    // Save physical station state
    await station.save();

    // Automatically promote waiting users into currently available slots.
    const promotedReservations = [];

    const availableSlotsToCheck = [
      { slotNumber: 1, occupied: station.slot1Occupied },
      { slotNumber: 2, occupied: station.slot2Occupied },
      { slotNumber: 3, occupied: station.slot3Occupied },
      { slotNumber: 4, occupied: station.slot4Occupied },
    ];

    for (const slot of availableSlotsToCheck) {
      // Skip slots that the ESP32 reports as physically occupied.
      if (slot.occupied) continue;

      console.log(`Checking queue for available slot ${slot.slotNumber}...`);

      const promotedReservation = await promoteNextQueuedUser(
        station._id.toString(),
        slot.slotNumber,
      );

      if (promotedReservation) {
        promotedReservations.push(promotedReservation);

        console.log(
          `Queue reservation ${promotedReservation._id} promoted to slot ${slot.slotNumber}.`,
        );
      }
    }

    // Send response
    return res.status(200).json({
      success: true,
      message: "Four slot states updated successfully",

      station: {
        stationId: station._id.toString(),
        totalSlots: station.totalSlots,
        slot1Occupied: station.slot1Occupied,
        slot2Occupied: station.slot2Occupied,
        slot3Occupied: station.slot3Occupied,
        slot4Occupied: station.slot4Occupied,
        occupiedSlots: occupiedSlots,
        availableSlots: station.availableSlots,
        status: station.status,
      },

      queuePromotion: {
        promotedCount: promotedReservations.length,
        promotedReservations: promotedReservations,
      },
    });
  } catch (error) {
    console.error("Update slot states error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update slot states",
      error: error.message,
    });
  }
};

module.exports = {
  createStation,
  getStations,
  getStationById,
  updateSlotStates,
};
