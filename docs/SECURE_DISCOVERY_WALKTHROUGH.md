# Secure Component Discovery Walkthrough

I have implemented the Secure Component Discovery feature on the `feature/secure-discovery` branch.
This solution allows the browser application to communicate with the Q-SYS Lua script securely via QRC tunneling, bypassing the insecure HTTP/WebSocket server while maintaining backward compatibility.

## Architecture Overview

### 1. Dual-Mode Lua Script (`lua/WebSocketComponentDiscovery.lua`)
The script now operates in two concurrent modes:
*   **Legacy Mode**: The TCP Server on port 9091 (or configured port) remains active for backward compatibility or dev use.
*   **Secure Mode**: The script checks for the presence of `Controls.json_output` and `Controls.trigger_update`.
    *   If present, it binds to them to provide a secure data tunnel.
    *   It uses **Chunking** to handle JSON payloads larger than the Text Control limit.

### 2. Zero-Config Client Discovery (`src/app/services/websocket-discovery.service.ts`)
The Angular client no longer hardcodes the WebSocket URL. Instead:
1.  **Search**: It actively scans components with type **`device_controller_script`**, reading their `code` control to find the `WebSocketComponentDiscovery.lua` signature.
2.  **Bind**: Once found (e.g., named "webserver"), it directly addresses that component's `json_output` and `trigger_update` controls to establish the secure tunnel.
3.  **No Named Controls Required**: You do not need to create global Named Controls.

## Configuration Steps (Required)

To enable the secure tunnel, you must update your Q-SYS Design:

1.  **Update Script**: Copy the new content of `lua/WebSocketComponentDiscovery.lua` into your Q-SYS Script component.
2.  **Add Controls**:
    *   Add a **Text** Output Control named `json_output`.
    *   Add a **Trigger** Input Control named `trigger_update`.
3.  **Push to Core**: Save and run the design.

## Verification

1.  **Run the Angular App**.
2.  Open the Browser Console.
3.  You should see logs indicating:
    *   "Initiating Secure Component Discovery (No Named Controls)..."
    *   "Scanning... Found script in 'Script_Name'..."
    *   "Secure Tunnel Established"
4.  **Verify UI**: The discovery happens automatically. You should see "Using Secure Discovery" or similar logs, and any script-provided components will appear in the list.

## Changes Summary

| File | Change |
| :--- | :--- |
| `lua/WebSocketComponentDiscovery.lua` | Added secure discovery overlay logic & shared JSON generator. |
| `src/app/services/websocket-discovery.service.ts` | Replaced WebSocket transport with QRC Scanner & Direct Control binding. |
| `src/app/services/qsys.service.ts` | Exposed `setControlViaRpc` as public for use by discovery service. |
| `src/environments/environment.ts` | Removed insecure port configuration. |
