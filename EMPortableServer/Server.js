const express = require('express');
const path = require('path');
const WebSocket = require('ws');

const app = express();

let TemperatureValue = 50, HumidityValue = 0, PressureValue = 0, PM1Value = 0, PM25Value = 0, PM10Value = 0, Time = "";
let ipESP32CAM = "";
const {
  getAllVersions,
  getDataFirmware,
  getRealTimeData,
  saveRealTimeData
} = require("./models/mongodb");
const { Console } = require('console');

app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'pages/index.html'));
});

app.use(express.static('public'));

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);

      if (data.type === 'register') {
        ws.clientType = data.clientType;
        clients.set(ws, ws.clientType);
        console.log(`Client registered as: ${ws.clientType}`);
        return;
      }

      if (ws.clientType === 'frontend') {
        // Xử lý tin nhắn từ Frontend
        switch (data.type) {
          case 'firmware-versions':
            try {
              const versions = await getAllVersions();
              ws.send(JSON.stringify({ type: 'firmware-versions', success: true, versions }));
            } catch (error) {
              console.error('Error fetching firmware versions:', error);
              ws.send(JSON.stringify({ type: 'firmware-versions', success: false, message: 'Error fetching firmware versions' }));
            }
            break;

          case 'ota':
            console.log("OTA event received. Version:", data.version);

            (async () => {
              try {
                const data_Firmware = await getDataFirmware(data.version);
                const lines = data_Firmware.trim()
                  .split('\n')
                  .map(line => line.trim())
                  .filter(line => line !== '');

                console.log("Total lines:", lines.length);

                for (let index = 0; index < lines.length; index++) {
                  const line = lines[index];
                  const Percent = parseFloat((((index + 1) / lines.length) * 100).toFixed(2));

                  const message = {
                    type: 'ota',
                    index,
                    Percent,
                    line
                  };

                  // Gửi tới ESP32
                  clients.forEach((clientType, client) => {
                    if (client.readyState === WebSocket.OPEN && clientType === 'esp32') {
                      client.send(JSON.stringify(message));
                    }
                  });

                  // Gửi tới frontend
                  clients.forEach((clientType, client) => {
                    if (client.readyState === WebSocket.OPEN && clientType === 'frontend') {
                      client.send(JSON.stringify(message));
                    }
                  });

                  // ⏱ Chờ 50ms hoặc điều chỉnh tùy tốc độ OTA thực tế
                  await new Promise(res => setTimeout(res, 40));
                }
                const junkMessage = {
                  type: 'junk'
                };
                clients.forEach((clientType, client) => {
                  if (client.readyState === WebSocket.OPEN && clientType === 'esp32') {
                    client.send(JSON.stringify(junkMessage));
                  }
                });

              } catch (error) {
                console.error("OTA send error:", error);
              }
            })();

            break;

          case 'sync-request':
            // Trả về trạng thái hiện tại từ Backend tới Frontend
            ws.send(JSON.stringify({
              type: 'status-all',
              data: {
                Temperature: Number(TemperatureValue),
                Humidity: Number(HumidityValue),
                Pressure: Number(PressureValue),
                PM1: Number(PM1Value),
                PM25: Number(PM25Value),
                PM10: Number(PM10Value),
                ipESP32CAM: ipESP32CAM
              }
            }));
            console.log('📡 Sent current status to Frontend for sync-request');
            break;

          case 'get-real-time-data-hourly':
            const realHourlyData = await getRealTimeData();
            ws.send(JSON.stringify({ type: 'get-real-time-data-hourly', success: true, realHourlyData }));
            break;

          case 'get-real-time-data-daily':
            const realDailyData = await getRealTimeData();
            ws.send(JSON.stringify({ type: 'get-real-time-data-daily', success: true, realDailyData }));
            break;

          default:
            console.warn('Unknown Frontend message type:', data.type);
        }
      } else if (ws.clientType === 'esp32') {

        switch (data.type) {
          case 'DataFromESP32':
            Time = data.Time;
            TemperatureValue = Number(parseFloat(data.Temperature || TemperatureValue));
            HumidityValue = Number(parseFloat(data.Humidity || HumidityValue));
            PressureValue = Number(parseFloat(data.Pressure || PressureValue));
            PM1Value = Number(parseFloat(data.PM1 || PM1Value));
            PM25Value = Number(parseFloat(data.PM25 || PM25Value));
            PM10Value = Number(parseFloat(data.PM10 || PM10Value));

            const fullStatus = {
              type: "status-all",
              data: {
                Temperature: Number(TemperatureValue),
                Humidity: Number(HumidityValue),
                Pressure: Number(PressureValue),
                PM1: Number(PM1Value),
                PM25: Number(PM25Value),
                PM10: Number(PM10Value)
              }
            };

            // Gửi tới tất cả Frontend
            clients.forEach((clientType, client) => {
              if (client.readyState === WebSocket.OPEN && clientType === 'frontend') {
                client.send(JSON.stringify(fullStatus));
              }
            });
            console.log(`[ESP32] Updated status: ${JSON.stringify(fullStatus.data, null, 2)}`);
            break;
        }
        const DataRealTime = {
          ID: "Data",
          Time: Time,
          Temperature: TemperatureValue,
          Humidity: HumidityValue,
          Pressure: PressureValue,
          PM1: PM1Value,
          PM25: PM25Value,
          PM10: PM10Value
        };
        saveRealTimeData(JSON.stringify(DataRealTime));
      } else if (ws.clientType === 'esp32cam') {

        switch (data.type) {
          case 'esp32cam-ip':
            const ipData = {
              type: "esp32cam-ip",
              data: data.ip
            };
            ipESP32CAM = data.ip;
            break;

          default:
            console.warn('Unknown ESP32CAM message type:', data.type);
        }

      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log('WebSocket server is running on ws://localhost:8080');