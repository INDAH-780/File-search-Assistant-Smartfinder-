import re
from flask import Flask, request, jsonify
import json
from search import Search
import markdown
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Initialize the Search class instance
search_instance = Search()

@app.route('/deploy_elser', methods=['GET'])
def deploy_elser():
    if not search_instance.is_model_deployed():
        search_instance.deploy_elser()
        return jsonify({"message": "ELSER model deployed."}), 200
    else:
        return jsonify({"message": "ELSER model already deployed."}), 200

@app.route('/search', methods=['GET'])
def handle_search():
    query = request.args.get("query", "")
    filter_type = request.args.get("filter", "Title")  # Default filter type is Title
    filters, parsed_query = extract_filters(query)

    # Get the 'from' parameter for pagination (if needed)
    from_ = request.args.get("from_", type=int, default=0)

    # Get file types selected by the user
    file_types = request.args.getlist('file_type')  # Use getlist for multiple values
    unique_file_types = set()
    file_type_filters = []

    for file_type in file_types:
        if file_type not in unique_file_types:
            unique_file_types.add(file_type)
            file_type_filters.append(f'file_type:{file_type}')

    # Append the unique file type filters to the query string
    query += ' ' + ' '.join(file_type_filters)

    # Update filters to include the new file type filters
    filters = update_filters_with_file_types(filters, file_type_filters)

    # Build the search query
    if parsed_query:
        search_query = {
            "sub_searches": [
                {
                    "query": {
                        "bool": {
                            "must": {
                                "multi_match": {
                                    "query": parsed_query,
                                    "fields": get_search_fields(filter_type),
                                    "operator": "and"
                                }
                            },
                            **filters,
                        }
                    }
                },
                {
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "text_expansion": {
                                        "elser_embedding": {
                                            "model_id": ".elser_model_2",
                                            "model_text": parsed_query,
                                        }
                                    },
                                }
                            ],
                            **filters,
                        }
                    },
                },
            ],
            "rank": {"rrf": {}},
            "aggs": {
                "category-agg": {
                    "terms": {
                        "field": "category.keyword",
                    }
                },
                "year-agg": {
                    "date_histogram": {
                        "field": "updated_at",
                        "calendar_interval": "year",
                        "format": "yyyy",
                    },
                },
                "file_type-agg": {
                    "terms": {
                        "field": "file_type.keyword",
                    }
                },
            },
        }
    else:
        search_query = {
            "query": {
                "bool": {
                    "must": {"match_all": {}},
                    **filters,
                }
            },
            "aggs": {
                "category-agg": {
                    "terms": {
                        "field": "category.keyword",
                    }
                },
                "year-agg": {
                    "date_histogram": {
                        "field": "updated_at",
                        "calendar_interval": "year",
                        "format": "yyyy",
                    },
                },
                "file_type-agg": {
                    "terms": {
                        "field": "file_type.keyword",
                    }
                },
            },
        }

    results = search_instance.search(
    **search_query
     )

    aggs = {
        "Category": {
            bucket["key"]: bucket["doc_count"]
            for bucket in results["aggregations"]["category-agg"]["buckets"]
        },
        "Year": {
            bucket["key_as_string"]: bucket["doc_count"]
            for bucket in results["aggregations"]["year-agg"]["buckets"]
            if bucket["doc_count"] > 0
        },
        "File Types": {
            bucket["key"]: bucket["doc_count"]
            for bucket in results["aggregations"]["file_type-agg"]["buckets"]
        },
    }

    # Convert content from Markdown to HTML
    for result in results["hits"]["hits"]:
        result["_source"]["summary"] = markdown.markdown(result["_source"]["summary"])

        # Add file path to the result
        result["_source"]["file_path"] = result["_source"].get("file_path", "N/A")

        # Apply highlighting based on filter type
        if filter_type == "Title":
            result["_source"]["name"] = highlight_match(result["_source"]["name"], parsed_query)
        elif filter_type == "Keywords":
            result["_source"]["summary"] = highlight_keywords(result["_source"]["summary"], parsed_query)
    
    return jsonify({
        "results": results["hits"]["hits"],
        "query": query,
        "from_": from_,
        "total": results["hits"]["total"]["value"],
        "aggs": aggs,
    })

# Helper function to highlight keywords in a text
def highlight_keywords(text, query):
    """Highlight keywords in the summary field."""
    words = query.split(" ")
    for word in words:
        # Escape special characters for regex matching
        escaped_word = re.escape(word)
        text = re.sub(rf"({escaped_word})", r'<span class="highlight">\1</span>', text, flags=re.IGNORECASE)
    return text

# Helper function to highlight title based on query
def highlight_match(text, query):
    """Highlight the title based on an exact match to the query."""
    return re.sub(rf"({re.escape(query)})", r'<mark class="highlight">\1</mark>', text, flags=re.IGNORECASE)

# Helper function to get the correct search fields based on filter type
def get_search_fields(filter_type):
    if filter_type == "Keywords":
        return ["keywords"]
    elif filter_type == "Advanced Search":
        return ["name", "summary", "keywords"]
    elif filter_type == "Title":  # Exact match for title (name)
        return ["name.keyword"]  # Use `.keyword` for exact matches
    else:  # Default fallback
        return ["name.keyword"]

# Helper function to update filters with file type filters
def update_filters_with_file_types(filters, file_type_filters):
    if file_type_filters:
        filters['filter'] = {
            "bool": {
                "should": [{"term": {"file_type.keyword": file_type}} for file_type in file_type_filters]
            }
        }
    return filters

# Function to extract filters from the query
def extract_filters(query):
    filter_regex = r"category:([^\s]+)\s*"
    m = re.search(filter_regex, query)
    if m is None:
        return {}, query  # no filters
    filters = {"filter": [{"term": {"category.keyword": {"value": m.group(1)}}}]}
    query = re.sub(filter_regex, "", query).strip()
    return filters, query

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
