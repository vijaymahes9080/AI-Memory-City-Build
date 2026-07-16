import os
import uuid
import asyncio
import random
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, create_engine, select

from .models import KnowledgeNode, RelationEdge, SpatialObject, TimeTravelLog
from .engines.layout import generate_spatial_layout, DISTRICT_TEMPLATES
from .services.ai import extract_knowledge, get_agent_response, generate_quiz

DATABASE_FILE = "memory_city.db"
DATABASE_URL = f"sqlite:///{DATABASE_FILE}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

app = FastAPI(title="AI Memory City API", version="1.0.0")

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

def seed_database_if_empty(session: Session):
    """Seed initial high-quality nodes representing common fields of study."""
    existing_nodes = session.exec(select(KnowledgeNode)).all()
    if existing_nodes:
        return
        
    initial_nodes = [
        # Technology
        KnowledgeNode(
            id="py_core", title="Python Development", content_type="code",
            summary="A high-level programming language prioritizing code readability. Powering backend stacks and ML models.",
            importance=0.9, visits_count=24, health_status="sunny"
        ),
        KnowledgeNode(
            id="fastapi_api", title="FastAPI Framework", content_type="code",
            summary="Modern, fast (high-performance) web framework for building APIs with Python based on standard type hints.",
            importance=0.7, visits_count=12, health_status="rainbow"
        ),
        KnowledgeNode(
            id="docker_dev", title="Docker Containers", content_type="bookmark",
            summary="OS-level virtualization delivering software in packages called containers, guaranteeing environment parity.",
            importance=0.6, visits_count=8, health_status="sunny"
        ),
        
        # Science & AI
        KnowledgeNode(
            id="nn_core", title="Neural Network Lab", content_type="pdf",
            summary="Computational models inspired by biological neural networks, acting as the foundation of modern Deep Learning.",
            importance=0.95, visits_count=45, health_status="rainbow"
        ),
        KnowledgeNode(
            id="transformer_model", title="Transformer Monument", content_type="pdf",
            summary="Attention-based neural network architecture that revolutionized NLP, translating sentences using parallel self-attention.",
            importance=1.0, visits_count=60, health_status="sunny"
        ),
        
        # Creative
        KnowledgeNode(
            id="color_theory", title="Color Harmonies", content_type="image",
            summary="Practical guidance to color mixing and visual effects of specific color combinations in graphic and UI design.",
            importance=0.5, visits_count=3, health_status="rain"
        ),
        KnowledgeNode(
            id="cinema_art", title="Cinematography Lab", content_type="video",
            summary="The art and craft of visual storytelling on screen, combining lighting, camera angles, and lens selection.",
            importance=0.65, visits_count=5, health_status="fog"
        ),
        
        # Finance & Startups
        KnowledgeNode(
            id="startup_deck", title="Pitch Deck Blueprint", content_type="markdown",
            summary="Standard sequence of presentation slides explaining target market, value proposition, and financial forecasts.",
            importance=0.8, visits_count=18, health_status="sunny"
        ),
        
        # Personal
        KnowledgeNode(
            id="morning_routine", title="Morning Focus Rituals", content_type="markdown",
            summary="Highly effective morning sequences containing exercise, planning, and reading to establish cognitive momentum.",
            importance=0.4, visits_count=22, health_status="sunny"
        ),
    ]
    
    initial_edges = [
        RelationEdge(source_id="py_core", target_id="fastapi_api", rel_type="RELATED_TO"),
        RelationEdge(source_id="py_core", target_id="nn_core", rel_type="DEPENDS_ON"),
        RelationEdge(source_id="nn_core", target_id="transformer_model", rel_type="DEPENDS_ON"),
        RelationEdge(source_id="fastapi_api", target_id="docker_dev", rel_type="RELATED_TO"),
    ]
    
    for n in initial_nodes:
        session.add(n)
    for e in initial_edges:
        session.add(e)
        
    session.commit()
    
    # Recalculate 3D coordinates based on seeds
    nodes = session.exec(select(KnowledgeNode)).all()
    edges = session.exec(select(RelationEdge)).all()
    spatial_objs = generate_spatial_layout(nodes, edges)
    
    for s in spatial_objs:
        session.add(s)
    session.commit()

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_database_if_empty(session)
    # Start background task to simulate weather change & evolution logs
    asyncio.create_task(simulation_loop())

