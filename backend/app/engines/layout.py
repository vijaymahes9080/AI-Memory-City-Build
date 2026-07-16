import math
from typing import List, Dict, Any
from ..models import KnowledgeNode, RelationEdge, SpatialObject

# Predefined coordinates and colors for standard Districts to anchor the layout
DISTRICT_TEMPLATES = {
    "technology": {"name": "Technology District", "center_x": 0.0, "center_z": 0.0, "color": "#3b82f6"},
    "science": {"name": "Science District", "center_x": 40.0, "center_z": 40.0, "color": "#10b981"},
    "creative": {"name": "Creative District", "center_x": -40.0, "center_z": 40.0, "color": "#ec4899"},
    "finance": {"name": "Finance District", "center_x": 40.0, "center_z": -40.0, "color": "#f59e0b"},
    "personal": {"name": "Personal District", "center_x": -40.0, "center_z": -40.0, "color": "#8b5cf6"},
    "general": {"name": "Central Plaza", "center_x": 0.0, "center_z": 30.0, "color": "#6b7280"}
}

def determine_district(node: KnowledgeNode) -> str:
    """Classifies a node into a district based on content type, tags, or content analysis."""
    title_lower = node.title.lower()
    summary_lower = node.summary.lower()
    
    # Simple semantic heuristics
    tech_keywords = ["python", "code", "programming", "docker", "git", "api", "server", "model", "llm", "ai", "database"]
    science_keywords = ["physics", "math", "biology", "research", "paper", "university", "experiment", "neural network"]
    creative_keywords = ["art", "design", "video", "image", "music", "cinema", "museum", "color"]
    finance_keywords = ["business", "money", "career", "finance", "startup", "office", "stock", "economy"]
    personal_keywords = ["home", "meeting", "personal", "health", "diary", "workout", "recipe"]
    
    if any(k in title_lower or k in summary_lower for k in tech_keywords):
        return "technology"
    elif any(k in title_lower or k in summary_lower for k in science_keywords):
        return "science"
    elif any(k in title_lower or k in summary_lower for k in creative_keywords):
        return "creative"
    elif any(k in title_lower or k in summary_lower for k in finance_keywords):
        return "finance"
    elif any(k in title_lower or k in summary_lower for k in personal_keywords):
        return "personal"
    return "general"

def generate_spatial_layout(nodes: List[KnowledgeNode], edges: List[RelationEdge]) -> List[SpatialObject]:
    """
    Computes spatial layouts dynamically for a list of nodes.
    Uses a spiral/grid packing algorithm centered on each district's anchor coordinate.
    """
    spatial_objects = []
    
    # Group nodes by district
    nodes_by_district: Dict[str, List[KnowledgeNode]] = {}
    for node in nodes:
        dist = determine_district(node)
        if dist not in nodes_by_district:
            nodes_by_district[dist] = []
        nodes_by_district[dist].append(node)
        
    for dist_id, dist_nodes in nodes_by_district.items():
        template = DISTRICT_TEMPLATES.get(dist_id, DISTRICT_TEMPLATES["general"])
        center_x = template["center_x"]
        center_z = template["center_z"]
        color = template["color"]
        
        # Sort nodes by importance so larger buildings are constructed near the center
        dist_nodes.sort(key=lambda n: n.importance, reverse=True)
        
        # Place buildings using a Fermat's spiral logic to distribute evenly around center
        for index, node in enumerate(dist_nodes):
            # Golden ratio angle separation
            angle = index * 137.5 * (math.pi / 180.0)
            # Distance increases with index
            radius = 6.0 * math.sqrt(index + 1)
            
            x = center_x + radius * math.cos(angle)
            z = center_z + radius * math.sin(angle)
            
            # Determine visual size based on node properties
            height = 3.0 + (node.importance * 12.0)  # Skyscraper heights range 3.0 to 15.0
            width = 2.0 + (node.importance * 2.0)
            depth = 2.0 + (node.importance * 2.0)
            
            # Decay state styling
            abandoned = False
            style_type = "building"
            node_color = color
            
            if node.visits_count > 10:
                style_type = "skyscraper"
            elif node.importance > 0.8:
                style_type = "monument"
                node_color = "#f59e0b"  # golden color for landmarks
                
            if node.health_status == "fog" or node.health_status == "storm":
                abandoned = True
                style_type = "ruin"
                node_color = "#4b5563"  # grey ruins
                
            spatial_obj = SpatialObject(
                id=f"bld_{node.id}",
                node_id=node.id,
                district_id=dist_id,
                grid_x=round(x, 2),
                grid_y=0.0,
                grid_z=round(z, 2),
                height=round(height, 2),
                width=round(width, 2),
                depth=round(depth, 2),
                color_hex=node_color,
                abandoned=abandoned,
                style_type=style_type
            )
            spatial_objects.append(spatial_obj)
            
    return spatial_objects
