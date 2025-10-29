#ifndef ESP32_GATEWAY_IDF_H
#define ESP32_GATEWAY_IDF_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_timer.h"
#include "esp_log.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "lwip/err.h"
#include "lwip/sys.h"
#include "DataManager.h"
#include "esp_netif.h"
#include "esp_websocket_client.h"
#include "JsonHandle.h"
#include "freertos/queue.h"
#include "WSHandle.h"
#include "DS3231Time.h"
#include "sntp_sync.h"
#include "../Component/SD_Card/SD_Card.h"
#include "bme280.h"
#include "ssd1306.h"
#include "pms7003.h"
#include <string.h>
#include "esp_spiffs.h"
#include "WifiManager.h"

static const char *TAG = "ESP32-GateWay";
#define LED_GPIO    2


dataManager_t DataManager = {0};
deviceManager_t DeviceManager = {0};

bool sentKey = true;
uint8_t PercentOTA;
bool IsWebSocketConnect = false;


i2c_dev_t ds3231_device;
struct tm timeDS3231;

bmp280_t bme280_device;
bmp280_params_t bme280_params;

SSD1306_t dev ;


float random_float_2_decimal()
{
    int value = rand() % 100; // giá trị từ 0 đến 99
    return value / 100.0f;
}

esp_err_t initNVS(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    return ESP_OK;
}

esp_err_t init_spiffs(void) {
    ESP_LOGI(TAG, "Initializing SPIFFS");
  
    esp_vfs_spiffs_conf_t conf = {.base_path = "/spiffs",
                                  .partition_label = NULL,
                                  .max_files = 5,
                                  .format_if_mount_failed = true};
  
    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
      if (ret == ESP_FAIL) {
        ESP_LOGE(TAG, "Failed to mount or format filesystem");
      } else if (ret == ESP_ERR_NOT_FOUND) {
        ESP_LOGE(TAG, "Failed to find SPIFFS partition");
      } else {
        ESP_LOGE(TAG, "Failed to initialize SPIFFS (%s)", esp_err_to_name(ret));
      }
      return ESP_FAIL;
    }
  
    size_t total = 0, used = 0;
    ret = esp_spiffs_info(NULL, &total, &used);
    if (ret != ESP_OK) {
      ESP_LOGE(TAG, "Failed to get SPIFFS partition information (%s)",
               esp_err_to_name(ret));
    } else {
      ESP_LOGI(TAG, "Partition size: total: %d, used: %d", total, used);
    }
  
    return ESP_OK;
  }

#endif // ESP32_GATEWAY_IDF_H