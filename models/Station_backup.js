const mongoose = require("mongoose");

const stationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },

    address: {
      type: String,
      required: true,
    },

    chargingPower: {
      type: Number,
      required: true,
    },

    pricePerKwh: {
      type: Number,
      required: true,
    },

    totalSlots: {
      type: Number,
      required: true,
    },

    availableSlots: {
      type: Number,
      required: true,
    },

    // ------------------------------------------
    // Physical charging slot states
    // ------------------------------------------

    slot1Occupied: {
      type: Boolean,
      default: false,
    },

    slot2Occupied: {
      type: Boolean,
      default: false,
    },

    // ------------------------------------------
    // Real-time simulation fields
    // ------------------------------------------

    status: {
      type: String,
      enum: ["Available", "Busy", "Offline"],
      default: "Available",
    },

    batteryPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    energyConsumed: {
      type: Number,
      default: 0,
    },

    estimatedCompletionTime: {
      type: Number,
      default: 0,
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Station", stationSchema);
