const Station = require("../models/Station");

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

// ------------------------------------------
// Update physical charging slot states
// ------------------------------------------

const updateSlotStates = async (req, res) => {
  try {
    const { slot1Occupied, slot2Occupied } = req.body;

    // Check that both values are boolean
    if (
      typeof slot1Occupied !== "boolean" ||
      typeof slot2Occupied !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "slot1Occupied and slot2Occupied must be boolean values",
      });
    }

    // Get the first charging station
    const station = await Station.findOne();

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    // Save physical slot states
    station.slot1Occupied = slot1Occupied;
    station.slot2Occupied = slot2Occupied;

    // Calculate occupied slots
    const occupiedSlots = (slot1Occupied ? 1 : 0) + (slot2Occupied ? 1 : 0);

    // Calculate available slots
    station.availableSlots = station.totalSlots - occupiedSlots;

    // Update station status
    if (occupiedSlots > 0) {
      station.status = "Busy";
    } else {
      station.status = "Available";
    }

    // Update timestamp
    station.lastUpdated = new Date();

    await station.save();

    res.status(200).json({
      success: true,
      message: "Slot states updated successfully",
      station: {
        slot1Occupied: station.slot1Occupied,
        slot2Occupied: station.slot2Occupied,
        occupiedSlots: occupiedSlots,
        availableSlots: station.availableSlots,
        status: station.status,
      },
    });
  } catch (error) {
    res.status(500).json({
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
