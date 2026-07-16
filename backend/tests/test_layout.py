import unittest
from app.models import KnowledgeNode, RelationEdge
from app.engines.layout import determine_district, generate_spatial_layout

class TestCityLayoutEngine(unittest.TestCase):
    
    def test_determine_district_heuristics(self):
        """Verifies that keywords map nodes to correct visual districts."""
        node_tech = KnowledgeNode(
            id="test1", title="Docker and Python Integration", 
            summary="Deploying python applications inside docker containers.",
            importance=0.5
        )
        node_science = KnowledgeNode(
            id="test2", title="Quantum Physics Research", 
            summary="A deep dive into quantum calculations and mathematical mechanics.",
            importance=0.5
        )
        node_creative = KnowledgeNode(
            id="test3", title="Video Cinematography Design", 
            summary="Visual styling of movie scenes.",
            importance=0.5
        )

        self.assertEqual(determine_district(node_tech), "technology")
        self.assertEqual(determine_district(node_science), "science")
        self.assertEqual(determine_district(node_creative), "creative")

    def test_spatial_layout_generator(self):
        """Verifies that layouts are successfully constructed with correct dimensions."""
        nodes = [
            KnowledgeNode(id="n1", title="Python Language", summary="Language details", importance=0.8),
            KnowledgeNode(id="n2", title="FastAPI Microservices", summary="API details", importance=0.4),
            KnowledgeNode(id="n3", title="Physics Equations", summary="Formulas details", importance=0.9),
        ]
        edges = [
            RelationEdge(source_id="n1", target_id="n2", rel_type="RELATED_TO")
        ]
        
        spatial_objects = generate_spatial_layout(nodes, edges)
        
        self.assertEqual(len(spatial_objects), 3)
        
        # Verify ids and properties
        obj_lookup = {s.node_id: s for s in spatial_objects}
        self.assertIn("n1", obj_lookup)
        self.assertIn("n2", obj_lookup)
        self.assertIn("n3", obj_lookup)

        # Check heights are assigned proportionally to importance
        self.assertGreater(obj_lookup["n1"].height, obj_lookup["n2"].height)
        
        # Check district alignment
        self.assertEqual(obj_lookup["n1"].district_id, "technology")
        self.assertEqual(obj_lookup["n3"].district_id, "science")

if __name__ == '__main__':
    unittest.main()
