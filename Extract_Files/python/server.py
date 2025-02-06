from flask import Flask, request, jsonify
import spacy
from collections import Counter

# Initialize Flask app
app = Flask(__name__)

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

def extract_keywords(text, top_n=10):
    """
    Extracts top N keywords from the given text.
    """
    doc = nlp(text)
    keywords = [
        token.text.lower()
        for token in doc
        if token.is_alpha and not token.is_stop
    ]
    keyword_freq = Counter(keywords)
    return keyword_freq.most_common(top_n)

@app.route("/extract_keywords", methods=["POST"])
def extract_keywords_api():
    """
    API endpoint to extract keywords.
    """
    data = request.json
    text = data.get("text", "")
    top_n = data.get("top_n", 10)

    if not text:
        return jsonify({"error": "No text provided"}), 400

    keywords = extract_keywords(text, top_n)
    return jsonify({"keywords": keywords})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)