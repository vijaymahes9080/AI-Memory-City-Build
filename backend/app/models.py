import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship

class KnowledgeNode(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)
    title: str
    content_type: str  # 'markdown', 'pdf', 'image', 'video', 'code', 'bookmark'
    source_path: Optional[str] = None
    summary: str
    importance: float = 0.5  # 0.0 to 1.0 (determines building size)
    visits_count: int = 0
    health_status: str = "sunny"  # 'sunny', 'rain', 'fog', 'storm', 'snow', 'rainbow'
    created_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    updated_at: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)

class RelationEdge(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_id: str = Field(index=True)
    target_id: str = Field(index=True)
    rel_type: str  # 'LOCATED_IN', 'RELATED_TO', 'DEPENDS_ON', 'CITED_BY'
    weight: float = 1.0

class SpatialObject(SQLModel, table=True):
    id: str = Field(default=None, primary_key=True)  # same as building_id
    node_id: str = Field(foreign_key="knowledgenode.id", index=True)
    district_id: str
    grid_x: float
    grid_y: float  # height off ground (usually 0)
    grid_z: float
    height: float
    width: float = 2.0
    depth: float = 2.0
    color_hex: str
    abandoned: bool = False
    style_type: str = "building"  # 'building', 'skyscraper', 'ruin', 'monument', 'park'

class TimeTravelLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    node_id: str
    event_type: str  # 'create', 'update', 'visit', 'decay', 'archive', 'delete'
    payload: str  # JSON representation of the changes/state
