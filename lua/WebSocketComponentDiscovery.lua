-- ========== START: WebSocket Component Discovery ==========
--[[
  WebSocketComponentDiscovery.lua
  Discovers all components and their controls in the Q-SYS design
  Sends results via WebSocket to avoid overwhelming the log system

  Usage in webserver component's code control:
  1. Set up the HTTP server with WebSocket endpoint
  2. When client connects to /ws/discovery, send component data
  3. Handles large payloads by chunking if needed
]]

json = require 'rapidjson'
HttpServer = require 'qsys-http-server'

-- Create HTTP server
local server = HttpServer.New()

-- Middleware
server:use(HttpServer.cors())
server:use(HttpServer.json())

-- Serve static files from dist directory (non-chunked for reliability)
server:use('/', HttpServer.Static('dist/q-sys-angular-components', { chunked = false }))

-- WebSocket endpoint for component discovery
server:ws('/ws/discovery', function(ws)
  print('WebSocket client connected to /ws/discovery')

  -- Function to discover all components and controls
  local function discoverComponents()
    local components = Component.GetComponents()
    local discoveryData = {
      timestamp = os.date("%Y-%m-%dT%H:%M:%S"),
      totalComponents = #components,
      components = {}
    }

    print("Starting component discovery via WebSocket...")
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

    return discoveryData
  end

  -- Send discovery data when client connects
  local discoveryData = discoverComponents()

  -- Encode as JSON
  local jsonOutput = json.encode(discoveryData, { pretty = false })

  print("Component Discovery Complete - sending " .. #jsonOutput .. " bytes via WebSocket")

  -- Send via WebSocket (the library handles large payloads)
  ws:Write({
    type = "discovery",
    data = discoveryData
  })

  -- Handle client disconnection
  ws.Closed = function()
    print('WebSocket client disconnected from /ws/discovery')
  end
end)

-- WebSocket endpoint for real-time component updates
server:ws('/ws/updates', function(ws)
  print('WebSocket client connected to /ws/updates')

  -- Track which components/controls the client is subscribed to
  local subscriptions = {}

  -- Handle incoming messages from client
  -- Note: This library doesn't expose incoming WebSocket messages easily
  -- You may need to enhance it or use a different approach

  -- For now, just acknowledge connection
  ws:Write({
    type = "connected",
    message = "Real-time updates endpoint ready"
  })

  ws.Closed = function()
    print('WebSocket client disconnected from /ws/updates')
  end
end)

-- HTTP endpoint for component list (lightweight)
server:get('/api/components', function(req, res)
  local components = Component.GetComponents()
  local componentList = {}

  for _, comp in ipairs(components) do
    -- Get control count only
    local controlCount = 0
    local success, controls = pcall(function()
      return Component.GetControls(comp.Name)
    end)

    if success and controls then
      controlCount = #controls
    end

    table.insert(componentList, {
      name = comp.Name,
      type = comp.Type,
      controlCount = controlCount
    })
  end

  res:send({
    totalComponents = #componentList,
    components = componentList
  })
end)

-- HTTP endpoint for specific component's controls
server:get('/api/components/:componentName/controls', function(req, res)
  local componentName = req.params.componentName

  local success, controls = pcall(function()
    return Component.GetControls(componentName)
  end)

  if not success or not controls then
    res:status(404):send({
      error = "Component not found or no controls available"
    })
    return
  end

  local controlList = {}
  for _, ctrl in ipairs(controls) do
    table.insert(controlList, {
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

  res:send({
    componentName = componentName,
    controlCount = #controlList,
    controls = controlList
  })
end)

-- Start server on port 8080
server:listen(8080)
print('HTTP Server with WebSocket support started on port 8080')
print('WebSocket endpoint: ws://[CORE-IP]:8080/ws/discovery')
print('HTTP API endpoint: http://[CORE-IP]:8080/api/components')

-- ========== END: WebSocket Component Discovery ==========
