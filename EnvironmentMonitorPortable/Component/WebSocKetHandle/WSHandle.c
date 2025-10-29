#include "WSHandle.h"
// WebSocket client handle
static esp_websocket_client_handle_t client = NULL;

#define TAG_WEBSOCKET "WebSocket Handler"


void SendSignalRegister(void) {
  cJSON *data = cJSON_CreateObject();
  cJSON_AddStringToObject(data, "type", "register");
  cJSON_AddStringToObject(data, "clientType", "esp32");

  char *json_str = cJSON_PrintUnformatted(data);
  printf("JSON: %s\n", json_str);

  esp_websocket_client_send_text(client, json_str, strlen(json_str),
                                 portMAX_DELAY);

  free(json_str);     // Free chuỗi được malloc bên trong cJSON
  cJSON_Delete(data); // Free cJSON object
}
void DataToSever(dataManager_t *Datamanager) {
  cJSON *data = cJSON_CreateObject();
  cJSON_AddStringToObject(data, "type", "DataFromESP32");
  cJSON_AddStringToObject(data, "clientType", "esp32");

  cJSON_AddStringToObject(data, "Time", Datamanager->Timestamp);
  cJSON_AddNumberToObject(data, "Temperature", Datamanager->Temperature_Value);
  cJSON_AddNumberToObject(data, "Humidity", Datamanager->Humidity_Value);
  cJSON_AddNumberToObject(data, "Pressure", Datamanager->Pressure_Value);
  cJSON_AddNumberToObject(data, "PM1_0", Datamanager->PM1_0_Value);
  cJSON_AddNumberToObject(data, "PM2_5", Datamanager->PM2_5_Value);
  cJSON_AddNumberToObject(data, "PM10", Datamanager->PM10_Value);

  char *json_str = cJSON_PrintUnformatted(data);

  esp_websocket_client_send_text(client, json_str, strlen(json_str),
                                 portMAX_DELAY);

  free(json_str);     // Free chuỗi được malloc bên trong cJSON
  cJSON_Delete(data); // Free cJSON object
}

static void websocket_event_handler(void *arg, esp_event_base_t base,
                                    int32_t event_id, void *event_data) {
  esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;

  switch (event_id) {
  case 0:
    ESP_LOGI(TAG_WEBSOCKET, "WebSocket error: %s", data->data_ptr);
    break;
  default:
    break;
  }
}
void websocket_app_start(void) {
  esp_websocket_client_config_t websocket_cfg = {
      .uri = CONFIG_WS_URL,
  };

  client = esp_websocket_client_init(&websocket_cfg);
  esp_websocket_register_events(client, WEBSOCKET_EVENT_ANY,
                                websocket_event_handler, NULL);
  esp_websocket_client_start(client);
  // SendSignalRegister();
  ESP_LOGI(TAG_WEBSOCKET, "WebSocket start");
}
void WebSocket_Handler(void *pvParameter) {
  while (1) {
    if (is_wifi_connected()) {
      if (client == NULL) {
        websocket_app_start();
      }
    } else {
      if (client != NULL) {
        ESP_LOGE(TAG_WEBSOCKET, "WiFi not connected");
        esp_websocket_client_stop(client);
        esp_websocket_client_destroy_on_exit(client);
        client = NULL;
      }
    }
    vTaskDelay(pdMS_TO_TICKS(1000));
  }
}