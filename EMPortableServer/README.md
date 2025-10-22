# AquaDTB Dashboard

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-%3E%3D4.0-green?logo=mongodb)
![WebSocket](https://img.shields.io/badge/WebSocket-supported-blue)
![ESP32](https://img.shields.io/badge/ESP32-supported-blue)

---

**AquaDTB Dashboard** is a control and monitoring dashboard project for devices, displaying environmental sensor data collected from ESP32, with OTA firmware capability, device control, timer management, and real-time data monitoring.

The project includes:
- **Backend**: Node.js + Express + WebSocket + MongoDB
- **Frontend**: Pure HTML/CSS/JS, real-time via WebSocket, using UI libraries such as Highcharts, ProgressBar, Flatpickr...
- **Database**: MongoDB stores sensor data, firmware, timer schedules.

---

## 🚩 Key Features

- **Realtime Dashboard**:  
  - Displays temperature, pH, TDS, conductivity, and water level data sent from ESP32.
  - Plots charts directly with modes: real-time, hourly/daily average.
- **Device Control**:
  - Toggle Fan, Light, Heater, Pump, Filter, Feeder; switch between Auto/Manual, OTA.
  - Status updates and two-way synchronization between Dashboard ↔️ ESP32.
- **OTA Firmware**:  
  - Select and update firmware from the dashboard, send .hex files to ESP32 line by line, and show OTA progress.
- **Timer Management**:  
  - Set operating schedules for each device.
  - View, add, delete timers, and synchronize with ESP32.
- **ESP32-CAM Stream Support** (if available).
- **Store and retrieve historical data from MongoDB, compute averages/statistics by day, month.**

---

## 🏗 Project Structure

AquaDTB/
├── backend/
│ ├── server.js # Express + WebSocket server
│ └── models/
│ └── mongodb.js # MongoDB operations
├── public/
│ ├── index.js # Main frontend JS
│ ├── style.css # CSS
│ └── ... (icons, images)
├── pages/
│ └── index.html # Dashboard UI
└── README.md

- **server.js**: REST API and WebSocket, receives data from ESP32, sends data to frontend, manages multi-client connections.
- **mongodb.js**: Schema definition and CRUD operations for sensor data, firmware, and timers.
- **public/index.js**: WebSocket connection, DOM updates, UI controls, chart logic.
- **index.html**: Dashboard interface.

---

## ⚡️ Quick Setup & Run

### 1. System Requirements

- Node.js >= 18
- MongoDB >= 4.0 (local or cloud)
- ESP32 (running firmware that sends data via WebSocket or HTTP)
- Modern browser (Edge/Chrome/Firefox...)

### 2. Clone and Install

```bash
git clone https://github.com/yourusername/AquaDTB.git
cd AquaDTB

# Install backend dependencies
npm install

# Start MongoDB (default localhost:27017)
# Or configure URI in ./models/mongodb.js if using cloud

# Start backend server
node backend/server.js
# Default port 3000 (HTTP), port 8080 (WebSocket)

# Access dashboard at:
http://localhost:3000/
If you want to build a separate frontend or use a framework, you can reorganize the /public folder.

🖥 Basic Configuration
MongoDB:

Database: AquaDTB

Collections:

FirmwareOTA: stores firmware versions and content

RealTimeData: stores sensor data, timers

WebSocket Port: ws://localhost:8080

HTTP Port: http://localhost:3000

🧩 API / WebSocket Communication
Client registration:
Send { type: 'register', clientType: 'frontend' | 'esp32' | 'esp32cam' }
→ Used to distinguish client types and handle the correct data stream.

Main message types:

Message Type	From	To	Description / Main Payload
device-status	FE	ESP32	Device control (Fan, Light, ...)
status-all	ESP32	FE	Send current status (sensor + device)
firmware-versions	FE	BE	Get firmware version list from DB
ota	FE	ESP32	Send firmware line by line to ESP32
Timer-device	FE	ESP32, FE	Save new timer and broadcast update
get-timers	FE	BE	Get timer list
delete-timer	FE	BE, ESP32	Delete timer
get-real-time-data-*	FE	BE	Get sensor data (hourly/daily)
reset-all	FE	ESP32, FE	Reset all statuses

All communication is real-time, fully synchronized in both directions between Dashboard, ESP32, and database.

📊 Dashboard Interface
Intuitive display of device status.

Real-time or historical charts for temperature, pH, TDS, water level, conductivity (view by hour/day/month).

Device control switches/toggles, OTA, auto/manual.

Timer management for each device.

OTA modal: select version, upload, view update progress.

(You may add dashboard screenshots here)

🚚 Further Development
Easily extendable for more sensors/devices.

Supports multiple frontend clients concurrently.

Add authentication (token, password).

Deploy on cloud, or open port for remote access.

Integrate with other services (Telegram, Zalo, Email notification...).

📑 Developer Notes
The database model stores three main types: sensor data, firmware, and timers.

All data is synchronized continuously, each ESP32 data packet is saved to DB.

Manages device status in real-time, supports both auto/manual mode.

Code is optimized for efficient data flow with multiple clients (FE, ESP32, ESP32CAM) connecting via WebSocket.

📄 License
Open source, free for educational and research purposes.

👨‍💻 Contact & Contribution
For suggestions, bug reports, or new feature ideas, please create an Issue or Pull Request.

(You may add contact info, email, or group information here.)

---

**You can copy and use this file directly!**  
If you want the project name or any wording adjusted, just tell me.