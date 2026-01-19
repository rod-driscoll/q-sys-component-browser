import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface LuaScript {
  name: string;
  fileName: string;
  content: string;
}

interface LuaScriptMetadata {
  name: string;
  fileName: string;
}

@Injectable({
  providedIn: 'root',
})
export class LuaScriptService {
  private http = inject(HttpClient);
  private scripts: LuaScript[] = [];
  private scriptsLoaded = false;

  /**
   * Script metadata - defines which Lua files to load and their display names
   */
  private scriptMetadata: LuaScriptMetadata[] = [
    {
      name: 'WebSocket Component Discovery',
      fileName: 'TunnelDiscovery.lua',
    },
    {
      name: 'Get System Information',
      fileName: 'GetSystemInformation.lua',
    },
    {
      name: 'Discover Components and Controls',
      fileName: 'DiscoverComponentsAndControls.lua',
    },
    {
      name: 'Get UCI Layers',
      fileName: 'GetUCILayers.lua',
    },
  ];

  /**
   * Load Lua scripts from files
   * Returns a promise that resolves when all scripts are loaded
   */
  async loadScripts(): Promise<void> {
    if (this.scriptsLoaded) {
      return;
    }

    try {
      // Load all scripts in parallel
      const scriptPromises = this.scriptMetadata.map(async (metadata) => {
        try {
          const content = await firstValueFrom(
            this.http.get(`/lua/${metadata.fileName}`, { responseType: 'text' })
          );
          return {
            name: metadata.name,
            fileName: metadata.fileName,
            content: content,
          };
        } catch (error) {
          console.error(`Failed to load Lua script: ${metadata.fileName}`, error);
          // Return a placeholder script if loading fails
          return {
            name: metadata.name,
            fileName: metadata.fileName,
            content: `-- Error: Failed to load ${metadata.fileName}\n-- Please check that the file exists in the lua/ directory`,
          };
        }
      });

      this.scripts = await Promise.all(scriptPromises);
      this.scriptsLoaded = true;
      console.log(`Loaded ${this.scripts.length} Lua scripts`);
    } catch (error) {
      console.error('Failed to load Lua scripts:', error);
      this.scripts = [];
    }
  }

  /**
   * Get all available Lua scripts
   * Loads scripts from files if not already loaded
   */
  async getAvailableScripts(): Promise<LuaScript[]> {
    if (!this.scriptsLoaded) {
      await this.loadScripts();
    }
    return this.scripts;
  }

  /**
   * Generate delimiter for a script
   */
  private getScriptDelimiter(scriptName: string, isStart: boolean): string {
    const marker = isStart ? 'START' : 'END';
    return `-- ========== ${marker}: ${scriptName} ==========`;
  }

  /**
   * Check if a script is already present in the code
   */
  isScriptPresent(code: string, scriptName: string): boolean {
    const startDelimiter = this.getScriptDelimiter(scriptName, true);
    return code.includes(startDelimiter);
  }

  /**
   * Insert or replace a script in the code control
   * If the script already exists (detected by delimiter), it replaces it
   * Otherwise, it appends the script with delimiters
   */
  insertScript(existingCode: string, script: LuaScript): string {
    const startDelimiter = this.getScriptDelimiter(script.name, true);
    const endDelimiter = this.getScriptDelimiter(script.name, false);

    // Check if script already exists
    if (this.isScriptPresent(existingCode, script.name)) {
      // Replace existing script
      return this.replaceScript(existingCode, script);
    }

    // Append new script
    const wrappedScript = `\n${startDelimiter}\n${script.content}\n${endDelimiter}\n`;

    if (!existingCode || existingCode.trim() === '') {
      // If code is empty, just add the script without leading newline
      return `${startDelimiter}\n${script.content}\n${endDelimiter}`;
    }

    // Append to existing code
    return existingCode + wrappedScript;
  }

  /**
   * Replace an existing script in the code
   */
  private replaceScript(code: string, script: LuaScript): string {
    const startDelimiter = this.getScriptDelimiter(script.name, true);
    const endDelimiter = this.getScriptDelimiter(script.name, false);

    // Find the start and end positions
    const startIndex = code.indexOf(startDelimiter);
    const endIndex = code.indexOf(endDelimiter);

    if (startIndex === -1 || endIndex === -1) {
      // Delimiters not found, shouldn't happen but handle gracefully
      return this.insertScript(code, script);
    }

    // Calculate the end position (include the end delimiter and its newline)
    const endPosition = endIndex + endDelimiter.length;

    // Replace the old script with the new one
    const before = code.substring(0, startIndex);
    const after = code.substring(endPosition);

    const wrappedScript = `${startDelimiter}\n${script.content}\n${endDelimiter}`;

    return before + wrappedScript + after;
  }

  /**
   * Remove a script from the code control
   */
  removeScript(code: string, scriptName: string): string {
    const startDelimiter = this.getScriptDelimiter(scriptName, true);
    const endDelimiter = this.getScriptDelimiter(scriptName, false);

    // Check if script exists
    if (!this.isScriptPresent(code, scriptName)) {
      return code;
    }

    // Find the start and end positions
    const startIndex = code.indexOf(startDelimiter);
    const endIndex = code.indexOf(endDelimiter);

    if (startIndex === -1 || endIndex === -1) {
      return code;
    }

    // Calculate positions to remove (include newlines)
    let removeStart = startIndex;
    let removeEnd = endIndex + endDelimiter.length;

    // Check if there's a newline before the start delimiter and remove it too
    if (removeStart > 0 && code[removeStart - 1] === '\n') {
      removeStart--;
    }

    // Check if there's a newline after the end delimiter and remove it too
    if (removeEnd < code.length && code[removeEnd] === '\n') {
      removeEnd++;
    }

    // Remove the script block
    const before = code.substring(0, removeStart);
    const after = code.substring(removeEnd);

    return before + after;
  }
}
