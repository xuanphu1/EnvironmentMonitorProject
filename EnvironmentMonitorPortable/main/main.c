#include "main.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "pms7003.h"
#include <string.h>

// Queue cho giao tiếp giữa các task
static QueueHandle_t sensor_data_queue = NULL;  // Producer -> Distributor
static QueueHandle_t display_data_queue = NULL; // Distributor -> Display
static QueueHandle_t savedata_queue = NULL;     // Distributor -> SaveData

// Mutex để bảo vệ màn hình SSD1306 (chỉ cho phép 1 task ghi tại 1 thời điểm)
static SemaphoreHandle_t ssd1306_mutex = NULL;

void sntpGetTime(void) {
  time_t timeNow = 0;
  struct tm timeInfo = {0};
  sntp_init_func();
  ESP_ERROR_CHECK_WITHOUT_ABORT(sntp_setTime(&timeInfo, &timeNow));
  mktime(&timeInfo);
  if (timeInfo.tm_year < 130 && timeInfo.tm_year > 120) {
    ESP_ERROR_CHECK_WITHOUT_ABORT(ds3231_set_time(&ds3231_device, &timeInfo));
  }
  vTaskDelete(NULL);
}

void syncTimeSNTP(void *pvParameter) { 
  if(is_wifi_connected()) {
    sntpGetTime(); 
  }
}

void SaveData(void *pvParameter) {
  dataManager_t sensor_data;

  while (1) {
    // Kiểm tra queue có dữ liệu trước khi nhận (bỏ qua nếu queue rỗng)
    if (uxQueueMessagesWaiting(savedata_queue) > 0) {
      // Nhận dữ liệu từ SaveData queue (non-blocking vì đã check có data)
      if (xQueueReceive(savedata_queue, &sensor_data, 0) == pdTRUE) {
        // Parse timestamp từ sensor_data.Timestamp
        // Format: "YYYY-MM-DDTHH:MM:SS"
        struct tm saveTime;
        if (sscanf(sensor_data.Timestamp, "%d-%d-%dT%d:%d:%d",
                   &saveTime.tm_year, &saveTime.tm_mon, &saveTime.tm_mday,
                   &saveTime.tm_hour, &saveTime.tm_min,
                   &saveTime.tm_sec) == 6) {
          saveTime.tm_year -= 1900; // Adjust for struct tm
          saveTime.tm_mon -= 1;

          snprintf(DataManager.NameFileSD, sizeof(DataManager.NameFileSD),
                   "%02d-%02d-%02d.txt", saveTime.tm_year % 100,
                   saveTime.tm_mon + 1, saveTime.tm_mday);

          snprintf(
              DataManager.FormatDataToSD, sizeof(DataManager.FormatDataToSD),
              "%d:%d:%d-T%fH%fP%fM1%fM2%fM3%fS%s", saveTime.tm_hour,
              saveTime.tm_min, saveTime.tm_sec, sensor_data.Temperature_Value,
              sensor_data.Humidity_Value, sensor_data.Pressure_Value,
              sensor_data.PM1_0_Value, sensor_data.PM2_5_Value,
              sensor_data.PM10_Value, sensor_data.statusDevice);

          if (writeFinalFileSD_Card(DataManager.NameFileSD,
                                    DataManager.FormatDataToSD) == ESP_OK) {
            // ESP_LOGI(TAG, "Data saved to SD card successfully!");
          } else {
            ESP_LOGW(TAG, "Failed to save data to SD card");
          }
        } else {
          ESP_LOGE(TAG, "Failed to parse timestamp");
        }
      }
    }

    vTaskDelay(pdMS_TO_TICKS(1000)); // Small delay để không tốn CPU
  }
}

void sensorDataDistributor(void *pvParameter) {
  dataManager_t sensor_data;

  ESP_LOGI(TAG, "Sensor data distributor task started");

  while (1) {
    // Kiểm tra sensor queue có dữ liệu trước khi nhận (bỏ qua nếu queue rỗng)
    if (uxQueueMessagesWaiting(sensor_data_queue) > 0) {
      // Nhận dữ liệu từ sensor queue (non-blocking vì đã check có data)
      if (xQueueReceive(sensor_data_queue, &sensor_data, 0) == pdTRUE) {
        // Phân phối đến display queue
        // Kiểm tra số message còn lại trong queue
        if (uxQueueMessagesWaiting(display_data_queue) >= 4) {
          ESP_LOGW(TAG, "Display queue almost full: %d/5",
                   uxQueueMessagesWaiting(display_data_queue));
        }

        if (xQueueSend(display_data_queue, &sensor_data, 0) != pdTRUE) {
          ESP_LOGW(TAG, "Display queue full");
        }

        // Phân phối đến SaveData queue
        // Kiểm tra số message còn lại trong queue
        if (uxQueueMessagesWaiting(savedata_queue) >= 4) {
          ESP_LOGW(TAG, "SaveData queue almost full: %d/5",
                   uxQueueMessagesWaiting(savedata_queue));
        }

        if (xQueueSend(savedata_queue, &sensor_data, 0) != pdTRUE) {
          ESP_LOGW(TAG, "SaveData queue full");
        }

        ESP_LOGI(TAG, "Data distributed to all consumers");
      }
    }

    vTaskDelay(pdMS_TO_TICKS(500)); // Small delay để không tốn CPU
  }
}

