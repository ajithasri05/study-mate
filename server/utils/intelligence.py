try:
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    TfidfVectorizer = None

def calculate_exam_weights(text):
    """
    Identifies high-importance terms using TF-IDF simulation or sklearn.
    Returns a dictionary of terms and their calculated 'weight' (0-1).
    """
    if not text or len(text) < 50:
        return {}

    # Heuristic importance: headers, bolded-like lines, and TF-IDF
    lines = text.split('\n')
    weights = {}
    
    if TfidfVectorizer:
        try:
            vectorizer = TfidfVectorizer(stop_words='english', max_features=20)
            X = vectorizer.fit_transform([text])
            feature_names = vectorizer.get_feature_names_out()
            scores = X.toarray()[0]
            for i, name in enumerate(feature_names):
                weights[name] = float(scores[i])
        except Exception as e:
            print(f"TF-IDF Error: {e}")

    # Boost weights for header-like lines
    for line in lines:
        clean_line = line.strip()
        if len(clean_line) > 0 and len(clean_line) < 60:
            # Simple heuristic: shorter lines are likely headers
            words = clean_line.lower().split()
            for word in words:
                if len(word) > 3:
                    weights[word] = weights.get(word, 0.1) + 0.2
                    
    # Normalize to 0-1
    if weights:
        max_val = max(weights.values())
        for k in weights:
            weights[k] = min(weights[k] / max_val, 1.0)
            
    return weights

def get_importance_badge(score):
    if score > 0.7: return "HOT"
    if score > 0.4: return "WARM"
    return "COLD"
