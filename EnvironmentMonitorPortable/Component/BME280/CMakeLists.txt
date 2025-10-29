set(app_src bme280.c)
set(pre_req  driver log BMP280)
idf_component_register(SRCS ${app_src}
                    INCLUDE_DIRS "."
                    REQUIRES ${pre_req})