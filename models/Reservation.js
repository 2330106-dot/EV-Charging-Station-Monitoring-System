const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    stationId: {
      type: String,
      required: true,
      default: "STATION_001",
    },

    slotNumber: {
      type: Number,
      min: 1,
      max: 4,
      default: null,
    },

    // Scheduled reservation information
    scheduledStartTime: {
      type: Date,
      default: null,
    },

    scheduledEndTime: {
      type: Date,
      default: null,
    },

    // Distinguishes scheduled bookings from immediate reservations.
    isScheduled: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        "WAITING",
        "RESERVED",
        "CHECKED_IN",
        "CHARGING",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "RESERVED",
    },

    // Queue information
    queuePosition: {
      type: Number,
      default: null,
    },

    // Current queue timestamp; existing behavior can be preserved.
    queuedAt: {
      type: Date,
      default: null,
    },

    // Permanent timestamp recording when the user originally joined the queue.
    queueJoinedAt: {
      type: Date,
      default: null,
    },

    // Actual queue waiting time in minutes, calculated during promotion.
    queueWaitMinutes: {
      type: Number,
      min: 0,
      default: null,
    },

    // Timestamp when an immediate reservation is created or
    // when a scheduled reservation becomes active.
    reservedAt: {
      type: Date,
      default: null,
    },

    checkInTime: {
      type: Date,
      default: null,
    },

    chargingStartTime: {
      type: Date,
      default: null,
    },

    chargingEndTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Preserve the existing model name.
module.exports = mongoose.model("Reservation", reservationSchema);
