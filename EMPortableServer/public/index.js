// Constants and State Variables
const API_KEY = 'ec224bde787c4001b0281007251802';
const LOCATION = 'Hanoi';
const socket = new WebSocket('ws://localhost:8080');
let TemperatureValue = 50, HumidityValue = 0, PressureValue = 0, PM1Value = 0, PM25Value = 0, PM10Value = 0;
let SecondlyChartStatus = false;
let HourlyChartStatus = false;
let DailyChartStatus = false;
let hourlyAverages;
let dailyAverages;
let timePickerInstance = null;
let isUpdatingUI = false;
let month, day, hour, year;
let modeChart = 0;

// Proxy for Status Tracking
const statusProxy = new Proxy({
  StatusOTA: false
}, {
  set(target, key, value) {
    if (target[key] !== value) {
      console.log(`${key} changed from ${target[key]} to ${value}`);
      target[key] = value;
      if (!isUpdatingUI) {
        updateUI();
      }

    }
    isUpdatingUI = false;
    return true;
  }
});

// DOM and UI
let DOM = null;

const initDOM = () => {
  DOM = {
    weatherContainer: document.getElementById('weather-container'),
    fotaBtn: document.querySelector('.fota-btn'),
    loadingIcon: document.getElementById("Icon_Loading"),
    fotaModal: document.getElementById('fota-modal'),
    fotaCloseBtn: document.getElementsByClassName('close')[0],
    versionList: document.getElementById('versionList'),
    HourlyChart: document.querySelector('.hourly-btn'),
    DailyChart: document.querySelector('.daily-btn'),
    SecondlyChart: document.querySelector('.second-btn'),
    timeChart: document.querySelector('.time-chart'),
    exportChartBtn: document.getElementById('export-chart-btn'),
    exportReportBtn: document.getElementById('export-report-btn')
  };
  if (!DOM.fotaModal) console.error('fotaModal not found');
  if (!DOM.fotaBtn) console.error('fotaBtn not found');
  if (!DOM.fotaCloseBtn) console.error('fotaCloseBtn not found');
  if (!DOM.versionList) console.error('versionlist not found');

  console.log('DOM initialized:', DOM);
};

const updateUI = () => {
  if (!DOM) return;
  DOM.fotaBtn.classList.toggle('active', statusProxy.StatusOTA);
  DOM.loadingIcon.style.display = "block";
};

