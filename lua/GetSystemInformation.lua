--[[
  GetSystemInformation.lua
  -- This script gets the hardware details of a Q-SYS Core
]]
json = require 'rapidjson'
print('System information')
local info = { System = System, Network = Network.Interfaces() }
print(json.encode(info))
