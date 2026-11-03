const Reservation = require("../models/Reservation");
const Station = require("../models/Station");

const CHECK_IN_GRACE_PERIOD_MS = 5 * 60 * 1000;

const getPhysicalStation = async () => {
  return await Station.findOne();
};

// Check whether the physical slot is actually occupied.
const isPhysicalSlotOccupied = (station, slotNumber) => {
  if (!station) return true;

  const slotFields = {
    1: "slot1Occupied",
    2: "slot2Occupied",
    3: "slot3Occupied",
    4: "slot4Occupied",
  };

  const field = slotFields[slotNumber];

  if (!field) return true;

  return station[field] === true;
};

// CREATE RESERVATION
const createReservation = async (req, res) => {
  try {
    const { vehicleId, stationId, slotNumber } = req.body;

    if (
      !vehicleId ||
      !stationId ||
      !Number.isInteger(Number(slotNumber)) ||
      Number(slotNumber) < 1 ||
      Number(slotNumber) > 4
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid vehicle, station and slot are required",
      });
    }

    const selectedSlot = Number(slotNumber);
    const station = await getPhysicalStation();

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    if (isPhysicalSlotOccupied(station, selectedSlot)) {
      return res.status(409).json({
        success: false,
        message: "This physical charging slot is currently occupied",
      });
    }

    const existingReservation = await Reservation.findOne({
      stationId,
      slotNumber: selectedSlot,
      status: {
        $in: ["WAITING", "RESERVED", "CHECKED_IN", "CHARGING"],
      },
    });

    if (existingReservation) {
      return res.status(409).json({
        success: false,
        message: "This slot is already reserved",
      });
    }

    const reservation = await Reservation.create({
      user: req.user.userId,
      vehicle: vehicleId,
      stationId,
      slotNumber: selectedSlot,
      status: "RESERVED",
      reservedAt: new Date(),
      queuePosition: null,
      queuedAt: null,
    });

    const populatedReservation = await Reservation.findById(reservation._id)
      .populate("user", "name email phone")
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");

    return res.status(201).json({
      success: true,
      message: "Slot reserved successfully. Check in within 5 minutes.",
      reservation: populatedReservation,
      checkInDeadline: new Date(
        reservation.reservedAt.getTime() + CHECK_IN_GRACE_PERIOD_MS,
      ),
    });
  } catch (error) {
    console.error("Create reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating reservation",
    });
  }
};

// JOIN CHARGING QUEUE
const joinQueue = async (req, res) => {
  try {
    const { vehicleId, stationId } = req.body;

    if (!vehicleId || !stationId) {
      return res.status(400).json({
        success: false,
        message: "Vehicle and station are required",
      });
    }

    const existingUserReservation = await Reservation.findOne({
      user: req.user.userId,
      stationId,
      status: {
        $in: ["WAITING", "RESERVED", "CHECKED_IN", "CHARGING"],
      },
    });

    if (existingUserReservation) {
      return res.status(409).json({
        success: false,
        message:
          "You already have an active reservation or queue entry for this station",
      });
    }

    const station = await getPhysicalStation();

    if (!station) {
      return res.status(404).json({
        success: false,
        message: "Charging station not found",
      });
    }

    if (station.availableSlots > 0) {
      return res.status(400).json({
        success: false,
        message:
          "A physical charging slot is currently available. Please reserve an available slot.",
        availableSlots: station.availableSlots,
      });
    }

    const lastWaitingReservation = await Reservation.findOne({
      stationId,
      status: "WAITING",
    }).sort({
      queuePosition: -1,
    });

    const nextQueuePosition = lastWaitingReservation
      ? lastWaitingReservation.queuePosition + 1
      : 1;

    const reservation = await Reservation.create({
      user: req.user.userId,
      vehicle: vehicleId,
      stationId,
      slotNumber: null,
      status: "WAITING",
      queuePosition: nextQueuePosition,
      queuedAt: new Date(),
      reservedAt: null,
    });

    const populatedReservation = await Reservation.findById(reservation._id)
      .populate("user", "name email phone")
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");

    return res.status(201).json({
      success: true,
      message: "Joined charging queue successfully",
      queuePosition: nextQueuePosition,
      reservation: populatedReservation,
    });
  } catch (error) {
    console.error("Join queue error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while joining the queue",
    });
  }
};

// PROMOTE THE NEXT QUEUED USER
const promoteNextQueuedUser = async (stationId, slotNumber) => {
  try {
    const station = await getPhysicalStation();

    if (!station || isPhysicalSlotOccupied(station, slotNumber)) {
      return null;
    }

    // Do not assign a slot that already has an active reservation.
    const existingReservation = await Reservation.findOne({
      stationId,
      slotNumber,
      status: {
        $in: ["RESERVED", "CHECKED_IN", "CHARGING"],
      },
    });

    if (existingReservation) {
      return null;
    }

    const nextReservation = await Reservation.findOne({
      stationId,
      status: "WAITING",
    }).sort({
      queuePosition: 1,
      queuedAt: 1,
    });

    if (!nextReservation) {
      return null;
    }

    nextReservation.status = "RESERVED";
    nextReservation.slotNumber = slotNumber;
    nextReservation.queuePosition = null;
    nextReservation.queuedAt = null;
    nextReservation.reservedAt = new Date();

    await nextReservation.save();

    console.log(
      `Queue promotion: reservation ${nextReservation._id} assigned to slot ${slotNumber}`,
    );

    return nextReservation;
  } catch (error) {
    console.error("Queue promotion error:", error);
    return null;
  }
};

