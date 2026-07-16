import { useState, useEffect } from 'react';

export interface District {
  id: string;
  name: string;
  color: string;
  center_x: number;
  center_z: number;
}

export interface Building {
  id: string;
  node_id: string;
  district_id: string;
  title: string;
  summary: string;
  content_type: string;
  importance: number;
  visits_count: number;
  health_status: string;
  x: number;
  y: number;
  z: number;
  height: number;
  width: number;
  depth: number;
  color: string;
  style_type: string;
  abandoned: boolean;
}

export interface Road {
  id: string;
  source: { x: number; z: number };
  target: { x: number; z: number };
  rel_type: string;
}

export interface CityState {
  districts: District[];
  buildings: Building[];
  roads: Road[];
}

export interface ChatMessage {
  sender: 'user' | 'agent';
  agentName: string;
  text: string;
}

// Global state observer list for reactive triggers
type Listener = () => void;
let listeners: Listener[] = [];

// Base State cache
let state = {
  districts: [] as District[],
  buildings: [] as Building[],
  roads: [] as Road[],
  selectedBuilding: null as Building | null,
  activeWeather: "sunny" as string,
  searchQuery: "",
  chatLogs: {} as Record<string, ChatMessage[]>,
  timeTravelMode: false,
  timeTravelIndex: 10,  // 10 is Present
  isUploading: false,
  logs: [] as string[]
};

// State update emitter
function updateState(updater: Partial<typeof state> | ((prev: typeof state) => Partial<typeof state>)) {
  const next = typeof updater === 'function' ? updater(state) : updater;
  state = { ...state, ...next };
  listeners.forEach(l => l());
}

