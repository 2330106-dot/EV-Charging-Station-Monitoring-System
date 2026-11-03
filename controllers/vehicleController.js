const Vehicle = require("../models/Vehicle");

// ============================================================
// ADD VEHICLE
// ============================================================

const addVehicle = async (req, res) => {
  try {
    const { vehicleNumber, vehicleModel, batteryCapacity } = req.body;

    if (!vehicleNumber || !vehicleModel || batteryCapacity === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Vehicle number, vehicle model and battery capacity are required",
      });
    }

    const existingVehicle = await Vehicle.findOne({
      vehicleNumber: vehicleNumber.toUpperCase(),
    });

    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: "A vehicle with this number already exists",
      });
    }

    const vehicle = await Vehicle.create({
      user: req.user.userId,
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleModel,
      batteryCapacity,
    });

    res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      vehicle,
    });
  } catch (error) {
    console.error("Add vehicle error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add vehicle",
      error: error.message,
    });
  }
};

// ============================================================
// GET MY VEHICLES
// ============================================================

const getMyVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      user: req.user.userId,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error("Get vehicles error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get vehicles",
      error: error.message,
    });
  }
};

module.exports = {
  addVehicle,
  getMyVehicles,
};