// User Event Listeners
const initEventListeners = () => {
  function initTimePicker(mode = 'hourly') {
    if (timePickerInstance) {
      timePickerInstance.destroy();
    }
    const config = {
      appendTo: document.body,
      onChange: function (selectedDates, dateStr, instance) {
        if (!dateStr) return;
        if (mode === 'hourly') {
          const [y, m, d] = dateStr.split('-').map(Number);
          year = y; month = m; day = d;
          const hourlyData = generateChartDataFromHourlyAllMetrics();
          console.log('Hourly data:', hourlyData);
          modeChart = 1;
          renderChart(modeChart);
        }
        if (mode === 'daily') {
          const [y, m] = dateStr.split('-').map(Number);
          year = y; month = m;
          const dailyData = generateChartDataFromDailyAllMetrics();
          console.log('Daily data:', dailyData);
          modeChart = 2;
          renderChart(modeChart);
        }
      }
    };
    if (mode === 'hourly') {
      Object.assign(config, {
        enableTime: false,
        noCalendar: false,
        dateFormat: 'Y-m-d'
      });
    }
    if (mode === 'daily') {
      Object.assign(config, {
        plugins: [new monthSelectPlugin({ shorthand: true, dateFormat: "Y-m", altFormat: "F Y" })],
        dateFormat: 'Y-m'
      });
    }
    timePickerInstance = flatpickr("#Time-chart", config);
  }
  if (!DOM) return;
  console.log('Initializing event listeners...');
  DOM.fotaBtn.addEventListener('click', () => {
    isUpdatingUI = true;
    statusProxy.StatusOTA = !statusProxy.StatusOTA;
    DOM.fotaBtn.classList.toggle('active', statusProxy.StatusOTA);
    sendUpEvent("OTA", statusProxy.StatusOTA);
    if (DOM.fotaModal) {
      DOM.fotaModal.style.display = statusProxy.StatusOTA ? "block" : "none";
      if (statusProxy.StatusOTA) {
        fetchFirmwareVersions();
      }
    } else {
      console.error('fotaModal is null in updateUI');
    }
  });
  DOM.fotaCloseBtn.addEventListener('click', () => {
    // if (isUploadingFirmware) {
    //   console.warn("🚫 Không thể đóng modal khi OTA đang diễn ra.");
    //   return;
    // }
    isUpdatingUI = true;
    statusProxy.StatusOTA = false;
    DOM.fotaBtn.checked = false;
    sendUpEvent("OTA", statusProxy.StatusOTA);
    updateUI();
  });
  window.addEventListener('click', (event) => {
    if (event.target === DOM.fotaModal && DOM.fotaModal) {
      // if (isUploadingFirmware) {
      //   console.warn("🚫 Không thể đóng modal khi OTA đang diễn ra.");
      //   return;
      // }
      isUpdatingUI = true;
      statusProxy.StatusOTA = false;
      DOM.fotaBtn.checked = false;
      sendUpEvent("OTA", statusProxy.StatusOTA);
      updateUI();
    }
  });
  const updateChartStatus = (selected) => {
    SecondlyChartStatus = selected === 'secondly';
    HourlyChartStatus = selected === 'hourly';
    DailyChartStatus = selected === 'daily';
    if (DOM.SecondlyChart) DOM.SecondlyChart.classList.toggle('active', SecondlyChartStatus);
    if (DOM.HourlyChart) DOM.HourlyChart.classList.toggle('active', HourlyChartStatus);
    if (DOM.DailyChart) DOM.DailyChart.classList.toggle('active', DailyChartStatus);
    if (DOM.timeChart) {
      if (HourlyChartStatus || DailyChartStatus) {
        DOM.timeChart.style.display = 'flex';
        initTimePicker(HourlyChartStatus ? 'hourly' : 'daily');
      } else {
        DOM.timeChart.style.display = 'none';
      }
    }
  };
  if (DOM.SecondlyChart) {
    DOM.SecondlyChart.addEventListener('click', () => {
      console.log("Secondly chart clicked");
      updateChartStatus('secondly');
      modeChart = 0;
      renderChart(modeChart);
    });
  } else {
    console.error('SecondlyChart not found in DOM');
  }
  if (DOM.HourlyChart) {
    DOM.HourlyChart.addEventListener('click', () => {
      console.log("Hourly chart clicked");
      updateChartStatus('hourly');
      fetchRealTimeDataHourly();
      modeChart = 1;
      renderChart(modeChart);
    });
  } else {
    console.error('HourlyChart not found in DOM');
  }
  if (DOM.DailyChart) {
    DOM.DailyChart.addEventListener('click', () => {
      console.log("Daily chart clicked");
      updateChartStatus('daily');
      fetchRealTimeDataDaily();
      modeChart = 2;
      renderChart(modeChart);
    });
  } else {
    console.error('DailyChart not found in DOM');
  }
  
  // Export Chart Button
  if (DOM.exportChartBtn) {
    DOM.exportChartBtn.addEventListener('click', () => {
      exportChart();
    });
  } else {
    console.error('exportChartBtn not found in DOM');
  }
  
  // Export Report Button
  if (DOM.exportReportBtn) {
    DOM.exportReportBtn.addEventListener('click', () => {
      exportReport();
    });
  } else {
    console.error('exportReportBtn not found in DOM');
  }
  
  updateChartStatus('secondly');
};

// Export Functions
const exportChart = () => {
  if (typeof Highcharts === 'undefined') {
    alert('Chart library not loaded!');
    return;
  }
  
  const chart = Highcharts.charts[0];
  if (!chart) {
    alert('No chart available to export!');
    return;
  }
  
  // Get current date for filename
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  // Export chart as PNG
  chart.exportChart({
    type: 'image/png',
    filename: `sensor-chart-${dateStr}-${timeStr}`
  });
  
  console.log('Chart exported successfully!');
};

const exportReport = () => {
  // Get current sensor data
  const sensorData = {
    temperature: TemperatureValue,
    humidity: HumidityValue,
    pressure: PressureValue,
    pm1: PM1Value,
    pm25: PM25Value,
    pm10: PM10Value,
    timestamp: new Date().toISOString(),
    chartMode: modeChart === 0 ? 'Currently' : modeChart === 1 ? 'Hourly' : 'Daily'
  };
  
  // Create report content
  const reportContent = generateReportContent(sensorData);
  
  // Create and download PDF
  downloadReport(reportContent, sensorData);
  
  console.log('Report exported successfully!');
};