export const store = {
  getState() {
    return state;
  },
  
  subscribe(listener: Listener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  async fetchCity() {
    try {
      const res = await fetch('/api/city');
      const data: CityState = await res.json();
      
      // Determine overall city weather based on average node weather status
      const weathers = data.buildings.map(b => b.health_status);
      const unique = Array.from(new Set(weathers));
      const majorWeather = unique.sort((a,b) => 
        weathers.filter(w => w===b).length - weathers.filter(w => w===a).length
      )[0] || "sunny";

      updateState({
        districts: data.districts,
        buildings: data.buildings,
        roads: data.roads,
        activeWeather: majorWeather,
        logs: [...state.logs, "City grid loaded successfully."]
      });
    } catch (err) {
      console.error("Failed to load memory city structures", err);
    }
  },

  async visitNode(building: Building) {
    try {
      await fetch(`/api/nodes/${building.node_id}/visit`, { method: 'POST' });
      // Reload city details
      await this.fetchCity();
      // Re-fetch local cache reference
      const updated = state.buildings.find(b => b.id === building.id) || null;
      updateState({ selectedBuilding: updated });
    } catch (err) {
      console.error("Error logging building visit", err);
    }
  },

  async uploadKnowledge(title: string | null, content: string | null, file: File | null) {
    updateState({ isUploading: true });
    try {
      const formData = new FormData();
      if (title) formData.append("title", title);
      if (content) formData.append("content", content);
      if (file) formData.append("file", file);

      const res = await fetch('/api/nodes/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        updateState({ logs: [...state.logs, `Successfully constructed node: ${title || "Document"}`] });
        await this.fetchCity();
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      updateState({ isUploading: false });
    }
  },

  async sendAgentChat(agent: string, message: string) {
    if (!state.selectedBuilding) return;
    const bId = state.selectedBuilding.id;
    const currentChat = state.chatLogs[bId] || [];
    
    // Add user message
    const userMsg: ChatMessage = { sender: 'user', agentName: 'You', text: message };
    const nextChat = [...currentChat, userMsg];
    updateState({
      chatLogs: { ...state.chatLogs, [bId]: nextChat }
    });

    try {
      const res = await fetch(`/api/chat?agent=${agent}&node_id=${state.selectedBuilding.node_id}&message=${encodeURIComponent(message)}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      // Add response
      const agentMsg: ChatMessage = { sender: 'agent', agentName: agent, text: data.response };
      updateState({
        chatLogs: { ...state.chatLogs, [bId]: [...nextChat, agentMsg] }
      });
    } catch (err) {
      console.error("Agent chat failed", err);
    }
  },

  setSelectedBuilding(building: Building | null) {
    updateState({ selectedBuilding: building });
    if (building) {
      this.visitNode(building);
    }
  },

  async restoreNode(building: Building) {
    try {
      const res = await fetch(`/api/nodes/${building.node_id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        this.addLog(`⛏️ Excavated and restored: ${building.title}`);
        await this.fetchCity();
        const updated = state.buildings.find(b => b.id === building.id) || null;
        updateState({ selectedBuilding: updated });
      }
    } catch (err) {
      console.error("Error restoring building", err);
    }
  },

  connectExternalCity() {
    if (state.districts.some(d => d.id === 'external_philosophy')) {
      this.addLog("🌉 External bridge already established.");
      return;
    }

    const extDistrict: District = {
      id: 'external_philosophy',
      name: 'External Mind (P2P)',
      color: '#a855f7',
      center_x: -80.0,
      center_z: -80.0
    };

    const extBuildings: Building[] = [
      {
        id: 'bld_ext_1',
        node_id: 'ext_1',
        district_id: 'external_philosophy',
        title: 'P2P Philosophy Library',
        summary: 'Collaborative knowledge node shared from Vijay\'s peer node detailing Eastern Philosophy and modern ethics.',
        content_type: 'markdown',
        importance: 0.85,
        visits_count: 5,
        health_status: 'sunny',
        x: -70.0,
        y: 0.0,
        z: -70.0,
        height: 8.0,
        width: 3.5,
        depth: 3.5,
        color: '#a855f7',
        style_type: 'building',
        abandoned: false
      },
      {
        id: 'bld_ext_2',
        node_id: 'ext_2',
        district_id: 'external_philosophy',
        title: 'Decentralized Ethics Tower',
        summary: 'Dynamic peer ledger documenting ethical frameworks for AI agents and distributed consensus protocols.',
        content_type: 'code',
        importance: 0.95,
        visits_count: 12,
        health_status: 'rainbow',
        x: -90.0,
        y: 0.0,
        z: -90.0,
        height: 12.0,
        width: 4.0,
        depth: 4.0,
        color: '#a855f7',
        style_type: 'skyscraper',
        abandoned: false
      }
    ];

    const extRoads: Road[] = [
      {
        id: 'road_bridge_p2p',
        source: { x: 0.0, z: 0.0 },
        target: { x: -80.0, z: -80.0 },
        rel_type: 'P2P_BRIDGE'
      },
      {
        id: 'road_ext_internal',
        source: { x: -70.0, z: -70.0 },
        target: { x: -90.0, z: -90.0 },
        rel_type: 'RELATED_TO'
      }
    ];

    updateState({
      districts: [...state.districts, extDistrict],
      buildings: [...state.buildings, ...extBuildings],
      roads: [...state.roads, ...extRoads]
    });
    this.addLog("🌉 Peer-to-Peer bridge successfully built to 'External Mind'!");
  },

  setSearchQuery(query: string) {
    updateState({ searchQuery: query });
  },

  setTimeTravel(mode: boolean, index: number) {
    // Simulated time-travel filtering. In a full system, this would filter database objects.
    updateState({ timeTravelMode: mode, timeTravelIndex: index });
  },

  addLog(log: string) {
    updateState({ logs: [log, ...state.logs].slice(0, 15) });
  }
};

// React hook to use the store reactive state
export function useCityStore() {
  const [storeState, setStoreState] = useState(state);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setStoreState(state);
    });
    return unsub;
  }, []);

  return storeState;
}
