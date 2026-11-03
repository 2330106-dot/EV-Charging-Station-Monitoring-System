# Real-Time EV Charging Station Monitoring System

A software-based Electric Vehicle (EV) Charging Station Monitoring System designed to help users view charging-slot availability and access charging-related information through a mobile application and backend services.

## Project Overview

The project combines mobile application development, backend APIs, database integration, and ESP32-based hardware communication to demonstrate EV charging-slot monitoring.

## Key Features

- Charging-slot occupancy monitoring using an ESP32 and switch-based inputs.
- Bluetooth Low Energy (BLE) communication for sharing slot status.
- Flutter mobile application for displaying charging-related information.
- Backend APIs for handling application data and related requests.
- Estimated waiting-time prediction using a machine-learning service trained on synthetic demonstration data.

## Technologies Used

- **Mobile application:** Flutter and Dart
- **Hardware:** ESP32 and Arduino IDE
- **Communication:** Bluetooth Low Energy (BLE)
- **Backend:** Node.js and Express.js
- **Database:** MongoDB
- **Machine learning API:** Python, FastAPI, and scikit-learn
- **Development tools:** Visual Studio Code, Postman, and Git/GitHub

## System Overview

1. ESP32 reads the states of four switch-based charging-slot inputs.
2. The ESP32 publishes slot occupancy information through BLE.
3. The mobile application displays charging-related information.
4. Backend services handle supported API requests.
5. The machine-learning service provides estimated waiting-time predictions based on synthetic demonstration data.

## Project Status

This project is an academic prototype. Hardware-based slot occupancy is represented using switches, and waiting-time prediction uses synthetic training data. These features should not be interpreted as certified charger monitoring or a validated real-world prediction system.

## Future Improvements

- Integrate actual charging-station telemetry.
- Improve prediction quality using real-world data.
- Enhance the user interface and monitoring capabilities.
- Strengthen API security and testing.

## Academic Project

Developed as part of an undergraduate engineering major project.

## Disclaimer

This prototype is intended for educational and demonstration purposes. It is not a certified EV charging control or safety system.
