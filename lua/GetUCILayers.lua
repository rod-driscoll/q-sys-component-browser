
--[[
  GetUCILayers()

  Reads the UCIs.xml file to discover all UCI files, then parses each UCI file
  to extract all pages and layers.

  Returns: UCILayers table with structure:
  {
    ["UCI Name"] = {
      fileName = "1.UCI.xml",
      pages = {
        ["Page Title"] = {
          "Layer 1",
          "Layer 2",
          ...
        }
      }
    }
  }
]]

-- Configuration: Set to false to disable all print statements
local ENABLE_DEBUG_PRINT = false

-- Helper function for debug printing
local function debugPrint(...)
  if ENABLE_DEBUG_PRINT then
    print(...)
  end
end

function GetUCILayers()
  local UCILayers = {}

  -- Step 1: Read UCIs.xml to find all UCI files
  local ucisFilePath = "design/UCIs.xml"
  debugPrint("Reading UCIs index file: " .. ucisFilePath)

  local ucisFile = io.open(ucisFilePath, "r")
  if not ucisFile then
    debugPrint("ERROR: Could not open file: " .. ucisFilePath)
    return UCILayers
  end

  local ucisContent = ucisFile:read("*all")
  ucisFile:close()

  -- Step 2: Extract all UCI elements with Name and FileName attributes
  local uciCount = 0
  for uciName, fileName in ucisContent:gmatch('<UCI[^>]*Name="([^"]+)"[^>]*FileName="([^"]+)"') do
    uciCount = uciCount + 1
    debugPrint("Found UCI: " .. uciName .. " -> " .. fileName)

    -- Initialize UCI entry in the table
    UCILayers[uciName] = {
      fileName = fileName,
      pages = {}
    }

    -- Step 3: Read the UCI file
    local uciFilePath = "design/UCIs/" .. fileName
    debugPrint("  Reading UCI file: " .. uciFilePath)

    local uciFile = io.open(uciFilePath, "r")
    if not uciFile then
      debugPrint("  ERROR: Could not open file: " .. uciFilePath)
      UCILayers[uciName].error = "Could not open file"
    else
      local xmlContent = uciFile:read("*all")
      uciFile:close()

      -- Step 4: Parse pages and layers
      local currentPos = 1
      local pageCount = 0

      while true do
        -- Find the next <Page Title="..." tag
        local pageStart, pageEnd, pageTitle = xmlContent:find('<Page%s+Title="([^"]+)"[^>]*>', currentPos)

        if not pageStart then
          break -- No more pages found
        end

        pageCount = pageCount + 1
        debugPrint("    Page: " .. pageTitle)

        -- Initialize page entry in the table
        UCILayers[uciName].pages[pageTitle] = {}

        -- Find the corresponding </Page> tag
        local pageCloseStart = xmlContent:find('</Page>', pageEnd)

        if pageCloseStart then
          -- Extract the content between the Page tags
          local pageContent = xmlContent:sub(pageEnd + 1, pageCloseStart - 1)

          -- Find all Layer elements within this page's content
          local layerCount = 0
          for layerName in pageContent:gmatch('<Layer%s+Name="([^"]+)"') do
            layerCount = layerCount + 1
            table.insert(UCILayers[uciName].pages[pageTitle], layerName)
            debugPrint("      Layer " .. layerCount .. ": " .. layerName)
          end

          if layerCount == 0 then
            debugPrint("      (No layers found)")
          end

          -- Move past this page to find the next one
          currentPos = pageCloseStart + 1
        else
          -- Self-closing or malformed page tag
          currentPos = pageEnd + 1
        end
      end

      debugPrint("  Total pages in " .. uciName .. ": " .. pageCount)
    end

    debugPrint("")
  end

  debugPrint("=== Summary ===")
  debugPrint("Total UCIs found: " .. uciCount)
  debugPrint("===============")

  return UCILayers
end

-- Example usage: Call the function and store the result
local UCILayers = GetUCILayers()

-- Print a single UCI's structure
-- @param uciName: The name of the UCI to print
function PrintUCI(uciName)
  local uciData = UCILayers[uciName]

  if not uciData then
    print("ERROR: UCI '" .. uciName .. "' not found")
    return
  end

  print("UCI: " .. uciName .. " (" .. uciData.fileName .. ")")
  if uciData.error then
    print("  ERROR: " .. uciData.error)
  else
    for pageTitle, layers in pairs(uciData.pages) do
      print("  Page: " .. pageTitle)
      for _, layerName in ipairs(layers) do
        print("    Layer: " .. layerName)
      end
    end
  end
end

-- Print all UCIs' structure
function PrintAllUCILayers()
  debugPrint("")
  debugPrint("=== Complete UCI Structure ===")
  for uciName, _ in pairs(UCILayers) do
    PrintUCI(uciName)
  end
  debugPrint("==============================")
end

--PrintAllUCILayers()
PrintUCI(UCI_NAME)
