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
require 'qsys-http-server'

-- Create HTTP server
local server = HttpServer.New()

-- Middleware
server:use(HttpServer.cors())
server:use(HttpServer.json())

-- Serve static files from dist directory
--server:use('/', HttpServer.Static('dist/q-sys-angular-components'))
function UpdateDirectory() 
  server:use(HttpServer.Static((System.IsEmulating and 'design' or 'media')..'/'..Controls['root-directory'].String)) 
end
UpdateDirectory()
Controls['root-directory'].EventHandler = UpdateDirectory

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

        -- Note: We don't fetch Choices in WebSocket discovery to avoid errors
        -- Choices will be fetched via HTTP API when a specific component is selected

        -- Iterate through each control
        for _, ctrl in ipairs(controls) do
          table.insert(componentData.controls, {
            name = ctrl.Name,
            type = ctrl.Type or "Text",
            direction = ctrl.Direction or "Read/Write",
            value = type(ctrl.Value) == "number" and ctrl.Value or nil,
            valueMin = type(ctrl.ValueMin) == "number" and ctrl.ValueMin or nil,
            valueMax = type(ctrl.ValueMax) == "number" and ctrl.ValueMax or nil,
            position = type(ctrl.Position) == "number" and ctrl.Position or nil,
            string = type(ctrl.String) == "string" and ctrl.String or "",
            choices = nil  -- Choices will be fetched via HTTP when component is selected
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

-- Track active WebSocket connections for component updates
local activeUpdateConnections = {}

-- WebSocket endpoint for real-time component updates
server:ws('/ws/updates', function(ws)
  print('WebSocket client connected to /ws/updates')

  -- Add this connection to active connections
  table.insert(activeUpdateConnections, ws)

  -- For now, just acknowledge connection
  ws:Write({
    type = "connected",
    message = "Real-time updates endpoint ready"
  })

  ws.Closed = function()
    print('WebSocket client disconnected from /ws/updates')
    -- Remove from active connections
    for i, conn in ipairs(activeUpdateConnections) do
      if conn == ws then
        table.remove(activeUpdateConnections, i)
        break
      end
    end
  end
end)

-- Table to store component subscriptions
local componentSubscriptions = {}

-- Function to subscribe to a component and broadcast updates
local function subscribeToComponent(componentName)
  if componentSubscriptions[componentName] then
    print("Re-subscribing to component: " .. componentName .. " (clearing old subscription)")
    -- Clear old EventHandlers by setting them to nil
    local oldComponent = componentSubscriptions[componentName]
    local oldControlMetadata = Component.GetControls(componentName)
    for _, ctrlMeta in ipairs(oldControlMetadata) do
      pcall(function()
        local control = oldComponent[ctrlMeta.Name]
        if control then
          control.EventHandler = nil
        end
      end)
    end
    componentSubscriptions[componentName] = nil
  end

  local success, component = pcall(function()
    return Component.New(componentName)
  end)

  if not success or not component then
    print("Failed to subscribe to component: " .. componentName .. " - Error: " .. tostring(component))
    return
  end

  print("Setting up EventHandlers for component: " .. componentName)

  -- Get all control metadata to set up individual EventHandlers
  local controlMetadata = Component.GetControls(componentName)

  -- Function to broadcast all control updates
  local function broadcastControlUpdates()
    -- Get a fresh component instance for accessing current control values
    local currentComponent = Component.New(componentName)

    -- Build updated control list with current values
    local updatedControls = {}
    for _, ctrlMeta in ipairs(controlMetadata) do
      local success, controlData = pcall(function()
        local actualControl = currentComponent[ctrlMeta.Name]
        if not actualControl then
          return nil
        end

        -- Safely extract choices if available
        local choices = nil
        pcall(function()
          if actualControl.Choices and type(actualControl.Choices) == "table" then
            choices = {}
            for _, choice in ipairs(actualControl.Choices) do
              if type(choice) == "string" or type(choice) == "number" then
                table.insert(choices, tostring(choice))
              end
            end
          end
        end)

        -- Determine control type
        local controlType = ctrlMeta.Type or "Text"
        if choices and #choices > 0 then
          controlType = "Combo box"
        end

        -- Safely get control values
        local safeValue = nil
        local safePosition = nil
        local safeString = ""

        pcall(function()
          if type(actualControl.Value) == "number" then
            safeValue = actualControl.Value
          end
        end)

        pcall(function()
          if type(actualControl.Position) == "number" then
            safePosition = actualControl.Position
          end
        end)

        pcall(function()
          if type(actualControl.String) == "string" then
            safeString = actualControl.String
          end
        end)

        return {
          name = ctrlMeta.Name,
          type = controlType,
          direction = ctrlMeta.Direction or "Read/Write",
          value = safeValue,
          position = safePosition,
          string = safeString,
          choices = choices
        }
      end)

      if success and controlData then
        table.insert(updatedControls, controlData)
      end
    end

    print("Broadcasting update for " .. componentName .. " with " .. #updatedControls .. " controls to " .. #activeUpdateConnections .. " clients")

    -- Broadcast update to all connected clients
    for _, ws in ipairs(activeUpdateConnections) do
      if ws.IsConnected then
        ws:Write({
          type = "componentUpdate",
          componentName = componentName,
          controls = updatedControls
        })
      end
    end
  end

  -- Set up EventHandler for each control
  local eventHandlerCount = 0
  for _, ctrlMeta in ipairs(controlMetadata) do
    local controlSuccess = pcall(function()
      local control = component[ctrlMeta.Name]
      if control then
        control.EventHandler = function()
          print("Control changed: " .. componentName .. "." .. ctrlMeta.Name)
          broadcastControlUpdates()
        end
        eventHandlerCount = eventHandlerCount + 1
      end
    end)
  end

  componentSubscriptions[componentName] = component
  print("✓ Successfully subscribed to component: " .. componentName .. " (" .. eventHandlerCount .. " controls)")
end

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
  -- URL decode the component name
  local componentName = req.params.componentName:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end)

  print("Fetching controls for component: " .. componentName)

  local success, controls = pcall(function()
    return Component.GetControls(componentName)
  end)

  if not success or not controls then
    print("Failed to get controls for " .. componentName)
    res:status(404)
    res:set('Content-Type', 'application/json')
    res:send('{"error":"Component not found or no controls available"}')
    return
  end

  print("Got " .. #controls .. " controls for " .. componentName)

  -- Get the component instance to access actual control properties including Choices
  local component = Component.New(componentName)
  local controlList = {}
  for i, ctrl in ipairs(controls) do
    -- Try to encode each control individually to find the problematic one
    local encodeSuccess, encodeResult = pcall(function()
      local safeCtrl = {}

      -- Only include basic string/number fields, exclude everything else
      if ctrl.Name and type(ctrl.Name) == "string" then
        safeCtrl.name = ctrl.Name
      end

      -- Get the actual control to access Choices property
      local actualControl = component[ctrl.Name]

      -- Safely extract choices from the actual control (wrapped in pcall for script controls)
      local choices = nil
      if actualControl then
        pcall(function()
          if actualControl.Choices and type(actualControl.Choices) == "table" then
            choices = {}
            for _, choice in ipairs(actualControl.Choices) do
              -- Only include primitive values, skip complex objects
              if type(choice) == "string" or type(choice) == "number" then
                table.insert(choices, tostring(choice))
              end
            end
          end
        end)
      end

      -- Determine the control type - if it has choices, it's a combo box
      local controlType = ctrl.Type or "Text"
      if choices and #choices > 0 then
        controlType = "Combo box"
      end
      safeCtrl.type = controlType

      if ctrl.Direction and type(ctrl.Direction) == "string" then
        safeCtrl.direction = ctrl.Direction
      else
        safeCtrl.direction = "Read/Write"
      end

      -- Only include numeric values
      if type(ctrl.Value) == "number" then
        safeCtrl.value = ctrl.Value
      end

      if type(ctrl.ValueMin) == "number" then
        safeCtrl.valueMin = ctrl.ValueMin
      end

      if type(ctrl.ValueMax) == "number" then
        safeCtrl.valueMax = ctrl.ValueMax
      end

      if type(ctrl.Position) == "number" then
        safeCtrl.position = ctrl.Position
      end

      -- Get string value from actual control for combo boxes, otherwise from metadata
      if actualControl and choices and #choices > 0 then
        -- For combo boxes, get the current string value from the actual control
        local stringSuccess = pcall(function()
          if type(actualControl.String) == "string" then
            safeCtrl.string = actualControl.String
          end
        end)
        if not stringSuccess or not safeCtrl.string then
          safeCtrl.string = ""
        end
      elseif type(ctrl.String) == "string" then
        -- For other controls, use metadata
        safeCtrl.string = ctrl.String
      else
        safeCtrl.string = ""
      end

      -- Include choices if available
      if choices then
        safeCtrl.choices = choices
      end

      -- Test if this control can be encoded
      local testEncode = json.encode(safeCtrl)

      return safeCtrl
    end)

    if encodeSuccess then
      table.insert(controlList, encodeResult)
    else
      print("Skipping control #" .. i .. " (" .. tostring(ctrl.Name) .. ") - encoding failed: " .. tostring(encodeResult))
    end
  end

  -- Try to encode the final response
  local responseData = {
    componentName = componentName,
    controlCount = #controlList,
    controls = controlList
  }

  local encodeSuccess, jsonString = pcall(function()
    return json.encode(responseData)
  end)

  if not encodeSuccess then
    print("Error encoding final response for " .. componentName .. ": " .. tostring(jsonString))
    res:status(500)
    res:set('Content-Type', 'application/json')
    res:send('{"error":"Failed to encode control data"}')
    return
  end

  -- Verify jsonString is actually a string
  print("Encoded response type: " .. type(jsonString) .. ", length: " .. #jsonString)

  -- Build HTTP response manually to avoid middleware issues
  local httpResponse = "HTTP/1.1 200 OK\r\n"
  httpResponse = httpResponse .. "Content-Type: application/json\r\n"
  httpResponse = httpResponse .. "Content-Length: " .. #jsonString .. "\r\n"
  httpResponse = httpResponse .. "Access-Control-Allow-Origin: *\r\n"
  httpResponse = httpResponse .. "Connection: close\r\n"
  httpResponse = httpResponse .. "\r\n"
  httpResponse = httpResponse .. jsonString

  -- Send raw HTTP response - get socket via rawget like WebSocket handler does
  local socket = rawget(res, 'socket')
  socket:Write(httpResponse)
  print("Send completed successfully")

  -- Subscribe to this component for future updates
  subscribeToComponent(componentName)
end)

-- HTTP endpoint to set a control value
server:post('/api/components/:componentName/controls/:controlName', function(req, res)
  -- URL decode the component and control names
  local componentName = req.params.componentName:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end)
  local controlName = req.params.controlName:gsub("%%(%x%x)", function(hex)
    return string.char(tonumber(hex, 16))
  end)

  print("Setting control: " .. componentName .. "." .. controlName)

  -- Get the value from request body
  local value = req.body and req.body.value

  if value == nil then
    res:status(400)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Missing value in request body"}')
    return
  end

  -- Get the component
  local success, component = pcall(function()
    return Component.New(componentName)
  end)

  if not success or not component then
    print("Component not found: " .. componentName)
    res:status(404)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Component not found"}')
    return
  end

  -- Get the control
  local control = component[controlName]
  if not control then
    print("Control not found: " .. controlName .. " on component: " .. componentName)
    print("Available controls on this component:")
    local controls = Component.GetControls(componentName)
    for i, ctrl in ipairs(controls) do
      print("  - " .. ctrl.Name)
      if i > 10 then
        print("  ... (showing first 10 of " .. #controls .. " controls)")
        break
      end
    end
    res:status(404)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Control not found"}')
    return
  end

  -- Set the control value based on its type
  local setSuccess, setError = pcall(function()
    print('control.Type: '..control.Type..', control.Value.Type: '..type(control.Value))
    print('value.Type: '..type(value)..', value: '..tostring(value))
    if control.Choices and #control.Choices>0 then -- Combo control
      print('Combo control.Choices ['..table.concat(control.Choices, ',')..']')
      control.String = tostring(value)
    elseif control.Type=='Text' then -- String control
      print('String control')
      control.String = tostring(value)
    elseif control.Type=='Trigger' then -- Trigger control
      print('control:Trigger()')
      control:Trigger()
    elseif control.Type=='Boolean' then --Momentary or Toggle
      print('Boolean control')
      control.Boolean = value
    elseif control.Type=='Knob' then -- Knob/Fader control (uses Position 0-1)
      print('Knob control - setting Position to '..tostring(value))
      control.Position = value
    elseif control.Type=='Float' or control.Type=='Integer' then -- Numeric input control (uses Value)
      print('Numeric control - setting Value to '..tostring(value))
      control.Value = value
    elseif control.Type=='State Trigger' then -- State Trigger control
      print('State Trigger control')
      control.Value = value
      control:Trigger()
    else
      -- Default: try setting Value for numeric types, otherwise treat as string
      if type(value) == "number" then
        print('Unspecified numeric control - setting Value')
        control.Value = value
      else
        print('Unspecified control type - treating as string')
        control.String = tostring(value)
      end
    end
  end)


  if not setSuccess then
    print("Failed to set control: " .. tostring(setError))
    res:status(500)
    res:set('Content-Type', 'application/json')
    local socket = rawget(res, 'socket')
    socket:Write('HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"error":"Failed to set control"}')
    return
  end

  print("Control set successfully")

  -- Send success response
  local socket = rawget(res, 'socket')
  socket:Write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{"success":true}')
end)

-- Start server
function Listen()
  if Controls.port.Value == 0 then Controls.port.Value = 9091 end
  server:listen(Controls.port.Value)
end
Controls.port.EventHandler = Listen
Listen()

print(('HTTP Server with WebSocket support started on port %.f'):format(Controls.port.Value))
print(('WebSocket endpoint: ws://[CORE-IP]:%.f/ws/discovery'):format(Controls.port.Value))
print(('HTTP API endpoint: http://[CORE-IP]:%.f/api/components'):format(Controls.port.Value))

-- ========== END: WebSocket Component Discovery ==========
