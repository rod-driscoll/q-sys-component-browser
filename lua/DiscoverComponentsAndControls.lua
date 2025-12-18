--[[
  DiscoverComponentsAndControls.lua
  -- Discovers all components and their controls in the Q-SYS design
  -- Uses Component.GetComponents() and Component.GetControls() APIs
  -- Outputs results as JSON to log.history for consumption by external systems
]]
json = require 'rapidjson'

-- Get all components in the design
local components = Component.GetComponents()
local discoveryData = {
  timestamp = os.date("%Y-%m-%dT%H:%M:%S"),
  totalComponents = #components,
  components = {}
}

print("Starting component discovery...")
print("Found " .. #components .. " components")

-- Iterate through each component
for _, comp in ipairs(components) do
  local componentData = {
    name = comp.Name,
    type = comp.Type,
    properties = comp.Properties or {},
    controls = {}
  }

  -- Get all controls for this component
  local success, controls = pcall(function()
    return Component.GetControls(comp.Name)
  end)

  if success and controls then
    componentData.controlCount = #controls

    -- Iterate through each control
    for _, ctrl in ipairs(controls) do
      table.insert(componentData.controls, {
        name = ctrl.Name,
        type = ctrl.Type or "Text",
        direction = ctrl.Direction or "Read/Write",
        value = ctrl.Value,
        valueMin = ctrl.ValueMin,
        valueMax = ctrl.ValueMax,
        position = ctrl.Position,
        string = ctrl.String,
        choices = ctrl.Choices
      })
    end
  else
    componentData.controlCount = 0
    componentData.error = "Failed to get controls"
  end

  table.insert(discoveryData.components, componentData)
end

-- Output as JSON
local jsonOutput = json.encode(discoveryData, { pretty = true })
print("Component Discovery Complete")
print(jsonOutput)
