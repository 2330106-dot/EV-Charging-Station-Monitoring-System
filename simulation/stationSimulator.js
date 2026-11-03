const Station = require("../models/Station");
const {
  promoteNextQueuedUser,
} = require("../controllers/reservationController");

const simulateStationData = async () => {
  try {
    const stations = await Station.find();

    for (const station of stations) {
      // ------------------------------------------
      // PHYSICAL SLOT STATES
      // ------------------------------------------
      // Slot occupancy comes from the ESP32.
      // The simulator must NOT change these values.

      const slot1Occupied = station.slot1Occupied || false;
      const slot2Occupied = station.slot2Occupied || false;
      const slot3Occupied = station.slot3Occupied || false;
      const slot4Occupied = station.slot4Occupied || false;

      const occupiedSlots =
        (slot1Occupied ? 1 : 0) +
        (slot2Occupied ? 1 : 0) +
        (slot3Occupied ? 1 : 0) +
        (slot4Occupied ? 1 : 0);

      // ------------------------------------------
      // TOTAL SLOTS
      // ------------------------------------------
      // This physical prototype has 4 slots.

      station.totalSlots = 4;

      // ------------------------------------------
      // AVAILABLE SLOTS
      // ------------------------------------------

      station.availableSlots = 4 - occupiedSlots;

      // ------------------------------------------
      // STATION STATUS
      // ------------------------------------------

      if (occupiedSlots > 0) {
        station.status = "Busy";
      } else {
        station.status = "Available";
      }

      // ------------------------------------------
      // CHARGING SIMULATION
      // ------------------------------------------
      // Only simulate charging information when
      // at least one physical slot is occupied.

      if (occupiedSlots > 0) {
        // ------------------------------------------
        // Battery percentage
        // ------------------------------------------

        let batteryPercentage = station.batteryPercentage || 0;

        // Start a new charging session
        if (batteryPercentage <= 0 || batteryPercentage >= 100) {
          batteryPercentage = Math.floor(Math.random() * 10) + 5;
        }

        // Increase battery gradually
        else {
          batteryPercentage += Math.floor(Math.random() * 5) + 1;
        }

        // Maximum battery = 100%
        batteryPercentage = Math.min(batteryPercentage, 100);

        station.batteryPercentage = batteryPercentage;

        // ------------------------------------------
        // Charging power
        // ------------------------------------------

        const chargingPower = Math.floor(Math.random() * 41) + 20;

        station.chargingPower = chargingPower;

        // ------------------------------------------
        // Energy consumed
        // ------------------------------------------

        let energyConsumed = station.energyConsumed || 0;

        energyConsumed += Math.random() * 2 + 0.5;

        station.energyConsumed = Number(energyConsumed.toFixed(2));

        // ------------------------------------------
        // Estimated completion time
        // ------------------------------------------

        const remainingBattery = 100 - batteryPercentage;

        station.estimatedCompletionTime = Math.max(
          0,
          Math.ceil(remainingBattery / 3),
        );

        // ------------------------------------------
        // Charging completed
        // ------------------------------------------

        if (batteryPercentage >= 100) {
          station.batteryPercentage = 0;
          station.energyConsumed = 0;
          station.estimatedCompletionTime = 0;
          station.chargingPower = 0;

          // IMPORTANT:
          // We do NOT change slot occupancy here.
          // ESP32 remains the source of truth.
        }
      }

      // ------------------------------------------
      // NO VEHICLE OCCUPYING A SLOT
      // ------------------------------------------
      else {
        station.batteryPercentage = 0;
        station.chargingPower = 0;
        station.energyConsumed = 0;
        station.estimatedCompletionTime = 0;
      }

      // ------------------------------------------
      // UPDATE TIMESTAMP
      // ------------------------------------------

      station.lastUpdated = new Date();

      await station.save();
      // Check physically available slots for waiting reservations.
      // ESP32 remains the source of truth for slot occupancy.
      const availableSlotNumbers = [
        { slotNumber: 1, occupied: station.slot1Occupied },
        { slotNumber: 2, occupied: station.slot2Occupied },
        { slotNumber: 3, occupied: station.slot3Occupied },
        { slotNumber: 4, occupied: station.slot4Occupied },
      ];

      for (const slot of availableSlotNumbers) {
        if (slot.occupied) continue;

        console.log(
          `Checking queue for station ${station._id}, slot ${slot.slotNumber}...`,
        );

        const promotedReservation = await promoteNextQueuedUser(
          station._id.toString(),
          slot.slotNumber,
        );

        if (promotedReservation) {
          console.log(
            `Queue promotion successful: reservation ${promotedReservation._id}, slot ${slot.slotNumber}.`,
          );
        }
      }
    }

    console.log("Station simulation updated successfully");
  } catch (error) {
    console.error("Simulation Error:", error.message);
  }
};

module.exports = simulateStationData;