const generateReportContent = (data) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN');
  const timeStr = now.toLocaleTimeString('vi-VN');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Sensor Data Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .data-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .data-table th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .chart-info { margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Báo Cáo Dữ Liệu Cảm Biến</h1>
        <p>Ngày: ${dateStr} - Thời gian: ${timeStr}</p>
      </div>
      
      <div class="summary">
        <h2>Tóm Tắt Dữ Liệu</h2>
        <p>Chế độ hiển thị: ${data.chartMode}</p>
        <p>Thời gian xuất báo cáo: ${data.timestamp}</p>
      </div>
      
      <table class="data-table">
        <thead>
          <tr>
            <th>Thông Số</th>
            <th>Giá Trị</th>
            <th>Đơn Vị</th>
            <th>Trạng Thái</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nhiệt Độ</td>
            <td>${data.temperature.toFixed(2)}</td>
            <td>°C</td>
            <td>${data.temperature > 30 ? 'Cao' : data.temperature < 10 ? 'Thấp' : 'Bình thường'}</td>
          </tr>
          <tr>
            <td>Độ Ẩm</td>
            <td>${data.humidity.toFixed(2)}</td>
            <td>%</td>
            <td>${data.humidity > 80 ? 'Cao' : data.humidity < 30 ? 'Thấp' : 'Bình thường'}</td>
          </tr>
          <tr>
            <td>Áp Suất</td>
            <td>${data.pressure.toFixed(2)}</td>
            <td>hPa</td>
            <td>${data.pressure > 1020 ? 'Cao' : data.pressure < 980 ? 'Thấp' : 'Bình thường'}</td>
          </tr>
          <tr>
            <td>PM1.0</td>
            <td>${data.pm1.toFixed(2)}</td>
            <td>μg/m³</td>
            <td>${data.pm1 > 25 ? 'Cao' : data.pm1 < 10 ? 'Thấp' : 'Bình thường'}</td>
          </tr>
          <tr>
            <td>PM2.5</td>
            <td>${data.pm25.toFixed(2)}</td>
            <td>μg/m³</td>
            <td>${data.pm25 > 25 ? 'Cao' : data.pm25 < 10 ? 'Thấp' : 'Bình thường'}</td>
          </tr>
          <tr>
            <td>PM10</td>
            <td>${data.pm10.toFixed(2)}</td>
            <td>μg/m³</td>
            <td>${data.pm10 > 50 ? 'Cao' : data.pm10 < 20 ? 'Thấp' : 'Bình thường'}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="chart-info">
        <h3>Thông Tin Biểu Đồ</h3>
        <p>Biểu đồ được xuất ở chế độ: ${data.chartMode}</p>
        <p>Dữ liệu được cập nhật theo thời gian thực</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666;">
        <p>Báo cáo được tạo tự động bởi hệ thống giám sát cảm biến</p>
      </div>
    </body>
    </html>
  `;
};

const downloadReport = (content, data) => {
  // Create blob with HTML content
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const link = document.createElement('a');
  link.href = url;
  link.download = `sensor-report-${data.timestamp.split('T')[0]}.html`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
};

// WebSocket Communication

const fetchFirmwareVersions = () => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'firmware-versions' }));
    console.log("📡 Sent firmware-versions request via WebSocket");
  } else {
    console.warn("⚠️ WebSocket not open, retrying in 500ms...");
    setTimeout(fetchFirmwareVersions, 500);
  }
};


const sendUpEvent = (Device, StatusDevice) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'device-status',
      device: typeof Device === 'string' ? Device : String(Device),
      status: StatusDevice
    }));
    console.log(`📡 Sent device-status via WebSocket: ${Device} = ${StatusDevice}`);
  } else {
    console.warn("⚠️ WebSocket not open, retrying in 500ms...");
    setTimeout(() => sendUpEvent(Device, StatusDevice), 500);
  }
};

const sendUploadEventToServer = (version) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'ota', version }));
    console.log("📡 Sent OTA request via WebSocket: version =", version);
  } else {
    console.warn("⚠️ WebSocket not open, retrying in 500ms...");
    setTimeout(() => sendUploadEventToServer(version), 500);
  }
};

const syncData = () => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'sync-request' }));
    console.log("📡 Sent sync-request via WebSocket");
  } else {
    console.warn("⚠️ WebSocket not open, retrying in 500ms...");
    setTimeout(syncData, 500);
  }
};

const sendResetCommandToServer = () => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'reset-all' }));
    console.log("📡 Sent reset-all via WebSocket");
  } else {
    console.warn("⚠️ WebSocket not open, retrying in 500ms...");
    setTimeout(sendResetCommandToServer, 500);
  }
};

const fetchRealTimeDataHourly = () => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'get-real-time-data-hourly' }));
    console.log("📡 Sent get-real-time-data-hourly via WebSocket");
  }
};

const fetchRealTimeDataDaily = () => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'get-real-time-data-daily' }));
    console.log("📡 Sent get-real-time-data-daily via WebSocket");
  }
};

// Chart and Data Processing
let progressBars = null;
const initProgressBars = () => {
  if (!DOM) return;
  const commonConfig = {
    strokeWidth: 12,
    color: 'white',
    trailColor: 'rgba(255,255,255, 0.4)',
    trailWidth: 12,
    easing: 'easeInOut',
    duration: 1400,
    svgStyle: { width: '100%', height: '100%' },
    step: (state, bar) => {
      bar.path.setAttribute('stroke', state.color);
      const value = Math.round(bar.value() * 100);
      bar.setText(value || '0');
      bar.text.style.color = state.color;
    }
  };
  try {
    progressBars = {
      temp: new ProgressBar.SemiCircle('#container_temperature', { ...commonConfig, text: { value: '', alignToBottom: false, className: 'progressbar_label' } }),
      humidity: new ProgressBar.Line('#container_humidity', { ...commonConfig, text: { value: '', className: 'humidity_label' } }),
      pressure: new ProgressBar.Line('#container_pressure', { ...commonConfig, text: { value: '', className: 'pressure_label' } }),
      pm1: new ProgressBar.Line('#container_pm1', { ...commonConfig, text: { value: '', className: 'pm1_label' } }),
      pm25: new ProgressBar.Line('#container_pm25', { ...commonConfig, text: { value: '', className: 'pm25_label' } }),
      pm10: new ProgressBar.Line('#container_pm10', { ...commonConfig, text: { value: '', className: 'pm10_label' } })
    };
    progressBars.temp.animate(TemperatureValue / 100);
    progressBars.humidity.animate(HumidityValue / 100);
    progressBars.pressure.animate(PressureValue / 100);
    progressBars.pm1.animate(PM1Value / 100);
    progressBars.pm25.animate(PM25Value / 100);
    progressBars.pm10.animate(PM10Value / 100);
  } catch (error) {
    console.error('Error initializing progress bars:', error);
  }
};

const initHighcharts = () => {
  if (!DOM) return;
  
  console.log('Initializing Highcharts...');
  
  // Check if Highcharts is loaded
  if (typeof Highcharts === 'undefined') {
    console.error('Highcharts library not loaded!');
    return;
  }
  console.log('Highcharts library loaded successfully');
  
  const chartContainer = document.getElementById('chart-container');
  if (!chartContainer) {
    console.error('Chart container not found!');
    return;
  }
  console.log('Chart container found:', chartContainer);
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 3600 * 1000;
  let chartInterval = null;
  const generateAll24HourSeriesData = () => {
    const result = {
      Temperature: [],
      WaterLevel: [],
      TDS: [],
      PH: [],
      Conductivity: []
    };
    const hourlyData = generateChartDataFromHourlyAllMetrics();
    for (let i = 0; i < 24; i++) {
      const x = startOfToday + i * 3600 * 1000;
      result.Temperature.push({ x, y: hourlyData.Temperature[i] ?? null });
      result.WaterLevel.push({ x, y: hourlyData.WaterLevel[i] ?? null });
      result.TDS.push({ x, y: hourlyData.TDS[i] ?? null });
      result.PH.push({ x, y: hourlyData.PH[i] ?? null });
      result.Conductivity.push({ x, y: hourlyData.Conductivity[i] ?? null });
    }
    return result;
  };
  const generateAll31DaySeriesData = () => {
    const result = {
      Temperature: [],
      WaterLevel: [],
      TDS: [],
      PH: [],
      Conductivity: []
    };
    const dailyData = generateChartDataFromDailyAllMetrics();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    for (let i = 0; i < 31; i++) {
      const x = startDate + i * 24 * 3600 * 1000;
      result.Temperature.push({ x, y: dailyData.Temperature[i] ?? null });
      result.WaterLevel.push({ x, y: dailyData.WaterLevel[i] ?? null });
      result.TDS.push({ x, y: dailyData.TDS[i] ?? null });
      result.PH.push({ x, y: dailyData.PH[i] ?? null });
      result.Conductivity.push({ x, y: dailyData.Conductivity[i] ?? null });
    }
    return result;
  };
  const generateLiveInitData = () => {
    const now = new Date().getTime();
    const result = {
      Temperature: [],
      Humidity: [],
      Pressure: [],
      PM1: [],
      PM25: [],
      PM10: []
    };
    for (let i = -19; i <= 0; i++) {
      const x = now + i * 1000;
      result.Temperature.push({ x, y: TemperatureValue });
      result.Humidity.push({ x, y: HumidityValue });
      result.Pressure.push({ x, y: PressureValue });
      result.PM1.push({ x, y: PM1Value });
      result.PM25.push({ x, y: PM25Value });
      result.PM10.push({ x, y: PM10Value });
    }
    return result;
  };
  const addConductivityEffect = (series, point) => {
    if (!series.pulse)
      series.pulse = series.chart.renderer.circle().attr({ r: 5, opacity: 0 }).add(series.markerGroup);
    setTimeout(() => {
      series.pulse
        .attr({
          x: series.xAxis.toPixels(point.x, true),
          y: series.yAxis.toPixels(point.y, true),
          r: 5,
          opacity: 1,
          fill: series.color
        })
        .animate({ r: 20, opacity: 0 }, { duration: 1000 });
    }, 1);
  };
  const onChartLoad = function () {
    const chart = this;
    if (chartInterval) clearInterval(chartInterval);
    chartInterval = setInterval(() => {
      const x = new Date().getTime();
      const newDataPoints = [
        { seriesIndex: 0, y: TemperatureValue },
        { seriesIndex: 1, y: HumidityValue },
        { seriesIndex: 2, y: PressureValue },
        { seriesIndex: 3, y: PM1Value },
        { seriesIndex: 4, y: PM25Value },
        { seriesIndex: 5, y: PM10Value }
      ];
      newDataPoints.forEach(dataPoint => {
        const seriesTarget = chart.series[dataPoint.seriesIndex];
        seriesTarget.addPoint([x, dataPoint.y], true, true);
        addConductivityEffect(seriesTarget, { x, y: dataPoint.y });
      });
    }, 1000);
  };
  Highcharts.addEvent(Highcharts.Series, 'addPoint', e => {
    const point = e.point, series = e.target;
    if (!series.pulse) series.pulse = series.chart.renderer.circle().add(series.markerGroup);
    setTimeout(() => {
      series.pulse
        .attr({
          x: series.xAxis.toPixels(point.x, true),
          y: series.yAxis.toPixels(point.y, true),
          r: series.options.marker.radius,
          opacity: 1,
          fill: series.color
        })
        .animate({ r: 20, opacity: 0 }, { duration: 1000 });
    }, 1);
  });
  window.renderChart = function (mode = 1) {
    console.log('Rendering chart with mode:', mode);
    
    if (chartInterval) {
      clearInterval(chartInterval);
      chartInterval = null;
    }
    let isLive = (mode === 0);
    let is24h = (mode === 1);
    let is31d = (mode === 2);
    let xAxisOptions = {
      type: 'datetime',
      labels: {
        style: { color: '#FFFFFF' },
        format: is31d ? '{value:%d}' : '{value:%H:%M}'
      },
      lineColor: '#FFFFFF',
      tickColor: '#FFFFFF'
    };
    let seriesDataFunc = generateLiveInitData();
    let title = '';
    if (isLive) {
      xAxisOptions = Object.assign(xAxisOptions, {});
      seriesDataFunc = generateLiveInitData();
      title = '';
    } else if (is31d) {
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const endDate = new Date(now.getFullYear(), now.getMonth(), 31).getTime();
      xAxisOptions = Object.assign(xAxisOptions, {
        min: startDate,
        max: endDate,
        tickInterval: 24 * 3600 * 1000
      });
      seriesDataFunc = generateAll31DaySeriesData();
      title = '';
    } else {
      xAxisOptions = Object.assign(xAxisOptions, {
        min: startOfToday,
        max: endOfToday,
        tickInterval: 3600 * 1000,
        maxPadding: 0.1
      });
      seriesDataFunc = generateAll24HourSeriesData();
      title = '';
    }
    console.log('Creating Highcharts chart...');
    Highcharts.chart('chart-container', {
      chart: {
        type: 'spline',
        events: isLive ? { load: onChartLoad } : undefined
      },
      time: { useUTC: false },
      title: { text: title, style: { color: '#FFFFFF' } },
      xAxis: xAxisOptions,
      yAxis: {
        title: { text: 'Value', style: { color: '#FFFFFF' } },
        lineColor: '#FFFFFF',
        tickColor: '#FFFFFF',
        labels: { style: { color: '#FFFFFF' } },
        plotLines: [{ value: 0, width: 1, color: '#FFFFFF' }]
      },
      tooltip: {
        headerFormat: '<b>{series.name}</b><br/>',
        pointFormat: '{point.x:%Y-%m-%d}<br/>{point.y:.2f}'
      },
      legend: { enabled: true },
      exporting: { enabled: false },
      series: [
        { name: 'Temperature (°C)', lineWidth: 2, color: 'red', data: seriesDataFunc.Temperature },
        { name: 'Humidity (%)', lineWidth: 2, color: 'blue', data: seriesDataFunc.Humidity, visible: false },
        { name: 'Pressure (hPa)', lineWidth: 2, color: 'green', data: seriesDataFunc.Pressure, visible: false },
        { name: 'PM1.0 (μg/m³)', lineWidth: 2, color: 'yellow', data: seriesDataFunc.PM1, visible: false },
        { name: 'PM2.5 (μg/m³)', lineWidth: 2, color: 'purple', data: seriesDataFunc.PM25, visible: false },
        { name: 'PM10 (μg/m³)', lineWidth: 2, color: 'orange', data: seriesDataFunc.PM10, visible: false }
      ]
    });
    console.log('Chart created successfully!');
  };
  renderChart(0); // Start with live data mode
};

function getMonthlyDailyHourlyAverages(dataArray) {
  if (!Array.isArray(dataArray)) {
    console.error("❌ Dữ liệu không phải mảng.");
    return [];
  }
  const monthlyDailyHourlyData = Array.from({ length: 13 }, () =>
    Array.from({ length: 31 }, () =>
      Array.from({ length: 24 }, () => ({
        Temperature: [],
        WaterLevel: [],
        TDS: [],
        PH: [],
        Conductivity: []
      }))
    )
  );
  dataArray.forEach(entry => {
    const date = new Date(entry.Time);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 30 && hour >= 0 && hour < 24) {
      monthlyDailyHourlyData[month][day][hour].Temperature.push(entry.Temperature);
      monthlyDailyHourlyData[month][day][hour].WaterLevel.push(entry.WaterLevel);
      monthlyDailyHourlyData[month][day][hour].TDS.push(entry.TDS);
      monthlyDailyHourlyData[month][day][hour].PH.push(entry.PH);
      monthlyDailyHourlyData[month][day][hour].Conductivity.push(entry.Conductivity);
    }
  });
  const average = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return monthlyDailyHourlyData.map((monthData, m) => {
    if (m === 0) return null;
    return monthData.map((dayData, d) => {
      if (d === 0) return null;
      return dayData.map((hourData, h) => ({
        month: m,
        day: d,
        hour: h,
        Temperature: average(hourData.Temperature),
        WaterLevel: average(hourData.WaterLevel),
        TDS: average(hourData.TDS),
        PH: average(hourData.PH),
        Conductivity: average(hourData.Conductivity)
      }));
    });
  });
}

function getMonthlyDailyAverages(dataArray) {
  if (!Array.isArray(dataArray)) {
    console.error("❌ Dữ liệu không phải mảng.");
    return [];
  }
  const monthlyDailyData = Array.from({ length: 13 }, () =>
    Array.from({ length: 31 }, () => ({
      Temperature: [],
      WaterLevel: [],
      TDS: [],
      PH: [],
      Conductivity: []
    }))
  );
  dataArray.forEach(entry => {
    const date = new Date(entry.Time);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 30) {
      monthlyDailyData[month][day].Temperature.push(entry.Temperature);
      monthlyDailyData[month][day].WaterLevel.push(entry.WaterLevel);
      monthlyDailyData[month][day].TDS.push(entry.TDS);
      monthlyDailyData[month][day].PH.push(entry.PH);
      monthlyDailyData[month][day].Conductivity.push(entry.Conductivity);
    }
  });
  const average = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return monthlyDailyData.map((monthData, monthIdx) => {
    if (monthIdx === 0) return null;
    return monthData.map((dayData, dayIdx) => {
      if (dayIdx === 0) return null;
      return {
        month: monthIdx,
        day: dayIdx,
        Temperature: average(dayData.Temperature),
        WaterLevel: average(dayData.WaterLevel),
        TDS: average(dayData.TDS),
        PH: average(dayData.PH),
        Conductivity: average(dayData.Conductivity)
      };
    });
  });
}

function getHourlyValue(month, day, hour, key) {
  if (!hourlyAverages?.[month]?.[day]?.[hour]) {
    console.warn(`❌ Không có dữ liệu cho ${day}/${month} giờ ${hour}`);
    return null;
  }
  return hourlyAverages[month][day][hour][key] ?? null;
}

function getDailyValue(month, day, key) {
  if (!dailyAverages?.[month]?.[day]) {
    console.warn(`❌ Không có dữ liệu cho ${day}/${month}`);
    return null;
  }
  return dailyAverages[month][day][key] ?? null;
}

function generateChartDataFromHourlyAllMetrics() {
  const result = {
    Temperature: [],
    WaterLevel: [],
    TDS: [],
    PH: [],
    Conductivity: []
  };
  if (!year || !month || !day) return result;
  for (let h = 0; h < 24; h++) {
    ['Temperature', 'WaterLevel', 'TDS', 'PH', 'Conductivity'].forEach(key => {
      const value = getHourlyValue(month, day, h, key);
      result[key].push(value);
    });
  }
  return result;
}

function generateChartDataFromDailyAllMetrics() {
  const result = {
    Temperature: [],
    WaterLevel: [],
    TDS: [],
    PH: [],
    Conductivity: []
  };
  if (!year || !month) return result;
  for (let d = 1; d <= 31; d++) {
    ['Temperature', 'WaterLevel', 'TDS', 'PH', 'Conductivity'].forEach(key => {
      const value = getDailyValue(month, d, key);
      result[key].push(value);
    });
  }
  return result;
}

// Utility Functions
const fetchWeather = async (location) => {
  if (!DOM || !DOM.weatherContainer) return;
  try {
    const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${location}&aqi=yes`);
    if (!response.ok) throw new Error(`${response.status}`);
    const data = await response.json();
    DOM.weatherContainer.querySelector('#location').textContent = `Weather in ${data.location.name}, ${data.location.country}: `;
    DOM.weatherContainer.querySelector('#temperature').textContent = `${data.current.temp_c}°C`;
    DOM.weatherContainer.querySelector('#wind').textContent = `${data.current.wind_kph} km/h`;
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
  }
};