void displayAndSendDataTask(void *pvParameter) {
  char buffer[64];
  dataManager_t sensor_data;

  while (1) {
    // Kiểm tra queue có dữ liệu trước khi nhận (bỏ qua nếu queue rỗng)
    if (uxQueueMessagesWaiting(display_data_queue) > 0) {
      // Nhận dữ liệu từ display queue (non-blocking vì đã check có data)
      if (xQueueReceive(display_data_queue, &sensor_data, 0) == pdTRUE) {
        // Lock mutex để bảo vệ màn hình
        // if (xSemaphoreTake(ssd1306_mutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
        //   // Hiển thị lên màn hình
        //   ssd1306_clear_screen(&dev, false);

        //   // Hiển thị dòng 0: Timestamp
        //   snprintf(buffer, sizeof(buffer), "%s", sensor_data.Timestamp);
        //   ssd1306_display_text(&dev, 0, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 1: Nhiệt độ
        //   snprintf(buffer, sizeof(buffer), "T:%5.1fC",
        //            sensor_data.Temperature_Value);
        //   ssd1306_display_text(&dev, 1, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 2: Độ ẩm
        //   snprintf(buffer, sizeof(buffer), "H:%5.1f%%",
        //            sensor_data.Humidity_Value);
        //   ssd1306_display_text(&dev, 2, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 3: Áp suất
        //   snprintf(buffer, sizeof(buffer), "P:%7.1fPa",
        //            sensor_data.Pressure_Value);
        //   ssd1306_display_text(&dev, 3, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 4: PM1.0
        //   snprintf(buffer, sizeof(buffer), "PM1:%5.0f",
        //            sensor_data.PM1_0_Value);
        //   ssd1306_display_text(&dev, 4, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 5: PM2.5
        //   snprintf(buffer, sizeof(buffer), "PM2.5:%4.0f",
        //            sensor_data.PM2_5_Value);
        //   ssd1306_display_text(&dev, 5, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 6: PM10
        //   snprintf(buffer, sizeof(buffer), "PM10:%5.0f",
        //            sensor_data.PM10_Value);
        //   ssd1306_display_text(&dev, 6, buffer, strlen(buffer), false);

        //   // Hiển thị dòng 7: Trạng thái thiết bị
        //   snprintf(buffer, sizeof(buffer), "S:%s", sensor_data.statusDevice);
        //   ssd1306_display_text(&dev, 7, buffer, strlen(buffer), false);

        //   ESP_LOGI(TAG, "Display updated on SSD1306");

        //   // Release mutex
        //   xSemaphoreGive(ssd1306_mutex);
        // }
        DataToSever(&sensor_data);
        ESP_LOGI(TAG, "Data sent to WebSocket");
      }
    }

    vTaskDelay(pdMS_TO_TICKS(1000)); // Small delay để không tốn CPU
  }
}

void readAllSensorsTask(void *pvParameter) {
  uint32_t pm1_0, pm2_5, pm10;
  dataManager_t sensor_data;
  float temp, humid, press;

  // Khởi tạo sensor_data
  memset(&sensor_data, 0, sizeof(dataManager_t));
  while (1) {
    // 1. Cập nhật timestamp từ DS3231
    ds3231_get_time(&ds3231_device, &timeDS3231);
    ds3231_get_time_str(&timeDS3231, sensor_data.Timestamp,
                        sizeof(sensor_data.Timestamp));
    ESP_LOGI(TAG, "Timestamp: %s", sensor_data.Timestamp);

    // 2. Đọc dữ liệu từ BME280
    bme280_readSensorData(&bme280_device, &temp, &press, &humid);
    sensor_data.Temperature_Value = temp;
    sensor_data.Humidity_Value = humid;
    sensor_data.Pressure_Value = press;

    // 3. Đọc dữ liệu từ PMS7003 (sử dụng chế độ indoor)
    esp_err_t pms_result = pms7003_readData(indoor, &pm1_0, &pm2_5, &pm10);
    if (pms_result == ESP_OK) {
      sensor_data.PM1_0_Value = (float)pm1_0;
      sensor_data.PM2_5_Value = (float)pm2_5;
      sensor_data.PM10_Value = (float)pm10;
    } else {
      sensor_data.PM1_0_Value = 0;
      sensor_data.PM2_5_Value = 0;
      sensor_data.PM10_Value = 0;
    }

    // 4. Gửi dữ liệu vào queue cho Distributor task
    // Kiểm tra số message còn lại trong queue
    if (uxQueueMessagesWaiting(sensor_data_queue) >= 4) {
      ESP_LOGW(TAG, "Sensor queue almost full: %d/5",
               uxQueueMessagesWaiting(sensor_data_queue));
    }

    if (xQueueSend(sensor_data_queue, &sensor_data, 0) != pdTRUE) {
      ESP_LOGW(TAG,
               "Failed to send sensor data to distributor queue - queue full");
    } else {
    //   ESP_LOGI(
    //       TAG,
    //       "Sensors read - T:%.1f H:%.1f P:%.1f PM1:%.0f PM2.5:%.0f PM10:%.0f",
    //       sensor_data.Temperature_Value, sensor_data.Humidity_Value,
    //       sensor_data.Pressure_Value, sensor_data.PM1_0_Value,
    //       sensor_data.PM2_5_Value, sensor_data.PM10_Value);
    }

    vTaskDelay(pdMS_TO_TICKS(1000)); // Đọc cảm biến mỗi 1 giây
  }
}