async def simulation_loop():
    """Simulates organic evolution of memory weather and structure health."""
    weathers = ["sunny", "rain", "fog", "storm", "snow", "rainbow"]
    while True:
        await asyncio.sleep(60)  # Trigger change every minute for visual dynamism
        with Session(engine) as session:
            nodes = session.exec(select(KnowledgeNode)).all()
            if nodes:
                # Pick a random node and change its weather
                target = random.choice(nodes)
                old_status = target.health_status
                new_status = random.choice(weathers)
                target.health_status = new_status
                session.add(target)
                
                # Check for decay
                if new_status in ["fog", "storm"]:
                    # Visual representation shifts to ruins
                    spatial = session.exec(select(SpatialObject).where(SpatialObject.node_id == target.id)).first()
                    if spatial:
                        spatial.abandoned = True
                        spatial.style_type = "ruin"
                        spatial.color_hex = "#4b5563"
                        session.add(spatial)
                
                session.commit()
                
                # Broadcast weather change to frontend clients
                await manager.broadcast({
                    "type": "WEATHER_CHANGE",
                    "node_id": target.id,
                    "title": target.title,
                    "weather": new_status,
                    "message": f"Weather over {target.title} is now {new_status}."
                })

@app.get("/api/city")
def get_city_state():
    """Returns the entire 3D city state: districts, buildings, and connecting roads."""
    with Session(engine) as session:
        nodes = session.exec(select(KnowledgeNode)).all()
        spatial_objects = session.exec(select(SpatialObject)).all()
        edges = session.exec(select(RelationEdge)).all()
        
        # Build district visual entities
        districts = []
        for d_id, val in DISTRICT_TEMPLATES.items():
            districts.append({
                "id": d_id,
                "name": val["name"],
                "color": val["color"],
                "center_x": val["center_x"],
                "center_z": val["center_z"]
            })
            
        # Compile structures
        buildings = []
        node_lookup = {n.id: n for n in nodes}
        for s in spatial_objects:
            node = node_lookup.get(s.node_id)
            if node:
                buildings.append({
                    "id": s.id,
                    "node_id": s.node_id,
                    "district_id": s.district_id,
                    "title": node.title,
                    "summary": node.summary,
                    "content_type": node.content_type,
                    "importance": node.importance,
                    "visits_count": node.visits_count,
                    "health_status": node.health_status,
                    "x": s.grid_x,
                    "y": s.grid_y,
                    "z": s.grid_z,
                    "height": s.height,
                    "width": s.width,
                    "depth": s.depth,
                    "color": s.color_hex,
                    "style_type": s.style_type,
                    "abandoned": s.abandoned
                })
                
        # Generate roads based on relational edges
        roads = []
        spatial_lookup = {s.node_id: s for s in spatial_objects}
        for e in edges:
            src_sp = spatial_lookup.get(e.source_id)
            tgt_sp = spatial_lookup.get(e.target_id)
            if src_sp and tgt_sp:
                roads.append({
                    "id": f"road_{e.id}",
                    "source": {"x": src_sp.grid_x, "z": src_sp.grid_z},
                    "target": {"x": tgt_sp.grid_x, "z": tgt_sp.grid_z},
                    "rel_type": e.rel_type
                })
                
        return {
            "districts": districts,
            "buildings": buildings,
            "roads": roads
        }