// EXPIRE A RESERVATION AND PROMOTE THE NEXT USER IF POSSIBLE
const expireReservation = async (reservation) => {
  const slotNumber = reservation.slotNumber;
  const stationId = reservation.stationId;

  reservation.status = "EXPIRED";
  await reservation.save();

  console.log(`Reservation ${reservation._id} expired. Slot: ${slotNumber}`);

  // Promotion is allowed only if the physical slot is available.
  if (slotNumber >= 1 && slotNumber <= 4) {
    await promoteNextQueuedUser(stationId, slotNumber);
  }
};

// PERIODIC CHECK FOR RESERVATIONS THAT MISSED CHECK-IN
const expireUnclaimedReservations = async () => {
  try {
    const deadline = new Date(Date.now() - CHECK_IN_GRACE_PERIOD_MS);

    const expiredReservations = await Reservation.find({
      status: "RESERVED",
      reservedAt: { $lte: deadline, $ne: null },
    }).sort({
      reservedAt: 1,
    });

    for (const reservation of expiredReservations) {
      // Re-check the status before changing it.
      const currentReservation = await Reservation.findOne({
        _id: reservation._id,
        status: "RESERVED",
        reservedAt: { $lte: deadline, $ne: null },
      });

      if (!currentReservation) continue;

      await expireReservation(currentReservation);
    }
  } catch (error) {
    console.error("Reservation expiry check error:", error);
  }
};

// CHECK IN
const checkInReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to check in for this reservation",
      });
    }

    if (reservation.status !== "RESERVED") {
      return res.status(400).json({
        success: false,
        message:
          "Reservation cannot be checked in because its current status is " +
          reservation.status,
      });
    }

    // Enforce the deadline even if the periodic job has not run yet.
    const now = Date.now();
    const reservedAt = reservation.reservedAt
      ? new Date(reservation.reservedAt).getTime()
      : null;

    if (
      reservedAt === null ||
      !Number.isFinite(reservedAt) ||
      now >= reservedAt + CHECK_IN_GRACE_PERIOD_MS
    ) {
      await expireReservation(reservation);

      return res.status(400).json({
        success: false,
        message:
          "The 5-minute check-in period has expired. Please make a new reservation or join the queue.",
        status: "EXPIRED",
      });
    }

    reservation.status = "CHECKED_IN";
    reservation.checkInTime = new Date();

    await reservation.save();

    const populatedReservation = await Reservation.findById(reservation._id)
      .populate("user", "name email phone")
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");

    return res.json({
      success: true,
      message: "Check-in successful",
      reservation: populatedReservation,
    });
  } catch (error) {
    console.error("Check-in reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking in",
    });
  }
};

// START CHARGING
const startChargingReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to start charging for this reservation",
      });
    }

    if (reservation.status !== "CHECKED_IN") {
      return res.status(400).json({
        success: false,
        message:
          "Charging cannot be started because the current reservation status is " +
          reservation.status,
      });
    }

    reservation.status = "CHARGING";
    reservation.chargingStartTime = new Date();

    await reservation.save();

    const populatedReservation = await Reservation.findById(reservation._id)
      .populate("user", "name email phone")
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");

    return res.json({
      success: true,
      message: "Charging started successfully",
      reservation: populatedReservation,
    });
  } catch (error) {
    console.error("Start charging reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while starting charging",
    });
  }
};

// COMPLETE CHARGING
const completeChargingReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found",
      });
    }

    if (reservation.user.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to complete charging for this reservation",
      });
    }

    if (reservation.status !== "CHARGING") {
      return res.status(400).json({
        success: false,
        message:
          "Charging cannot be completed because the current reservation status is " +
          reservation.status,
      });
    }

    const freedSlotNumber = reservation.slotNumber;
    const stationId = reservation.stationId;

    reservation.status = "COMPLETED";
    reservation.chargingEndTime = new Date();

    await reservation.save();

    // The promotion helper verifies physical availability first.
    const promotedReservation = await promoteNextQueuedUser(
      stationId,
      freedSlotNumber,
    );

    const populatedReservation = await Reservation.findById(reservation._id)
      .populate("user", "name email phone")
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");

    let populatedPromotedReservation = null;

    if (promotedReservation) {
      populatedPromotedReservation = await Reservation.findById(
        promotedReservation._id,
      )
        .populate("user", "name email phone")
        .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity");
    }

    return res.json({
      success: true,
      message: "Charging completed successfully",
      reservation: populatedReservation,
      promotedReservation: populatedPromotedReservation,
    });
  } catch (error) {
    console.error("Complete charging reservation error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while completing charging",
    });
  }
};

// GET MY RESERVATIONS
const getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({
      user: req.user.userId,
    })
      .populate("vehicle", "vehicleNumber vehicleModel batteryCapacity")
      .sort({
        createdAt: -1,
      });

    return res.json({
      success: true,
      reservations,
    });
  } catch (error) {
    console.error("Get reservations error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching reservations",
    });
  }
};

module.exports = {
  createReservation,
  joinQueue,
  promoteNextQueuedUser,
  expireUnclaimedReservations,
  checkInReservation,
  startChargingReservation,
  completeChargingReservation,
  getMyReservations,
};
