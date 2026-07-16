import json
import urllib.request
import urllib.error
from typing import Dict, Any, List

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "llama3"

def query_local_llm(prompt: str, system_prompt: str = "") -> str:
    """Queries a locally running Ollama instance, falling back gracefully if offline."""
    payload = {
        "model": DEFAULT_MODEL,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "options": {"temperature": 0.3}
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            OLLAMA_URL, 
            data=data, 
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data.get("response", "")
    except urllib.error.URLError:
        # Fallback to local heuristic answers if Ollama is not installed/running
        return ""

def extract_knowledge(text: str) -> Dict[str, Any]:
    """Extracts semantic features, entity relationships, and meta-importance from text inputs."""
    prompt = (
        "Analyze the following text and extract key structural information.\n"
        "Return raw JSON with exactly these keys: "
        "'title' (string), 'summary' (string), 'tags' (list of strings), "
        "'importance' (float between 0 and 1), 'relations' (list of target concept names related to this).\n"
        f"Text:\n{text[:4000]}"
    )
    
    response_text = query_local_llm(prompt, "You are a precise data extractor. Only output valid JSON. Do not include markdown codeblocks or explanation text.")
    
    # Try parsing Ollama JSON response
    if response_text:
        try:
            # Clean markdown code blocks if the LLM outputted them anyway
            clean_json = response_text.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            return json.loads(clean_json.strip())
        except Exception:
            pass
            
    # Fallback parser: Regex-free heuristic parser when AI server is unreachable or fails formatting
    title = text.split("\n")[0][:60].replace("#", "").strip() or "Untitled Document"
    summary = text[:200].strip() + ("..." if len(text) > 200 else "")
    importance = 0.5
    if len(text) > 2000:
        importance = 0.8
    elif len(text) < 300:
        importance = 0.3
        
    tags = []
    relations = []
    text_lower = text.lower()
    
    # Quick heuristics to match common concepts
    for word in ["python", "docker", "javascript", "react", "fastapi", "postgres", "ai", "machine learning", "neural network"]:
        if word in text_lower:
            tags.append(word)
            relations.append(word.capitalize())
            
    return {
        "title": title,
        "summary": summary,
        "tags": tags,
        "importance": importance,
        "relations": list(set(relations))
    }

def get_agent_response(agent_role: str, node_title: str, node_summary: str, user_message: str) -> str:
    """Simulates/Generates conversations with specific building citizens."""
    system_prompts = {
        "Professor": "You are a warm, academic Professor. Focus on history, core theory, and explaining foundations. Give a deep conceptual breakdown.",
        "Engineer": "You are a Senior Software Engineer. Give practical advice, implementation patterns, config examples, and code blocks.",
        "Teacher": "You are a supportive Teacher. Design simple quiz questions and walk through coding concepts step by step.",
        "Reviewer": "You are a critical code and architecture reviewer. Call out potential bugs, architectural flaws, security risks, or legacy anti-patterns.",
        "Archaeologist": "You are a passionate Archaeologist of the Mind. You study forgotten memories, ruins, and help users reconstruct decaying knowledge towers, explaining the historical context and why it is vital to review them."
    }
    
    sys_prompt = system_prompts.get(agent_role, "You are an AI citizen inside the knowledge city.")
    prompt = (
        f"We are inside the Building: '{node_title}'.\n"
        f"Building Summary Context: {node_summary}\n"
        f"User asks: {user_message}\n"
        "Provide a concise, helpful response suited to your citizen role."
    )
    
    response = query_local_llm(prompt, sys_prompt)
    if response:
        return response
        
    # Heuristic template fallbacks when offline
    if agent_role == "Professor":
        return f"Greetings! As a Professor here in the {node_title} tower, I can explain that this is built on fundamental scientific pillars. Structurally, it centers on optimizing efficiency and modularity. What specific concepts would you like to explore deeper?"
    elif agent_role == "Engineer":
        return f"Hey there! From an engineering perspective, deploying {node_title} requires structured configuration files, correct dependency environments, and a robust CI pipeline. Let me know if you need code snippets!"
    elif agent_role == "Teacher":
        return f"Hello! Ready for a quick learning check on {node_title}? Here is a quick challenge: Can you explain how this connects to neighboring buildings? Let me know your answer and I'll score it!"
    elif agent_role == "Archaeologist":
        return f"Aha! We stand amidst the ruins of {node_title}. Time and neglect have weathered its once-grand towers. To reconstruct this node, we should excavate its core ideas: {node_summary}. Would you like to launch a reconstruction scan to restore it?"
    else:
        return f"Let's look at {node_title}. Reviewing this building suggests we need to check dependency graphs and verify memory health. How can I help review this?"

def generate_quiz(node_title: str, node_summary: str) -> List[Dict[str, Any]]:
    """Generates a 3-question multiple choice quiz for a node."""
    prompt = (
        f"Create a 3-question multiple choice quiz about the following topic: {node_title}.\n"
        f"Context: {node_summary}\n"
        "Output raw JSON as a list of objects with keys: 'question' (string), 'options' (list of 4 strings), and 'correct_index' (integer, 0-3)."
    )
    
    res = query_local_llm(prompt, "You are an educator. Only output clean JSON containing a list of quiz questions.")
    if res:
        try:
            clean_json = res.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            return json.loads(clean_json.strip())
        except Exception:
            pass
            
    # Statically generated custom quiz when offline
    return [
        {
            "question": f"What is the primary role of {node_title}?",
            "options": [
                "Providing a foundation for related topics in the district",
                "Rendering visual 3D textures in WebGL",
                "Running background tasks via celery",
                "Encrypting user passwords"
            ],
            "correct_index": 0
        },
        {
            "question": f"Which district does {node_title} belong to?",
            "options": [
                "Technology District",
                "Science District",
                "Creative District",
                "The most semantically related cluster matching its tags"
            ],
            "correct_index": 3
        }
    ]
