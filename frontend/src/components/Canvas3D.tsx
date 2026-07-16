import React, { useRef, useEffect, useState } from 'react';
import { useCityStore, Building, Road } from '../store';
import { CloudRain, Sun, CloudSnow, AlertTriangle, CloudFog, CloudLightning } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  speed: number;
  size: number;
  angle?: number;
}

export const Canvas3D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { districts, buildings, roads, selectedBuilding, activeWeather, searchQuery, timeTravelIndex, timeTravelMode } = useCityStore();
  
  // View controls
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(2.2);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  // Target coordinates for camera smooth transition (lerp)
  const cameraTarget = useRef<{ x: number; z: number } | null>(null);

  // Weather particles cache
  const weatherParticles = useRef<Particle[]>([]);
  const frameId = useRef<number>(0);

  // Initialize weather particles
  useEffect(() => {
    const list: Particle[] = [];
    for (let i = 0; i < 120; i++) {
      list.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speed: 3 + Math.random() * 5,
        size: 1 + Math.random() * 3,
        angle: Math.random() * 0.2 - 0.1
      });
    }
    weatherParticles.current = list;
  }, [activeWeather]);

  // Center view on selected building
  useEffect(() => {
    if (selectedBuilding) {
      cameraTarget.current = { x: selectedBuilding.x, z: selectedBuilding.z };
    }
  }, [selectedBuilding]);

  // Handle Drag / Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
      // Cancel active camera target movement if user drags
      cameraTarget.current = null;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scale = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.max(0.8, Math.min(6, prev * scale)));
  };

  // 3D Isometric projection mapping (World space -> Screen space)
  const project = (x: number, y: number, z: number, width: number, height: number, panX: number, panY: number, currentZoom: number) => {
    const isoAngle = Math.PI / 6; // 30 degrees
    const cx = width / 2 + panX;
    const cy = height / 2 + panY;
    
    // Rotate slightly if desired, or default isometric projection
    const screenX = cx + (x - z) * Math.cos(isoAngle) * currentZoom;
    const screenY = cy + (x + z) * Math.sin(isoAngle) * currentZoom - y * currentZoom;
    
    return { x: screenX, y: screenY };
  };

  // Frame Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Dynamic data variables
    let animationAge = 0;

    const draw = () => {
      animationAge += 1;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Smooth camera pan to target (lerp)
      if (cameraTarget.current) {
        const targetProj = project(cameraTarget.current.x, 0, cameraTarget.current.z, w, h, 0, 0, zoom);
        const screenCenterX = w / 2;
        const screenCenterY = h / 2;
        
        // Calculate needed pan to center on the projected coordinates
        const targetPanX = screenCenterX - (targetProj.x);
        const targetPanY = screenCenterY - (targetProj.y);

        setPan(prev => {
          const dx = targetPanX - prev.x;
          const dy = targetPanY - prev.y;
          // Stop moving if close enough
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            cameraTarget.current = null;
            return prev;
          }
          return {
            x: prev.x + dx * 0.1,
            y: prev.y + dy * 0.1
          };
        });
      }

      // Filter buildings based on time travel (older states hide newer assets)
      const filteredBuildings = buildings.filter((b, idx) => {
        if (!timeTravelMode) return true;
        // Map list index directly to time travel range
        const cut = Math.ceil((buildings.length * timeTravelIndex) / 10);
        return idx < cut;
      });

      // 1. Draw Grid
      ctx.strokeStyle = 'rgba(31, 36, 56, 0.3)';
      ctx.lineWidth = 1;
      const gridCount = 20;
      const spacing = 15;
      for (let i = -gridCount; i <= gridCount; i++) {
        const pStart1 = project(i * spacing, 0, -gridCount * spacing, w, h, pan.x, pan.y, zoom);
        const pEnd1 = project(i * spacing, 0, gridCount * spacing, w, h, pan.x, pan.y, zoom);
        ctx.beginPath();
        ctx.moveTo(pStart1.x, pStart1.y);
        ctx.lineTo(pEnd1.x, pEnd1.y);
        ctx.stroke();

        const pStart2 = project(-gridCount * spacing, 0, i * spacing, w, h, pan.x, pan.y, zoom);
        const pEnd2 = project(gridCount * spacing, 0, i * spacing, w, h, pan.x, pan.y, zoom);
        ctx.beginPath();
        ctx.moveTo(pStart2.x, pStart2.y);
        ctx.lineTo(pEnd2.x, pEnd2.y);
        ctx.stroke();
      }

      // 2. Draw Districts Bounds
      districts.forEach(d => {
        const dCenter = project(d.center_x, 0, d.center_z, w, h, pan.x, pan.y, zoom);
        
        ctx.beginPath();
        ctx.ellipse(dCenter.x, dCenter.y, 80 * zoom, 40 * zoom, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = `${d.color}22`;
        ctx.fillStyle = `${d.color}03`;
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        // Title Label
        ctx.font = `600 ${Math.max(10, 14 * (zoom/2))}px 'Outfit', sans-serif`;
        ctx.fillStyle = d.color;
        ctx.textAlign = 'center';
        ctx.fillText(d.name.toUpperCase(), dCenter.x, dCenter.y + 60 * zoom);
      });

      // 3. Draw Roads (Semantic Connections)
      roads.forEach(r => {
        const pSrc = project(r.source.x, 0, r.source.z, w, h, pan.x, pan.y, zoom);
        const pTgt = project(r.target.x, 0, r.target.z, w, h, pan.x, pan.y, zoom);

        ctx.beginPath();
        ctx.moveTo(pSrc.x, pSrc.y);
        ctx.lineTo(pTgt.x, pTgt.y);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 2 * (zoom / 2);
        ctx.stroke();

        // Data packet flow animation along roads
        const timeFraction = (animationAge % 120) / 120;
        const packetX = pSrc.x + (pTgt.x - pSrc.x) * timeFraction;
        const packetY = pSrc.y + (pTgt.y - pSrc.y) * timeFraction;

        ctx.beginPath();
        ctx.arc(packetX, packetY, 3 * (zoom / 2), 0, 2 * Math.PI);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      // 4. Draw Buildings (Isometric solid rendering)
      // Sort buildings from back to front (based on X + Z value) for painter's depth algorithm
      const sortedBuildings = [...filteredBuildings].sort((a, b) => (a.x + a.z) - (b.x + b.z));
      
      sortedBuildings.forEach(b => {
        // Highlight matching query
        const isMatched = searchQuery ? b.title.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        const isSelected = selectedBuilding && selectedBuilding.id === b.id;
        
        const opacity = isMatched ? 1.0 : 0.2;
        const bx = b.x;
        const bz = b.z;
        const by = 0;
        
        // Dimensions
        const bw = b.width;
        const bd = b.depth;
        const bh = b.height;

        // Draw points of Isometric Box
        const p0 = project(bx - bw/2, by, bz - bd/2, w, h, pan.x, pan.y, zoom);
        const p1 = project(bx + bw/2, by, bz - bd/2, w, h, pan.x, pan.y, zoom);
        const p2 = project(bx + bw/2, by, bz + bd/2, w, h, pan.x, pan.y, zoom);
        const p3 = project(bx - bw/2, by, bz + bd/2, w, h, pan.x, pan.y, zoom);

        const p4 = project(bx - bw/2, by + bh, bz - bd/2, w, h, pan.x, pan.y, zoom);
        const p5 = project(bx + bw/2, by + bh, bz - bd/2, w, h, pan.x, pan.y, zoom);
        const p6 = project(bx + bw/2, by + bh, bz + bd/2, w, h, pan.x, pan.y, zoom);
        const p7 = project(bx - bw/2, by + bh, bz + bd/2, w, h, pan.x, pan.y, zoom);

        // Styling colors with opacity
        const hex = b.color || '#3b82f6';
        ctx.globalAlpha = opacity;

        // Top Roof Face
        ctx.beginPath();
        ctx.moveTo(p4.x, p4.y);
        ctx.lineTo(p5.x, p5.y);
        ctx.lineTo(p6.x, p6.y);
        ctx.lineTo(p7.x, p7.y);
        ctx.closePath();
        ctx.fillStyle = hex;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();

        // Right Wall Face (Front Right)
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p6.x, p6.y);
        ctx.lineTo(p5.x, p5.y);
        ctx.closePath();
        ctx.fillStyle = shadeColor(hex, -20);
        ctx.fill();
        ctx.stroke();

        // Left Wall Face (Front Left)
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p7.x, p7.y);
        ctx.lineTo(p6.x, p6.y);
        ctx.closePath();
        ctx.fillStyle = shadeColor(hex, -40);
        ctx.fill();
        ctx.stroke();

        // Visual Weather Effect over building (e.g. snowy white cap, misty ruins, rain sparkles)
        if (b.health_status === "snow") {
          ctx.beginPath();
          ctx.moveTo(p4.x, p4.y);
          ctx.lineTo(p5.x, p5.y);
          ctx.lineTo(p6.x, p6.y);
          ctx.lineTo(p7.x, p7.y);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fill();
        }

        // Selection / Hover Neon highlights
        if (isSelected) {
          ctx.beginPath();
          ctx.moveTo(p4.x, p4.y);
          ctx.lineTo(p5.x, p5.y);
          ctx.lineTo(p6.x, p6.y);
          ctx.lineTo(p7.x, p7.y);
          ctx.closePath();
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3;
          ctx.stroke();
          
          // Draw vertical neon lines
          ctx.beginPath();
          ctx.moveTo(p2.x, p2.y);
          ctx.lineTo(p6.x, p6.y);
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p5.x, p5.y);
          ctx.moveTo(p3.x, p3.y);
          ctx.lineTo(p7.x, p7.y);
          ctx.strokeStyle = '#00f0ff';
          ctx.stroke();
          ctx.lineWidth = 1; // reset
        }

        // Label on Building
        if (zoom > 1.4) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `${isSelected ? '700' : '400'} ${Math.max(9, 11 * (zoom/2))}px 'Plus Jakarta Sans', sans-serif`;
          ctx.textAlign = 'center';
          
          // Draw subtle outline for text readability
          ctx.strokeStyle = '#0a0b10';
          ctx.lineWidth = 3;
          ctx.strokeText(b.title, p6.x, p6.y - 12);
          ctx.fillText(b.title, p6.x, p6.y - 12);
          
          // Small emoji or status icon indicators
          const emoji = b.health_status === "sunny" ? "☀️" : 
                        b.health_status === "rainbow" ? "🌈" : 
                        b.health_status === "rain" ? "🌧️" : 
                        b.health_status === "snow" ? "❄️" : 
                        b.health_status === "fog" ? "🌫️" : "⛈️";
          
          ctx.strokeText(emoji, p6.x, p6.y - 28);
          ctx.fillText(emoji, p6.x, p6.y - 28);
        }

        ctx.globalAlpha = 1.0;
      });

      // 5. Draw global Screen-space Weather Particles
      if (activeWeather === "rain" || activeWeather === "storm") {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1.5;
        weatherParticles.current.forEach(p => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + (p.angle || 0) * 15, p.y + 15);
          ctx.stroke();

          // Move down
          p.y += p.speed;
          p.x += (p.angle || 0) * p.speed;

          if (p.y > h) {
            p.y = -10;
            p.x = Math.random() * w;
          }
        });
      } else if (activeWeather === "snow") {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        weatherParticles.current.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
          ctx.fill();

          p.y += p.speed * 0.3;
          p.x += Math.sin(animationAge / 30 + p.speed) * 0.5;

          if (p.y > h) {
            p.y = -10;
            p.x = Math.random() * w;
          }
        });
      } else if (activeWeather === "storm" && Math.random() > 0.97) {
        // Lightning flashes screen background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(0, 0, w, h);
      } else if (activeWeather === "fog") {
        // Soft overlaying mist
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(10, 11, 16, 0.3)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
        grad.addColorStop(1, 'rgba(10, 11, 16, 0.3)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      frameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(frameId.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [districts, buildings, roads, selectedBuilding, pan, zoom, activeWeather, searchQuery, timeTravelIndex, timeTravelMode]);

  // Click / Selection hit-testing
  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let clicked: Building | null = null;
    let minDist = 35 * zoom; // click bounding threshold

    buildings.forEach(b => {
      const proj = project(b.x, 0, b.z, canvas.width, canvas.height, pan.x, pan.y, zoom);
      // Project height offset to click center of building
      const centerY = proj.y - (b.height * zoom) / 2;
      const dx = mouseX - proj.x;
      const dy = mouseY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        clicked = b;
      }
    });

    useCityStore.setSelectedBuilding(clicked);
  };

  // Helper function to dynamically shade colors for 3D walls
  const shadeColor = (color: string, percent: number) => {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.max(0, Math.min(255, R + percent));
    G = Math.max(0, Math.min(255, G + percent));
    B = Math.max(0, Math.min(255, B + percent));

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  };

  const getWeatherIcon = () => {
    switch (activeWeather) {
      case "sunny": return <Sun className="text-yellow-400 animate-spin" style={{ animationDuration: '20s' }} />;
      case "rainbow": return <Sun className="text-amber-300 animate-pulse" />;
      case "rain": return <CloudRain className="text-blue-400 animate-bounce" />;
      case "snow": return <CloudSnow className="text-blue-100" />;
      case "fog": return <CloudFog className="text-gray-400" />;
      case "storm": return <CloudLightning className="text-purple-400 animate-pulse" />;
      default: return <Sun className="text-yellow-400" />;
    }
  };

  return (
    <div className="relative w-full h-full cursor-grab active:cursor-grabbing select-none overflow-hidden">
      {/* 3D Canvas element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        className="block w-full h-full"
      />

      {/* Floating City Navigation HUD & Legend */}
      <div className="absolute top-6 left-6 pointer-events-none flex flex-col gap-3">
        <div className="glass-panel px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg pointer-events-auto">
          <div className="w-10 h-10 rounded-lg bg-cyber-bg flex items-center justify-center border border-cyber-border">
            {getWeatherIcon()}
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest">Memory Weather</div>
            <div className="text-sm font-semibold capitalize tracking-wide text-white glow-blue">
              {activeWeather}
            </div>
          </div>
        </div>

        <div className="glass-panel px-4 py-3 rounded-xl shadow-lg pointer-events-auto flex flex-col gap-2 text-xs">
          <div className="text-gray-400 uppercase tracking-widest border-b border-cyber-border pb-1 font-semibold">City Legend</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-blue-500"></span>
            <span>Technology District</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-500"></span>
            <span>Science District</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-pink-500"></span>
            <span>Creative District</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-amber-500"></span>
            <span>Finance District</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-purple-500"></span>
            <span>Personal District</span>
          </div>
        </div>
      </div>
      
      {/* Visual Controls HUD */}
      <div className="absolute bottom-6 left-6 glass-panel px-3 py-2 rounded-xl flex items-center gap-3 text-xs text-gray-400 pointer-events-auto shadow-md">
        <span>🖱️ Drag to Pan</span>
        <span className="text-cyber-border">|</span>
        <span>⚙️ Scroll to Zoom</span>
        <span className="text-cyber-border">|</span>
        <span>👉 Click Building to Walk Inside</span>
      </div>
    </div>
  );
};
