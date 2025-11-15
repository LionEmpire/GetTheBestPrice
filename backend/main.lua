-- Import required libraries
local logger = require("logger")
local millennium = require("millennium")
local http = require("http")
local json = require("json")
local fs = require("fs")
local utils = require("utils")

-- Define the path to our config file
-- It will look for config.json inside the "GetTheBestPrice" plugin folder
local config_path = fs.join(millennium.get_install_path(), "plugins", "GetTheBestPrice", "config.json")

---
-- Helper function to safely load the API key from config.json
---
local function get_api_key()
    if not fs.exists(config_path) then
        logger:error("config.json not found! Please create it in the GetTheBestPrice plugin folder and add your API key.")
        return nil
    end

    local success, content = pcall(utils.read_file, config_path)
    if not success or not content then
        logger:error("Failed to read config.json: " .. tostring(content))
        return nil
    end

    local config_success, config = pcall(json.decode, content)
    if not config_success or type(config) ~= "table" then
        logger:error("Failed to parse config.json. Make sure it is valid JSON.")
        return nil
    end

    if not config.apiKey or config.apiKey == "" then
        logger:error("config.json is missing 'apiKey' or it is empty.")
        return nil
    end

    return config.apiKey
end

-------------------------------------------------------------------------------
-- Price Fetching Logic --
-------------------------------------------------------------------------------
function get_ggdeals_prices_unsafe(app_id, region_code)
    
    local api_key = get_api_key()
    if not api_key then
        return nil -- Error was already logged by get_api_key()
    end

    if not app_id or not region_code then
        logger:error("get_ggdeals_prices_unsafe called with missing app_id or region_code")
        return nil
    end

    local url = "https://api.gg.deals/v1/prices/by-steam-app-id/?"
              .. "ids=" .. app_id
              .. "&key=" .. api_key
              .. "&region=" .. region_code
    
    logger:info("Fetching prices from gg.deals with AppID: " .. app_id)
    
    local options = { timeout = 10 }
    local response, err = http.get(url, options)

    if not response then
        logger:error("Failed to fetch from gg.deals: " .. (err or "unknown error"))
        return nil
    end

    if response.status ~= 200 then
        logger:error("gg.deals API returned status " .. response.status .. ". Body: " .. (response.body or "empty"))
        return nil
    end

    local data = json.decode(response.body)
    
    if type(data) ~= "table" then
        logger:error("Failed to parse JSON. Response: " .. response.body)
        return nil
    end
    
    if not data.success or type(data.data) ~= "table" then
         logger:error("API response was not successful or data.data field is missing/not a table.")
         return nil
    end
    
    local game_data = data.data[tostring(app_id)]
    
    if not game_data or game_data == json.null then
         logger:info("No price data found for AppID: " .. app_id)
         return nil
    end

    local prices = game_data.prices
    if type(prices) ~= "table" then
        logger:error("game_data.prices was not a table. Data: " .. response.body)
        return nil
    end

    -- Get all the prices we need
    local official_price = prices.currentRetail
    local keyshop_price = prices.currentKeyshops
    local historical_official = prices.historicalRetail
    local historical_keyshops = prices.historicalKeyshops
    local currency = prices.currency or ""
    local page_url = game_data.url or ""
    
    -- Handle nulls for all prices
    if official_price == json.null then official_price = "N/A" end
    if keyshop_price == json.null then keyshop_price = "N/A" end
    if historical_official == json.null then historical_official = "N/A" end
    if historical_keyshops == json.null then historical_keyshops = "N/A" end

    -- Create the new result table
    local result_table = {
        official_price = official_price,
        keyshop_price = keyshop_price,
        historical_official = historical_official,
        historical_keyshops = historical_keyshops,
        currency = currency,
        url = page_url
    }

    logger:info("Successfully parsed prices. Returning JSON string...")
    return json.encode(result_table)
end

---
-- This is the "safe" function the frontend calls
---
function get_ggdeals_prices(appId, regionCode)
    
    logger:info("get_ggdeals_prices called. Arg1 (appId): " .. tostring(appId) .. ", Arg2 (regionCode): " .. tostring(regionCode))

    local success, result_string = pcall(get_ggdeals_prices_unsafe, appId, regionCode)
    
    if success then
        return result_string
    else
        logger:error("!!! FATAL CRASH in get_ggdeals_prices_unsafe !!!")
        logger:error(tostring(result_string)) -- 'result_string' is the error message
        return nil
    end
end
-------------------------------------------------------------------------------
-- END OF PRICE FUNCTION --
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- SETTINGS FUNCTIONS --
-------------------------------------------------------------------------------

---
-- Loads the API key from config.json for the settings page
---
function load_api_key()
    if not fs.exists(config_path) then
        return "" -- No config file, return empty string
    end

    local success, content = pcall(utils.read_file, config_path)
    if not success or not content then
        logger:error("Failed to read config.json: " .. tostring(content))
        return ""
    end

    local config_success, config = pcall(json.decode, content)
    if not config_success or type(config) ~= "table" then
        logger:error("Failed to parse config.json.")
        return ""
    end

    return config.apiKey or ""
end

---
-- Saves the API key to config.json
---
function save_api_key(key)
    logger:info("Saving new API key...")
    
    local config = { apiKey = key }
    local success, json_string = pcall(json.encode, config)
    
    if not success then
        logger:error("Failed to encode new API key to JSON.")
        return false
    end

    local write_success, err = pcall(utils.write_file, config_path, json_string)
    if not write_success then
        logger:error("Failed to write config.json: " .. tostring(err))
        return false
    end

    logger:info("Successfully saved new API key.")
    return true
end

-------------------------------------------------------------------------------
-- PLUGIN LIFECYCLE --
-------------------------------------------------------------------------------
local function on_load()
    logger:info("GetTheBestPrice Loaded with Millennium version " .. millennium.version())
    millennium.ready()
end

local function on_unload()
    logger:Info("GetTheBestPrice unloaded")
end

local function on_frontend_loaded()
    logger:info("GetTheBestPrice: Frontend loaded")
end

-- Export all functions that can be called
return {
    on_frontend_loaded = on_frontend_loaded,
    on_load = on_load,
    on_unload = on_unload,
    
    -- Main function for store page
    get_ggdeals_prices = get_ggdeals_prices,
    
    -- Functions for settings page
    load_api_key = load_api_key,
    save_api_key = save_api_key
}