const initFullscreen = () => {
  const fullscreenButton = document.createElement("button");
  fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
  fullscreenButton.className = "fullscreen-button";
  document.body.appendChild(fullscreenButton);
  let isFullscreen = false;
  function toggleFullscreen() {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      else if (document.documentElement.mozRequestFullScreen) document.documentElement.mozRequestFullScreen();
      else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
      else if (document.documentElement.msRequestFullscreen) document.documentElement.msRequestFullscreen();
      fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
      fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
    }
    isFullscreen = !isFullscreen;
  }
  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => { isFullscreen = !!document.fullscreenElement; fullscreenButton.innerHTML = isFullscreen ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>'; });
  document.addEventListener("webkitfullscreenchange", () => { isFullscreen = !!document.webkitFullscreenElement; fullscreenButton.innerHTML = isFullscreen ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>'; });
  document.addEventListener("mozfullscreenchange", () => { isFullscreen = !!document.mozFullScreenElement; fullscreenButton.innerHTML = isFullscreen ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>'; });
  document.addEventListener("MSFullscreenChange", () => { isFullscreen = !!document.msFullscreenElement; fullscreenButton.innerHTML = isFullscreen ? '<i class="fas fa-compress"></i>' : '<i class="fas fa-expand"></i>'; });
};

// Application Initialization
const init = () => {
  initDOM();
  if (!DOM) {
    console.error('DOM initialization failed');
    return;
  }
  initEventListeners();
  initProgressBars();
  
  // Delay chart initialization to ensure DOM and scripts are ready
  setTimeout(() => {
    initHighcharts();
  }, 500);
  
  fetchWeather(LOCATION);
  syncData();
};

// WebSocket Message Handling
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("📦 Received WebSocket message:", data);
    switch (data.type) {
      case 'status-all':
        const status = data.data || {};
        statusProxy.StatusOTA = status.OTA || false;
        if ('Temperature' in status) TemperatureValue = parseFloat(status.Temperature);
        if ('Humidity' in status) HumidityValue = parseFloat(status.Humidity);
        if ('Pressure' in status) PressureValue = parseFloat(status.Pressure);
        if ('PM1' in status) PM1Value = parseFloat(status.PM1);
        if ('PM25' in status) PM25Value = parseFloat(status.PM25);
        if ('PM10' in status) PM10Value = parseFloat(status.PM10);
        if (progressBars) {
          progressBars.temp.animate(TemperatureValue / 100);
          progressBars.humidity.animate(HumidityValue / 100);
          progressBars.pressure.animate(PressureValue / 100);
          progressBars.pm1.animate(PM1Value / 100);
          progressBars.pm25.animate(PM25Value / 100);
          progressBars.pm10.animate(PM10Value / 100);
        }
        updateUI();
        console.log('✅ Successfully applied data from server');
        break;
      case 'get-timers':
        if (data.success && DOM.TimerList) {
          const tbody = document.getElementById('TimerTableBody');
          if (tbody) {
            tbody.innerHTML = '';
            if (!data.timers || data.timers.length === 0) {
              const tr = document.createElement('tr');
              tr.innerHTML = `<td colspan="4">Không có timer nào.</td>`;
              tbody.appendChild(tr);
            } else {
              data.timers.forEach(timer => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                  <td>${timer.Device || 'Unknown'}</td>
                  <td>${timer.TimerStart || '00:00:00'}</td>
                  <td>${timer.TimerEnd || '00:00:00'}</td>
                  <td>
                    <button style="
                      background-color: #e74c3c;
                      color: white;
                      border: none;
                      padding: 5px 10px;
                      cursor: pointer;
                      border-radius: 3px;
                    ">Xóa</button>
                  </td>
                `;
                const deleteBtn = tr.querySelector('button');
                deleteBtn.addEventListener('click', () => {
                  if (confirm(`Xóa timer cho thiết bị "${timer.Device}"?`)) {
                    deleteTimer(timer);
                  }
                });
                tbody.appendChild(tr);
              });
            }
          } else {
            console.error('Timer table body not found');
          }
        } else {
          console.error('Failed to fetch timers:', data.message);
          const tbody = document.getElementById('TimerTableBody');
          if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4">Lỗi khi tải danh sách timer.</td>`;
            tbody.appendChild(tr);
          }
        }
        break;
      case 'firmware-versions':
        if (data.success && DOM.versionList) {
          DOM.versionList.innerHTML = '';
          if (data.versions.length === 0) {
            DOM.versionList.innerHTML = '<p>Không có phiên bản firmware nào.</p>';
          } else {
            const ul = document.createElement('ul');
            data.versions.forEach(version => {
              const li = document.createElement('li');
              const versionText = document.createElement('span');
              versionText.textContent = `Version ${version}`;
              li.appendChild(versionText);
              const uploadButton = document.createElement('button');
              uploadButton.textContent = 'Upload';
              uploadButton.style.marginLeft = '10px';
              uploadButton.style.backgroundColor = '#4CAF50';
              uploadButton.style.color = 'white';
              uploadButton.style.border = 'none';
              uploadButton.style.padding = '5px 10px';
              uploadButton.style.cursor = 'pointer';
              uploadButton.style.borderRadius = '3px';
              uploadButton.addEventListener('click', () => {
                isUploadingFirmware = true;
                console.log(`Upload clicked for Version ${version}`);
                sendUploadEventToServer(version);
                const uploadStatus = document.getElementById('upload-status');
                if (uploadStatus) {
                  uploadStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tiến hành OTA...';
                  uploadStatus.style.color = 'orange';
                }
              });
              li.appendChild(uploadButton);
              ul.appendChild(li);
            });
            DOM.versionList.appendChild(ul);
            DOM.versionList.style.minHeight = '100px';
          }
        } else if (!DOM.versionList) {
          console.error('versionList element not found in DOM');
        } else {
          console.error('Failed to load versions:', data.message);
          DOM.versionList.innerHTML = '<p>Lỗi khi tải phiên bản: ' + data.message + '</p>';
        }
        break;
      case 'ota':
        console.log('OTA update progress:', data);
        const uploadStatus = document.getElementById('upload-status');
        if (uploadStatus) {
          console.log('OTA update progress:', data.Percent);
          uploadStatus.innerHTML = `<i class="fas fa-spinner fa-spin"></i> OTA Progress: ${data.Percent}%`;
          if (data.Percent >= 100) {
            uploadStatus.innerHTML = 'OTA Complete!';
            uploadStatus.style.color = 'green';
            statusProxy.StatusOTA = false;
            DOM.fotaModal.style.display = statusProxy.StatusOTA ? "block" : "none";
          }
        }
        break;
      case 'get-real-time-data-daily':
        DailyData = data.realDailyData;
        dailyAverages = getMonthlyDailyAverages(DailyData);
        break;
      case 'get-real-time-data-hourly':
        HourlyData = data.realHourlyData;
        hourlyAverages = getMonthlyDailyHourlyAverages(HourlyData);
        break;
      default:
        console.warn("⚠️ Unknown message type:", data.type);
    }
  } catch (error) {
    console.error('❌ Failed to parse WebSocket message:', error);
  }
};

// WebSocket Connection
socket.onopen = () => {
  console.log('WebSocket connected, registering as Frontend');
  socket.send(JSON.stringify({ type: 'register', clientType: 'frontend' }));
};



function initStreamMonitor(ip) {
  const img = document.createElement('img');
  img.src = `http://${ip}/stream`;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = '12px';
  DOM.streamMonitor.innerHTML = '';
  DOM.streamMonitor.appendChild(img);
}

// Page Load Event
document.addEventListener('DOMContentLoaded', init);