import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// Fix Leaflet default marker icons when using Vite/React
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function App() {
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch station data from backend
  const fetchStation = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/stations");

      if (!response.ok) {
        throw new Error("Failed to fetch station data");
      }

      const data = await response.json();

      if (data.success && data.stations.length > 0) {
        setStation(data.stations[0]);
        setError("");
      } else {
        setError("No charging station found.");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + automatic refresh every 5 seconds
  useEffect(() => {
    fetchStation();

    const interval = setInterval(fetchStation, 5000);

    return () => clearInterval(interval);
  }, []);

  // Loading screen
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-box">
          <div className="loading-icon">⚡</div>

          <h1>EV Charging Station Monitoring System</h1>

          <p>Loading live station data...</p>

          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Error screen
  if (error) {
    return (
      <div className="error-screen">
        <div className="error-box">
          <div className="error-icon">⚠️</div>

          <h1>EV Charging Station Monitoring System</h1>

          <p>{error}</p>

          <button onClick={fetchStation}>Try Again</button>
        </div>
      </div>
    );
  }

  // Station values
  const battery = station.batteryPercentage ?? 0;
  const availableSlots = station.availableSlots ?? 0;
  const totalSlots = station.totalSlots ?? 0;
  const chargingPower = station.chargingPower ?? 0;
  const energyConsumed = station.energyConsumed ?? 0;
  const completionTime = station.estimatedCompletionTime ?? 0;
  const pricePerKwh = station.pricePerKwh ?? 0;

  // Status class
  const getStatusClass = () => {
    if (station.status === "Busy") {
      return "status-busy";
    }

    if (station.status === "Offline") {
      return "status-offline";
    }

    return "status-available";
  };

  // Status icon
  const getStatusIcon = () => {
    if (station.status === "Busy") {
      return "🟡";
    }

    if (station.status === "Offline") {
      return "🔴";
    }

    return "🟢";
  };

  // Status description
  const getStatusDescription = () => {
    if (station.status === "Busy") {
      return "Vehicles are currently charging";
    }

    if (station.status === "Offline") {
      return "Station is temporarily unavailable";
    }

    return "Charging slots are currently available";
  };

  return (
    <div className="dashboard">
      {/* ================= HEADER ================= */}

      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-title">
            <div className="header-icon">⚡</div>

            <div>
              <h1>EV Charging Station Monitoring System</h1>

              <p>Real-Time Charging Station Dashboard</p>
            </div>
          </div>

          <div className="header-right">
            <div className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </div>

            <div className="refresh-indicator">↻ Auto-refresh: 5s</div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}

      <main className="dashboard-content">
        {/* ================= STATION HEADER ================= */}

        <section className="station-header">
          <div className="station-information">
            <div className="station-icon">⚡</div>

            <div>
              <h2>{station.name}</h2>

              <p>📍 {station.address}</p>
            </div>
          </div>

          <div className="station-status-container">
            <div className={`station-status ${getStatusClass()}`}>
              <span className="status-icon">{getStatusIcon()}</span>

              {station.status || "Unknown"}
            </div>

            <span className="status-description">{getStatusDescription()}</span>
          </div>
        </section>

        {/* ================= STATISTICS ================= */}

        <section className="stats-grid">
          {/* Battery */}

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon battery-icon">🔋</div>

              <div>
                <h3>Battery</h3>

                <strong>{battery}%</strong>
              </div>
            </div>

            <div className="progress-container">
              <div
                className="progress-bar battery-progress"
                style={{
                  width: `${Math.min(Math.max(battery, 0), 100)}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Charging Power */}

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon power-icon">⚡</div>

              <div>
                <h3>Charging Power</h3>

                <strong>{chargingPower} kW</strong>
              </div>
            </div>

            <span className="stat-subtext">Current charging rate</span>
          </div>

          {/* Available Slots */}

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon slots-icon">🔌</div>

              <div>
                <h3>Available Slots</h3>

                <strong>
                  {availableSlots} / {totalSlots}
                </strong>
              </div>
            </div>

            <span className="stat-subtext">Charging slots available</span>
          </div>

          {/* Price */}

          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon price-icon">💰</div>

              <div>
                <h3>Price</h3>

                <strong>₹{pricePerKwh}/kWh</strong>
              </div>
            </div>

            <span className="stat-subtext">Charging tariff</span>
          </div>
        </section>

        {/* ================= INDIVIDUAL SLOT STATUS ================= */}

        <section className="slot-status-section">
          <div className="section-title">
            <div>
              <h2>🔌 Charging Slot Status</h2>

              <p>Live status of individual charging slots</p>
            </div>
          </div>

          <div className="slot-status-grid">
            {/* ================= SLOT 1 ================= */}

            <div
              className={`slot-card ${
                station.slot1Occupied ? "slot-occupied" : "slot-available"
              }`}
            >
              <div className="slot-card-icon">🔌</div>

              <div className="slot-card-content">
                <h3>Slot 1</h3>

                <strong>
                  {station.slot1Occupied ? "OCCUPIED" : "AVAILABLE"}
                </strong>

                <p>
                  {station.slot1Occupied
                    ? "Vehicle is currently charging"
                    : "Ready for charging"}
                </p>
              </div>

              <div className="slot-status-indicator">
                {station.slot1Occupied ? "🔴" : "🟢"}
              </div>
            </div>

            {/* ================= SLOT 2 ================= */}

            <div
              className={`slot-card ${
                station.slot2Occupied ? "slot-occupied" : "slot-available"
              }`}
            >
              <div className="slot-card-icon">🔌</div>

              <div className="slot-card-content">
                <h3>Slot 2</h3>

                <strong>
                  {station.slot2Occupied ? "OCCUPIED" : "AVAILABLE"}
                </strong>

                <p>
                  {station.slot2Occupied
                    ? "Vehicle is currently charging"
                    : "Ready for charging"}
                </p>
              </div>

              <div className="slot-status-indicator">
                {station.slot2Occupied ? "🔴" : "🟢"}
              </div>
            </div>

            {/* ================= SLOT 3 ================= */}

            <div
              className={`slot-card ${
                station.slot3Occupied ? "slot-occupied" : "slot-available"
              }`}
            >
              <div className="slot-card-icon">🔌</div>

              <div className="slot-card-content">
                <h3>Slot 3</h3>

                <strong>
                  {station.slot3Occupied ? "OCCUPIED" : "AVAILABLE"}
                </strong>

                <p>
                  {station.slot3Occupied
                    ? "Vehicle is currently charging"
                    : "Ready for charging"}
                </p>
              </div>

              <div className="slot-status-indicator">
                {station.slot3Occupied ? "🔴" : "🟢"}
              </div>
            </div>

            {/* ================= SLOT 4 ================= */}

            <div
              className={`slot-card ${
                station.slot4Occupied ? "slot-occupied" : "slot-available"
              }`}
            >
              <div className="slot-card-icon">🔌</div>

              <div className="slot-card-content">
                <h3>Slot 4</h3>

                <strong>
                  {station.slot4Occupied ? "OCCUPIED" : "AVAILABLE"}
                </strong>

                <p>
                  {station.slot4Occupied
                    ? "Vehicle is currently charging"
                    : "Ready for charging"}
                </p>
              </div>

              <div className="slot-status-indicator">
                {station.slot4Occupied ? "🔴" : "🟢"}
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECONDARY INFORMATION ================= */}

        <section className="secondary-grid">
          {/* Energy */}

          <div className="info-card">
            <div className="info-card-icon">⚡</div>

            <div>
              <h3>Energy Consumed</h3>

              <div className="large-value">
                {energyConsumed}

                <span> kWh</span>
              </div>

              <p>Energy used during charging</p>
            </div>
          </div>

          {/* Completion */}

          <div className="info-card">
            <div className="info-card-icon">⏱️</div>

            <div>
              <h3>Estimated Completion</h3>

              <div className="large-value">
                {completionTime}

                <span> min</span>
              </div>

              <p>Estimated remaining charging time</p>
            </div>
          </div>

          {/* Location */}

          <div className="info-card">
            <div className="info-card-icon">📍</div>

            <div>
              <h3>Station Location</h3>

              <p>Latitude: {station.location?.latitude}</p>

              <p>Longitude: {station.location?.longitude}</p>

              <p className="location-note">KIIT, Bhubaneswar</p>
            </div>
          </div>
        </section>

        {/* ================= MAP ================= */}

        <section className="map-section">
          <div className="section-title">
            <div>
              <h2>📍 Charging Station Location</h2>

              <p>Interactive OpenStreetMap</p>
            </div>

            <div className="map-status">🗺️ Map Active</div>
          </div>

          <div className="map-container">
            <MapContainer
              center={[station.location.latitude, station.location.longitude]}
              zoom={15}
              scrollWheelZoom={true}
              style={{
                height: "450px",
                width: "100%",
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <Marker
                position={[
                  station.location.latitude,
                  station.location.longitude,
                ]}
              >
                <Popup>
                  <div className="map-popup">
                    <div className="popup-title">
                      <span>⚡</span>

                      <h3>{station.name}</h3>
                    </div>

                    <p className="popup-address">{station.address}</p>

                    <hr />

                    <div className="popup-row">
                      <strong>Status</strong>

                      <span>{station.status}</span>
                    </div>

                    <div className="popup-row">
                      <strong>Battery</strong>

                      <span>{battery}%</span>
                    </div>

                    <div className="popup-row">
                      <strong>Charging Power</strong>

                      <span>{chargingPower} kW</span>
                    </div>

                    <div className="popup-row">
                      <strong>Available Slots</strong>

                      <span>
                        {availableSlots} / {totalSlots}
                      </span>
                    </div>

                    <div className="popup-row">
                      <strong>Price</strong>

                      <span>₹{pricePerKwh}/kWh</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </section>

        {/* ================= FOOTER ================= */}

        <footer className="dashboard-footer">
          <div>
            <strong>EV Charging Station Monitoring System</strong>

            <p>Real-time simulated charging station monitoring</p>
          </div>

          <div className="footer-right">
            <span>Backend: Connected</span>

            <span>
              Last updated:{" "}
              {station.lastUpdated
                ? new Date(station.lastUpdated).toLocaleString()
                : "N/A"}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
