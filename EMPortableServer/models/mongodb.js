const mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:27017/EnvironmentMonitor");

const FirmwareSchema = new mongoose.Schema({
  ID: String,
  Version: Number,
  DataHex: String
});

const FirmwareModel = mongoose.model("Firmware", FirmwareSchema, "FirmwareOTA");

async function getAllVersions() {
  const docs = await FirmwareModel.find({}, "Version");
  return docs.map(d => d.Version).sort((a, b) => a - b);
}

async function getDataFirmware(version) {
  try {
    const doc = await FirmwareModel.findOne({ Version: version }, "DataHex");

    if (!doc) {
      console.log(`Không tìm thấy version = ${version}`);
      return null;
    }

    return doc.DataHex;
  } catch (error) {
    console.error("Lỗi khi truy vấn DataHex:", error);
    throw error;
  }
}

const Real_Data = new mongoose.Schema({
  ID: String,
  Time: String,
  Temperature: Number,
  Humidity: Number,
  Pressure: Number,
  PM1: Number,
  PM25: Number,
  PM10: Number
});


const realTimeData = mongoose.model("Data", Real_Data, "RealTimeData");

async function saveRealTimeData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString); // ✅ chuyển chuỗi thành object

    // ✅ Cập nhật theo ID nếu đã có, hoặc tạo mới
    await realTimeData.create({
      ID: parsed.ID,
      Time: parsed.Time,
      Temperature: parsed.Temperature,
      Humidity: parsed.Humidity,
      Pressure: parsed.Pressure,
      PM1: parsed.PM1,
      PM25: parsed.PM25,
      PM10: parsed.PM10
    });

    console.log("✅ Dữ liệu đã được cập nhật vào database:", parsed);
  } catch (error) {
    console.error("❌ JSON không hợp lệ hoặc lỗi lưu:", error.message);
  }
}

async function getRealTimeData() {
  try {
    const result = await realTimeData.find({ ID: "Data" });
    return result;
  } catch (error) {
    console.error('Error getting real-time data:', error.message);
    throw error;
  }
}

module.exports = { getAllVersions, saveRealTimeData, getDataFirmware, getRealTimeData }