@app.post("/api/nodes/upload")
async def upload_document(
    title: str = Form(None),
    content: str = Form(None),
    file: UploadFile = File(None)
):
    """Processes document uploads, extracts semantic architecture, rebuilds grid, and broadcasts construction."""
    raw_text = ""
    if file:
        file_contents = await file.read()
        raw_text = file_contents.decode("utf-8", errors="ignore")
    elif content:
        raw_text = content
        
    extracted = extract_knowledge(raw_text)
    node_id = f"node_{uuid.uuid4().hex[:8]}"
    
    if title:
        extracted["title"] = title
        
    with Session(engine) as session:
        # Create knowledge node
        node = KnowledgeNode(
            id=node_id,
            title=extracted["title"],
            content_type="markdown" if content else "pdf",
            summary=extracted["summary"],
            importance=extracted["importance"],
            visits_count=1,
            health_status="sunny"
        )
        session.add(node)
        
        # Connect to existing related nodes
        for rel_title in extracted.get("relations", []):
            # Try to find target node by similar title
            target = session.exec(select(KnowledgeNode).where(KnowledgeNode.title == rel_title)).first()
            if target:
                edge = RelationEdge(source_id=node_id, target_id=target.id, rel_type="RELATED_TO")
                session.add(edge)
                
        session.commit()
        
        # Recompute spatial layouts for all nodes
        all_nodes = session.exec(select(KnowledgeNode)).all()
        all_edges = session.exec(select(RelationEdge)).all()
        
        # Clear old positions and save new
        session.exec(select(SpatialObject)).all() # load
        for old_sp in session.exec(select(SpatialObject)).all():
            session.delete(old_sp)
        session.commit()
        
        new_spatials = generate_spatial_layout(all_nodes, all_edges)
        for s in new_spatials:
            session.add(s)
            
        # Log event
        session.add(TimeTravelLog(node_id=node_id, event_type="create", payload=json.dumps(extracted)))
        session.commit()
        
        # Find constructed spatial coordinates
        built_object = next((item for item in new_spatials if item.node_id == node_id), None)
        
    # Broadcast construction event
    if built_object:
        await manager.broadcast({
            "type": "CONSTRUCTION",
            "node_id": node_id,
            "title": extracted["title"],
            "x": built_object.grid_x,
            "z": built_object.grid_z,
            "message": f"Constructing building for: {extracted['title']}!"
        })
        
    return {"status": "success", "node_id": node_id}

@app.post("/api/nodes/{node_id}/visit")
def visit_building(node_id: str):
    """Increments visit counter, upgrades visual building attributes, updates logs."""
    with Session(engine) as session:
        node = session.exec(select(KnowledgeNode).where(KnowledgeNode.id == node_id)).first()
        if not node:
            return {"error": "Node not found"}
            
        node.visits_count += 1
        node.health_status = "sunny"
        
        # visually upgrade building
        spatial = session.exec(select(SpatialObject).where(SpatialObject.node_id == node_id)).first()
        if spatial:
            spatial.abandoned = False
            if node.visits_count > 10 and spatial.style_type != "monument":
                spatial.style_type = "skyscraper"
                spatial.height = 14.0
                
        session.add(node)
        session.add(spatial)
        session.add(TimeTravelLog(node_id=node_id, event_type="visit", payload=json.dumps({"visits": node.visits_count})))
        session.commit()
        return {"status": "success", "visits": node.visits_count}

@app.post("/api/chat")
def chat_endpoint(agent: str, node_id: str, message: str):
    """Chats with an AI citizen inside a specific knowledge building."""
    with Session(engine) as session:
        node = session.exec(select(KnowledgeNode).where(KnowledgeNode.id == node_id)).first()
        if not node:
            return {"response": "This building is currently vacant."}
        response = get_agent_response(agent, node.title, node.summary, message)
        return {"response": response}

@app.get("/api/quiz/{node_id}")
def quiz_endpoint(node_id: str):
    """Generates an educational quiz for review validation."""
    with Session(engine) as session:
        node = session.exec(select(KnowledgeNode).where(KnowledgeNode.id == node_id)).first()
        if not node:
            return {"quiz": []}
        questions = generate_quiz(node.title, node.summary)
        return {"quiz": questions}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)