void app_main(void) {

  // Initialize NVS
  ESP_ERROR_CHECK(initNVS());
  ESP_ERROR_CHECK(init_spiffs());

  wifi_init_sta();
  esp_log_level_set(TAG, ESP_LOG_INFO);

  // Khởi tạo các queues
  sensor_data_queue = xQueueCreate(5, sizeof(dataManager_t));
  if (sensor_data_queue == NULL) {
    ESP_LOGE(TAG, "Failed to create sensor data queue");
    return;
  }
  ESP_LOGI(TAG, "Sensor data queue created");

  display_data_queue = xQueueCreate(5, sizeof(dataManager_t));
  if (display_data_queue == NULL) {
    ESP_LOGE(TAG, "Failed to create display data queue");
    return;
  }
  ESP_LOGI(TAG, "Display data queue created");

  savedata_queue = xQueueCreate(5, sizeof(dataManager_t));
  if (savedata_queue == NULL) {
    ESP_LOGE(TAG, "Failed to create SaveData queue");
    return;
  }
  ESP_LOGI(TAG, "SaveData queue created");

  // Khởi tạo Mutex để bảo vệ màn hình SSD1306
  ssd1306_mutex = xSemaphoreCreateMutex();
  if (ssd1306_mutex == NULL) {
    ESP_LOGE(TAG, "Failed to create SSD1306 mutex");
    return;
  }
  ESP_LOGI(TAG, "SSD1306 mutex created");

  ESP_ERROR_CHECK(i2cdev_init());
  memset(&ds3231_device, 0, sizeof(i2c_dev_t));
  ESP_ERROR_CHECK(ds3231_init_desc(&ds3231_device, CONFIG_RTC_I2C_PORT,
                                   CONFIG_RTC_PIN_NUM_SDA,
                                   CONFIG_RTC_PIN_NUM_SCL));
  ESP_ERROR_CHECK(bme280_init(&bme280_device, &bme280_params, BME280_ADDRESS,
                              CONFIG_BME_I2C_PORT, CONFIG_BME_PIN_NUM_SDA,
                              CONFIG_BME_PIN_NUM_SCL));

  // Khởi tạo PMS7003 UART
  uart_config_t uart_config = UART_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(pms7003_initUart(&uart_config));
  ESP_ERROR_CHECK(pms7003_activeMode());

  i2c_device_add(&dev, CONFIG_SSD1306_I2C_PORT, -1, SSD1306_ADDRESS);
  // ssd1306_init(&dev, 128, 64);

  // Delay ngắn để đảm bảo màn hình đã sẵn sàng
  vTaskDelay(pdMS_TO_TICKS(100));

  // Lock mutex khi khởi tạo màn hình
  if (xSemaphoreTake(ssd1306_mutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
    ssd1306_clear_screen(&dev, false);
    ssd1306_contrast(&dev, 0xff);
    xSemaphoreGive(ssd1306_mutex);
  }

  initSDCard();

  // 1. Cấu hình chân LED là OUTPUT
  gpio_config_t io_conf = {
      .pin_bit_mask = (1ULL << LED_GPIO),
      .mode = GPIO_MODE_OUTPUT,
      .pull_up_en = 0,
      .pull_down_en = 0,
      .intr_type = GPIO_INTR_DISABLE,
  };
  gpio_config(&io_conf);
  //   printf("Capacity heap: %ld bytes\n", esp_get_free_heap_size());
  // Tạo các tasks theo thứ tự priority
  // Priority 7: Read sensors (Producer)
  // Priority 6: Distributor (Router)
  // Priority 5: Display (Consumer)
  // Priority 8: SaveData (Consumer)
  xTaskCreate(readAllSensorsTask, "ReadAllSensors", 4096, NULL, 7, NULL);
  xTaskCreate(sensorDataDistributor, "DataDistributor", 4096, NULL, 6, NULL);
  xTaskCreate(displayAndSendDataTask, "DisplayAndSendData", 4096, NULL, 5, NULL);
  xTaskCreate(syncTimeSNTP, "Sync Time SNTP", 4096, NULL, 12, NULL);
  xTaskCreate(WebSocket_Handler, "WebSocket Handler", 4096, NULL, 11, NULL);
  xTaskCreate(SaveData, "Save Data to SD Card", 4096, NULL, 8, NULL);
  xTaskCreate(wifi_manager_task, "WiFi Manager", 4096, NULL, 9, NULL);
  xTaskCreate(wifi_connect_task, "WiFi Connect", 4096, NULL, 10, NULL);
  ESP_LOGI(TAG, "All tasks created successfully");
}
